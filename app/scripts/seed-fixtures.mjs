/* eslint-env node */
// ============================================================
// CozyCast: local / dev storage fixtures
// ============================================================
// supabase/seed.sql (applied by `supabase db reset`) seeds the relational
// fixtures — users, friendships, casts, participants, recipients. What SQL
// can't do is put files in storage, so the seeded casts point at audio objects
// that don't exist and playback won't resolve. This script fills that gap: it
// uploads a small placeholder audio clip to each seeded cast's audio_path so the
// detail page and player actually work end to end (handy for signed-in e2e).
//
// SAFETY: this writes with the service-role key (bypasses RLS), so it refuses to
// run against anything that isn't the local stack. The production project ref is
// hard-blocked; any non-local URL needs an explicit ALLOW_REMOTE_FIXTURES=1.
//
// Run it via `npm run fixtures` (or `npm run dev:seed` to reset + seed in one go).
// ============================================================
import { createClient } from '@supabase/supabase-js';

// The production project ref — never seed against this, no matter what.
const PROD_PROJECT_REF = 'yhaswqvewhigrpoduhyr';

// Supabase's local stack uses a fixed, publicly-documented service-role key
// (same for every `supabase start`), so defaulting to it for localhost is safe
// — it grants nothing beyond a machine-local dev database.
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

// Must match the audio_path values in supabase/seed.sql.
const SEED_AUDIO_PATHS = ['seed/late-night-kitchen.m4a', 'seed/the-walk.m4a'];

// A tiny valid WAV (1s of silence, 8kHz mono 16-bit) — enough for the player to
// load and the detail page to resolve a signed URL. Content type is audio/wav;
// the .m4a path extension is cosmetic (the browser plays by content type).
function makeSilentWav({ seconds = 1, sampleRate = 8000 } = {}) {
  const numSamples = seconds * sampleRate;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf; // samples left as zero = silence
}

function resolveTarget() {
  const url =
    process.env.FIXTURES_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    LOCAL_URL;

  if (url.includes(PROD_PROJECT_REF)) {
    throw new Error(
      `Refusing to seed fixtures against the production project (${PROD_PROJECT_REF}).`,
    );
  }

  const isLocal = /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal)(:|\/|$)/.test(
    url,
  );
  if (!isLocal && process.env.ALLOW_REMOTE_FIXTURES !== '1') {
    throw new Error(
      `Refusing to seed fixtures against a non-local URL (${url}). ` +
        `Set ALLOW_REMOTE_FIXTURES=1 only if this is a throwaway dev project.`,
    );
  }

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || (isLocal ? LOCAL_SERVICE_ROLE_KEY : null);
  if (!serviceKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for a non-local target.');
  }

  return { url, serviceKey, isLocal };
}

async function main() {
  const { url, serviceKey } = resolveTarget();
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const audio = makeSilentWav();

  console.log(`Seeding storage fixtures → ${url}`);
  for (const path of SEED_AUDIO_PATHS) {
    const { error } = await supabase.storage
      .from('casts')
      .upload(path, audio, { contentType: 'audio/wav', upsert: true });
    if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
    console.log(`  ✓ ${path}`);
  }
  console.log('Done. Seeded casts now have playable audio.');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
