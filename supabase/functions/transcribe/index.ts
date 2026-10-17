// Transcribe a cast: every recording in it that doesn't have a transcript yet
// (one file, or each turn of a cast made in turns). Called by the app after a
// cast or turn is saved, and when a cast without one is opened.
//
// POST { cast_id } with the caller's session. Access is checked by reading the
// cast *as the caller* (RLS); the audio is then handed to Groq's Whisper as a
// short-lived signed URL, so the file never passes through this function.
// Results land in `transcripts` (service role). Responds with the cast's
// transcripts. Without GROQ_API_KEY it does nothing and says so.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = Deno.env.get('TRANSCRIBE_MODEL') || 'whisper-large-v3-turbo';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

type Segment = { s: number; e: number; t: string };

async function transcribe(url: string, key: string) {
  const form = new FormData();
  form.append('url', url);
  form.append('model', MODEL);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`transcription failed (${res.status}): ${await res.text()}`);
  const out = await res.json();
  const segments: Segment[] = (out.segments || [])
    .map((g: { start: number; end: number; text: string }) => ({
      s: Math.round(g.start * 100) / 100,
      e: Math.round(g.end * 100) / 100,
      t: String(g.text || '').trim(),
    }))
    .filter((g: Segment) => g.t);
  return { segments, text: String(out.text || '').trim(), language: out.language || null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply({});
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);

  const { cast_id: castId } = await req.json().catch(() => ({}));
  if (!castId) return reply({ error: 'cast_id required' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { authorization: req.headers.get('authorization') || '' } },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Can the caller see this cast at all? (RLS decides.)
  const { data: cast } = await asCaller
    .from('casts')
    .select('id, audio_path, together')
    .eq('id', castId)
    .maybeSingle();
  if (!cast) return reply({ error: 'not found' }, 404);

  let paths: string[] = [cast.audio_path];
  if (cast.together) {
    const { data: turns } = await admin
      .from('cast_turns')
      .select('audio_path')
      .eq('cast_id', castId)
      .order('position');
    if (turns?.length) paths = turns.map((t: { audio_path: string }) => t.audio_path);
  }

  const { data: have } = await admin
    .from('transcripts')
    .select('audio_path')
    .eq('cast_id', castId);
  const done = new Set((have || []).map((t: { audio_path: string }) => t.audio_path));
  const todo = paths.filter((p) => p && !done.has(p));

  const key = Deno.env.get('GROQ_API_KEY');
  const errors: string[] = [];
  if (todo.length > 0 && !key) errors.push('transcription is not set up (no GROQ_API_KEY)');
  else {
    for (const path of todo) {
      try {
        const { data: signed, error } = await admin.storage
          .from('casts')
          .createSignedUrl(path, 600);
        if (error || !signed) throw error || new Error('could not sign audio');
        const t = await transcribe(signed.signedUrl, key!);
        const { error: saveError } = await admin
          .from('transcripts')
          .upsert({ audio_path: path, cast_id: castId, ...t });
        if (saveError) throw saveError;
      } catch (err) {
        errors.push(`${path}: ${(err as Error).message}`);
      }
    }
  }
  if (errors.length) console.error('transcribe', castId, errors);

  const { data: transcripts } = await admin
    .from('transcripts')
    .select('audio_path, segments, text, language')
    .eq('cast_id', castId);
  return reply({ transcripts: transcripts || [], pending: errors.length > 0 });
});
