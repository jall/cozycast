// Transcribe recordings, and (asked to) suggest words for them.
//
// POST with the caller's session, one of:
//   { cast_id }    every recording in a cast without a transcript yet (one
//                  file, or each turn of a cast made in turns)
//   { note_id }    a voice note
//   { audio_path } your own fresh upload, before it's a cast or a turn — so
//                  the record form can suggest a title while you're still on it
// plus `suggest: true` to also get { title, summary, question } drafted from
// what was said.
//
// Access is checked by reading the cast or note *as the caller* (RLS), or, for
// an upload, that it's in the caller's own folder. The audio is handed to
// Groq's Whisper as a short-lived signed URL, so the file never passes through
// here; results land in `transcripts` (service role). Suggestions come from
// Claude. Without GROQ_API_KEY / ANTHROPIC_API_KEY those parts quietly do
// nothing.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = Deno.env.get('TRANSCRIBE_MODEL') || 'whisper-large-v3-turbo';
const SUGGEST_MODEL = Deno.env.get('SUGGEST_MODEL') || 'claude-opus-5-5';

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
type Transcript = { segments: Segment[]; text: string; language: string | null };

async function transcribe(url: string, key: string): Promise<Transcript> {
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
  if (!res.ok) {
    const body = await res.text();
    // Nothing to hear (a blip, or silence): an empty transcript, not a retry.
    if (res.status === 400 && body.includes('audio_too_short')) {
      return { segments: [], text: '', language: null };
    }
    throw new Error(`transcription failed (${res.status}): ${body}`);
  }
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

// ---- Suggestions ------------------------------------------------------------

const SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    question: { type: ['string', 'null'] },
  },
  required: ['title', 'summary', 'question'],
  additionalProperties: false,
};

const SUGGEST_SYSTEM = `You help people on cozycast, a private app where close friends share short audio recordings ("casts") with each other. Given the transcript of a recording, suggest the words that go with it:

- title: a short, warm title (2-7 words) that a friend would recognise it by. Concrete over clever; the actual subject, not "A Conversation About...". Sentence case, no quotes, no emoji.
- summary: one or two plain sentences saying what's in it, written like a friend describing it to another friend. No hype, no "In this recording".
- question: if the speaker ends by asking someone something (passing the conversation on), that question in a clean, short form; otherwise null.

Write in the same language as the transcript. The transcript is machine-made and may have errors; don't repeat obvious mistakes. If there's too little to go on, keep the title simple (e.g. "A quick hello") and the summary to a few words.`;

async function suggest(transcript: string) {
  if (!Deno.env.get('ANTHROPIC_API_KEY') || !transcript.trim()) return null;
  const anthropic = new Anthropic();
  try {
    const res = await anthropic.beta.messages.create({
      model: SUGGEST_MODEL,
      max_tokens: 4000,
      // If a safety classifier declines, re-run on Anthropic's recommended
      // fallback model rather than returning nothing.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Short, well-defined writing: low effort is plenty.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: SUGGESTION_SCHEMA },
      },
      system: SUGGEST_SYSTEM,
      messages: [{ role: 'user', content: `<transcript>\n${transcript}\n</transcript>` }],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return null;
    const text = res.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');
    const out = JSON.parse(text);
    return {
      title: String(out.title || '').trim().slice(0, 140),
      summary: String(out.summary || '').trim().slice(0, 600),
      question: out.question ? String(out.question).trim().slice(0, 500) : null,
    };
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error('suggest', err.status, err.message);
    else console.error('suggest', (err as Error).message);
    return null;
  }
}

// The signed-in user's id, from the (already verified) bearer token.
function callerId(req: Request): string | null {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).sub || null;
  } catch {
    return null;
  }
}

// ---- Handler ------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply({});
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);

  const body = await req.json().catch(() => ({}));
  const castId: string | undefined = body.cast_id;
  const noteId: string | undefined = body.note_id;
  const audioPath: string | undefined = body.audio_path;
  const wantSuggestion = body.suggest === true;
  if (!castId && !noteId && !audioPath) {
    return reply({ error: 'cast_id, note_id or audio_path required' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { authorization: req.headers.get('authorization') || '' } },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const key = Deno.env.get('GROQ_API_KEY');

  // Transcribe one file (unless it already has a transcript), filing it under
  // its cast or note. Returns the row, or null if it couldn't be done.
  async function ensure(path: string, owner: { cast_id?: string; note_id?: string }) {
    const { data: existing } = await admin
      .from('transcripts')
      .select('audio_path, cast_id, note_id, segments, text, language')
      .eq('audio_path', path)
      .maybeSingle();
    if (existing) {
      // Transcribed as a fresh upload before it became part of something.
      if ((owner.cast_id && !existing.cast_id) || (owner.note_id && !existing.note_id)) {
        await admin.from('transcripts').update(owner).eq('audio_path', path);
      }
      return existing;
    }
    if (!key) throw new Error('transcription is not set up (no GROQ_API_KEY)');
    const { data: signed, error } = await admin.storage.from('casts').createSignedUrl(path, 600);
    if (error || !signed) throw error || new Error('could not sign audio');
    const t = await transcribe(signed.signedUrl, key);
    const row = { audio_path: path, ...owner, ...t };
    const { error: saveError } = await admin.from('transcripts').upsert(row);
    if (saveError) throw saveError;
    return row;
  }

  // A fresh upload of your own.
  if (audioPath) {
    // The gateway has already verified this token (verify_jwt), so its
    // subject is the caller.
    if (!callerId(req) || audioPath.split('/')[0] !== callerId(req)) {
      return reply({ error: 'not yours' }, 403);
    }
    try {
      const row = await ensure(audioPath, {});
      const suggestion = wantSuggestion ? await suggest(row.text) : undefined;
      return reply({ transcripts: [row], pending: false, suggestion });
    } catch (err) {
      console.error('transcribe upload', (err as Error).message);
      return reply({ transcripts: [], pending: true, suggestion: null });
    }
  }

  // A voice note: just its one recording.
  if (noteId) {
    const { data: note } = await asCaller
      .from('voice_notes')
      .select('id, audio_path')
      .eq('id', noteId)
      .maybeSingle();
    if (!note) return reply({ error: 'not found' }, 404);
    try {
      const row = await ensure(note.audio_path, { note_id: note.id });
      return reply({ transcripts: [row], pending: false });
    } catch (err) {
      console.error('transcribe note', noteId, (err as Error).message);
      return reply({ transcripts: [], pending: true });
    }
  }

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

  const errors: string[] = [];
  const rows = [];
  for (const path of paths.filter(Boolean)) {
    try {
      rows.push(await ensure(path, { cast_id: castId }));
    } catch (err) {
      errors.push(`${path}: ${(err as Error).message}`);
    }
  }
  if (errors.length) console.error('transcribe', castId, errors);

  const suggestion = wantSuggestion
    ? await suggest(rows.map((r) => r.text).filter(Boolean).join('\n\n'))
    : undefined;
  return reply({
    transcripts: rows.map(({ audio_path, segments, text, language }) => ({
      audio_path,
      segments,
      text,
      language,
    })),
    pending: errors.length > 0,
    suggestion,
  });
});
