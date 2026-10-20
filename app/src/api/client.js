import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { computePeaks } from '../utils/peaks';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function currentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
}

// Map an audio mime type to a file extension. Defaults to m4a (the recorder's
// output) when unknown so existing behaviour is preserved.
const MIME_EXT = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

function extFromMime(mime) {
  return MIME_EXT[mime] || 'm4a';
}

const IMAGE_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

async function storageHeaders(contentType) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    authorization: `Bearer ${session?.access_token}`,
    apikey: SUPABASE_ANON_KEY,
    'x-upsert': 'false',
    'cache-control': 'max-age=3600',
    ...(contentType ? { 'content-type': contentType } : {}),
  };
}

// Upload audio to the casts bucket, reporting progress when a callback is given.
// supabase-js's upload() exposes no progress, so for the progress path we hit the
// storage REST endpoint directly: XHR on web, expo-file-system (streamed from
// disk) on native. Without a callback — or in tests — we use the SDK. The
// content-type is set explicitly so the bucket's audio/* restriction sees the
// real type. `uri` is the local file; `path` is the destination in the bucket.
async function uploadAudio(path, uri, contentType, onProgress) {
  const endpoint = `${SUPABASE_URL}/storage/v1/object/casts/${path}`;

  // Native: stream the file from disk so memory stays flat and we get progress.
  if (onProgress && Platform.OS !== 'web') {
    const task = FileSystem.createUploadTask(
      endpoint,
      uri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: await storageHeaders(contentType),
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (totalBytesExpectedToSend > 0) onProgress(totalBytesSent / totalBytesExpectedToSend);
      },
    );
    const res = await task.uploadAsync();
    if (!res || res.status < 200 || res.status >= 300)
      throw new Error(`Upload failed (${res?.status}).`);
    return;
  }

  // Web: XHR gives us upload.onprogress events the SDK doesn't.
  if (onProgress && Platform.OS === 'web' && typeof XMLHttpRequest !== 'undefined') {
    const blob = await (await fetch(uri)).blob();
    const headers = await storageHeaders(contentType);
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed (${xhr.status}).`));
      xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
      xhr.send(blob);
    });
    return;
  }

  // Fallback (no progress callback, e.g. tests): the SDK.
  const blob = await (await fetch(uri)).blob();
  const { error } = await supabase.storage.from('casts').upload(path, blob, { contentType });
  if (error) throw error;
}

// The joins the feed and the detail page both need on a cast row.
const CAST_SELECT = `
  *,
  creator:profiles!casts_creator_id_fkey(id, name, email),
  sharer:profiles!casts_sharer_id_fkey(id, name, email),
  cast_participants(profile_id, name),
  cast_recipients(recipient_id),
  cast_comments(count)
`;

// Which casts the current user has listened to. Fetched separately (not embedded
// in CAST_SELECT) so the feed/detail still work if the cast_plays table isn't
// there yet — e.g. a deploy preview pointing at a prod DB without the migration.
// Degrades to "nothing played" rather than failing the whole query.
async function fetchPlayedIds() {
  const { data, error } = await supabase.from('cast_plays').select('cast_id');
  if (error) return new Set();
  return new Set((data || []).map((r) => r.cast_id));
}

// Avatar paths for a set of users, as a Map(id -> avatar_path). Fetched
// separately (not embedded in the joins) for the same reason as fetchPlayedIds:
// so the feed/detail/comments still load if the profiles.avatar_path column
// isn't there yet — e.g. a deploy preview pointing at a prod DB before this
// migration lands. Degrades to "no avatars" (initials) rather than erroring.
async function fetchAvatars(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (unique.length === 0) return new Map();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, avatar_path')
      .in('id', unique);
    if (error) return new Map();
    return new Map((data || []).map((r) => [r.id, r.avatar_path || null]));
  } catch {
    return new Map();
  }
}

// The turns of casts made together ({ [castId]: turns[] }, in order). Fetched
// separately, like fetchPlayedIds, so a database without cast_turns yet still
// serves the feed — those casts just play as their first take.
async function fetchTurns(rows) {
  const ids = (rows || []).filter((c) => c.together).map((c) => c.id);
  if (ids.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('cast_turns')
      .select('id, cast_id, author_id, position, audio_path, duration, peaks, question, created_at')
      .in('cast_id', ids)
      .order('position', { ascending: true });
    if (error) return {};
    const byCast = {};
    (data || []).forEach((t) => {
      (byCast[t.cast_id] = byCast[t.cast_id] || []).push(t);
    });
    return byCast;
  } catch {
    return {};
  }
}

// Flatten a joined cast row into the shape the UI consumes. `uid` is the
// current user, used to decide whether the cast was shared *with* them and
// whether they may manage it. `avatars` maps user id -> avatar_path.
function mapCast(cast, uid, played = false, avatars = new Map(), turns = []) {
  const creatorId = cast.creator?.id || cast.creator_id;
  const sharerId = cast.sharer_id || creatorId;
  const participantIds = (cast.cast_participants || []).map((p) => p.profile_id).filter(Boolean);
  return {
    ...cast,
    creator_id: creatorId,
    creator_name: cast.creator?.name || 'Someone',
    creator_email: cast.creator?.email || '',
    creator_avatar: avatars.get(creatorId) || null,
    sharer_name: cast.sharer?.name || cast.creator?.name || 'Someone',
    sharer_id: sharerId,
    sharer_avatar: avatars.get(sharerId) || avatars.get(creatorId) || null,
    participants: (cast.cast_participants || []).map((p) => p.name),
    participant_ids: participantIds,
    // Names with their profile (when they're on cozycast), for linking to them.
    participant_people: (cast.cast_participants || []).map((p) => ({
      name: p.name,
      id: p.profile_id || null,
    })),
    recipient_ids: (cast.cast_recipients || []).map((r) => r.recipient_id),
    recipient_count: (cast.cast_recipients || []).length,
    comment_count: cast.cast_comments?.[0]?.count ?? 0,
    // Did this land in my feed because someone shared it with me (vs. mine)?
    shared_with_me: creatorId !== uid,
    // Everyone in it may choose who hears it (matches can_manage_cast): its
    // creator, anyone tagged, and a nominated sharer on older casts.
    can_manage: creatorId === uid || sharerId === uid || participantIds.includes(uid),
    // Creator or nominated sharer: may update the row itself (e.g. its peaks).
    owns: creatorId === uid || sharerId === uid,
    // Made in turns ("pass the mic"): its takes, in order.
    together: !!cast.together,
    turns: cast.together ? turns : [],
    // Have I listened to it?
    played,
  };
}

// The feed is everything the current user can access — RLS already limits this
// to casts they created, are the sharer of, are tagged in, or were shared with.
export async function getFeed() {
  const { data, error } = await supabase
    .from('casts')
    .select(CAST_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const uid = await currentUserId();
  const playedIds = await fetchPlayedIds();
  const rows = data || [];
  const [avatars, turns] = await Promise.all([
    fetchAvatars(rows.flatMap((c) => [c.creator?.id, c.sharer?.id])),
    fetchTurns(rows),
  ]);
  return rows.map((cast) => mapCast(cast, uid, playedIds.has(cast.id), avatars, turns[cast.id]));
}

// A single cast by id, for the detail page / deep links. Returns null when the
// row isn't visible to the user (RLS) or doesn't exist, so callers can show a
// friendly "not available" state rather than crashing.
export async function getCast(castId) {
  const { data, error } = await supabase
    .from('casts')
    .select(CAST_SELECT)
    .eq('id', castId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const uid = await currentUserId();
  const playedIds = await fetchPlayedIds();
  const [avatars, turns] = await Promise.all([
    fetchAvatars([data.creator?.id, data.sharer?.id]),
    fetchTurns([data]),
  ]);
  return mapCast(data, uid, playedIds.has(data.id), avatars, turns[data.id]);
}

// Mark a cast as listened-to by the current user (first play wins). Used by the
// calm home to know which received casts are still "unheard". Idempotent.
export async function markPlayed(castId) {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('cast_plays')
    .upsert(
      { cast_id: castId, user_id: userId },
      { onConflict: 'cast_id,user_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

// Create a cast: upload the audio, insert the row, then tag participants.
// Sharing with specific recipients is a separate, deliberate step (shareCast).
// Start uploading a recording straight away — while its maker is still
// writing the title — and measure its waveform alongside. Returns { path,
// uploaded, peaks }: `uploaded` settles when the audio is safely in storage,
// `peaks` with the waveform (or null). Hand it to createCast.
export async function beginCastUpload({ audioUri, mimeType, onProgress }) {
  const userId = await currentUserId();
  // A browser recording doesn't say what it is: ask the blob (WebM on most
  // browsers, MP4 on Safari) rather than labelling everything .m4a.
  let mime = mimeType;
  if (!mime && Platform.OS === 'web' && audioUri) {
    try {
      mime = ((await (await fetch(audioUri)).blob()).type || '').split(';')[0] || null;
    } catch {
      mime = null;
    }
  }
  // Into the creator's own folder (storage RLS keys off this).
  const contentType = mime || 'audio/m4a';
  const path = `${userId}/${Date.now()}.${extFromMime(mime)}`;
  // A CPU-bound decode (off the main thread) next to a network-bound upload.
  const peaks = computePeaks(audioUri).catch(() => null);
  const uploaded = uploadAudio(path, audioUri, contentType, onProgress);
  uploaded.catch(() => {}); // the caller awaits it; don't warn about it meanwhile
  return { path, uploaded, peaks };
}

// Throw away an upload that never became a cast (they cancelled). Best-effort.
export async function discardUpload(upload) {
  if (!upload) return;
  try {
    await upload.uploaded;
    await supabase.storage.from('casts').remove([upload.path]);
  } catch {
    // An orphaned file is harmless.
  }
}

// Create a cast: (finish) the upload, insert the row, then tag participants.
// Pass `upload` from beginCastUpload to reuse one already under way.
// Sharing with specific recipients is a separate, deliberate step (shareCast).
export async function createCast({
  title,
  summary,
  audioUri,
  duration,
  participants = [],
  sharerId,
  mimeType,
  onProgress,
  upload,
}) {
  const userId = await currentUserId();
  const up = upload || (await beginCastUpload({ audioUri, mimeType, onProgress }));
  await up.uploaded;

  const { data: cast, error } = await supabase
    .from('casts')
    .insert({
      creator_id: userId,
      sharer_id: sharerId || userId,
      title,
      summary: summary || null,
      audio_path: up.path,
      duration: duration || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Attach the waveform whenever the decode finishes — never hold up saving
  // the cast for it (a long cast can take several seconds to decode on a slow
  // device). If it's lost (tab closed, a database without the column yet), the
  // cast page backfills it the next time someone who manages the cast opens it.
  up.peaks.then((peaks) => peaks && savePeaks(cast.id, peaks)).catch(() => {});

  // Tag participants (those who are cozycast users carry a profile_id, which is
  // what grants them access to the cast).
  if (participants.length > 0) {
    const rows = participants.map((p) => ({
      cast_id: cast.id,
      profile_id: p.id || null,
      name: p.name,
    }));
    const { error: partError } = await supabase.from('cast_participants').insert(rows);
    if (partError) throw partError;
  }

  transcribeSoon(cast.id);
  return cast;
}

// ---- Voice notes (between two people; RLS: its sender and recipient) -------

const NOTE_SELECT = `id, from_id, to_id, cast_id, at_ms, audio_path, duration, peaks,
  created_at, heard_at, cast:casts!voice_notes_cast_id_fkey(id, title)`;

function mapNote(n) {
  return { ...n, cast_title: n.cast?.title || null };
}

// Every voice note to or from you, oldest first. Empty (not an error) on a
// database without voice notes yet.
export async function getVoiceNotes() {
  const { data, error } = await supabase
    .from('voice_notes')
    .select(NOTE_SELECT)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) return [];
  return (data || []).map(mapNote);
}

// Send a recorded note (an upload from beginCastUpload) to someone in your
// address book — just chat, or about a cast (and maybe a moment in it).
export async function sendVoiceNote({ toId, castId = null, atMs = null, upload, duration }) {
  await upload.uploaded;
  const { data, error } = await supabase
    .from('voice_notes')
    .insert({
      to_id: toId,
      cast_id: castId,
      at_ms: atMs == null ? null : Math.max(0, Math.round(atMs)),
      audio_path: upload.path,
      duration: duration || null,
    })
    .select(NOTE_SELECT)
    .single();
  if (error) throw error;
  upload.peaks
    .then(
      (peaks) =>
        peaks &&
        supabase
          .from('voice_notes')
          .update({ peaks })
          .eq('id', data.id)
          .then(() => {}),
    )
    .catch(() => {});
  requestNoteTranscript(data.id).catch(() => {});
  return mapNote(data);
}

// Take back a note you sent (and its audio, best-effort).
export async function unsendVoiceNote(note) {
  const { error } = await supabase.from('voice_notes').delete().eq('id', note.id);
  if (error) throw error;
  await supabase.storage
    .from('casts')
    .remove([note.audio_path])
    .catch(() => {});
}

export async function markNotesHeard(ids) {
  if (!ids || ids.length === 0) return;
  const { error } = await supabase.rpc('mark_notes_heard', { p_ids: ids });
  if (error) throw error;
}

export async function markAllNotesHeard() {
  const { error } = await supabase.rpc('mark_all_notes_heard');
  if (error) throw error;
}

// Notes waiting to be heard (for the badge). 0 when unavailable.
export async function getUnheardNoteCount() {
  const userId = await currentUserId();
  const { count, error } = await supabase
    .from('voice_notes')
    .select('id', { count: 'exact', head: true })
    .eq('to_id', userId)
    .is('heard_at', null);
  if (error) return 0;
  return count || 0;
}

// What was said in some notes: { [noteId]: text }.
export async function getNoteTranscripts(noteIds) {
  if (!noteIds || noteIds.length === 0) return {};
  const { data, error } = await supabase
    .from('transcripts')
    .select('note_id, text')
    .in('note_id', noteIds);
  if (error) return {};
  return Object.fromEntries((data || []).map((t) => [t.note_id, t.text]));
}

export async function requestNoteTranscript(noteId) {
  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { note_id: noteId },
  });
  if (error) throw error;
  return data?.transcripts?.[0]?.text ?? null;
}

// ---- Suggestions (drafted from what was said; see the transcribe function) --

// Words for a fresh upload of yours, before it's saved: { title, summary,
// question } or null (nothing said, or suggestions aren't set up).
export async function suggestFromUpload(audioPath) {
  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { audio_path: audioPath, suggest: true },
  });
  if (error) return null;
  return data?.suggestion || null;
}

// Words for an existing cast, from its transcripts.
export async function suggestForCast(castId) {
  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { cast_id: castId, suggest: true },
  });
  if (error) return null;
  return data?.suggestion || null;
}

// ---- Search (search_everything: full-text, as you; RLS decides) ------------

// [{ kind: 'cast'|'said'|'comment'|'note', cast_id, note_id, other_id, title,
// at_ms, snippet (matches in [[ ]]), created_at }]
export async function searchEverything(query) {
  const q = (query || '').trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc('search_everything', { p_query: q });
  if (error) throw error;
  return data || [];
}

// ---- Transcripts (written by the `transcribe` Edge Function) ---------------

// Ask for a cast's recordings to be transcribed (those that aren't yet).
// Resolves { transcripts, pending } — `pending` when some couldn't be done
// (e.g. transcription isn't set up on this project).
export async function requestTranscript(castId) {
  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { cast_id: castId },
  });
  if (error) throw error;
  return data || { transcripts: [], pending: true };
}

// Fire-and-forget after saving: the cast page picks the result up later.
function transcribeSoon(castId) {
  requestTranscript(castId).catch(() => {});
}

// What was said in a cast, per recording: [{ audio_path, segments: [{ s, e,
// t }], text, language }]. Empty (not an error) on a database without the
// transcripts table yet.
export async function getTranscripts(castId) {
  const { data, error } = await supabase
    .from('transcripts')
    .select('audio_path, segments, text, language')
    .eq('cast_id', castId);
  if (error) return [];
  return data || [];
}

// Store a cast's measured waveform (creator/sharer only, via RLS): right after
// create, and to backfill casts uploaded before peaks existed.
export async function savePeaks(castId, peaks) {
  const { error } = await supabase.from('casts').update({ peaks }).eq('id', castId);
  if (error) throw error;
}

// Share a cast with specific people. Only the creator/sharer may do this.
export async function shareCast(castId, recipientIds) {
  if (!recipientIds || recipientIds.length === 0) return;
  const sharedBy = await currentUserId();
  const rows = recipientIds.map((id) => ({
    cast_id: castId,
    recipient_id: id,
    shared_by: sharedBy,
  }));
  // Ignore re-shares to someone who already has it.
  const { error } = await supabase
    .from('cast_recipients')
    .upsert(rows, { onConflict: 'cast_id,recipient_id', ignoreDuplicates: true });
  if (error) throw error;
}

// Who has a cast been shared with? Returns recipient profiles.
export async function getRecipients(castId) {
  const { data, error } = await supabase
    .from('cast_recipients')
    .select('profiles!cast_recipients_recipient_id_fkey(id, name, email)')
    .eq('cast_id', castId);
  if (error) throw error;
  return withAvatars((data || []).map((r) => r.profiles));
}

// Stop sharing a cast with someone. Only the creator/sharer may do this (RLS
// cast_recipients_delete_manage); removing access they never had is a no-op.
export async function removeRecipient(castId, recipientId) {
  const { error } = await supabase
    .from('cast_recipients')
    .delete()
    .eq('cast_id', castId)
    .eq('recipient_id', recipientId);
  if (error) throw error;
}

// Edit a cast's words. Anyone in it can (creator, sharer, or tagged
// participant) — see update_cast_words.
export async function updateCast(castId, { title, summary }) {
  const title_ = (title || '').trim();
  if (!title_) throw new Error('A cast needs a title.');
  const { error } = await supabase.rpc('update_cast_words', {
    p_cast: castId,
    p_title: title_,
    p_summary: (summary || '').trim(),
  });
  if (error) throw error;
}

// ---- Pass the mic (casts made in turns; see add_cast_turn) ----------------

// Attach a turn's measured waveform when its decode finishes (never blocks).
function attachTurnPeaks(turnId, upload) {
  upload.peaks
    .then(
      (peaks) =>
        peaks &&
        supabase
          .from('cast_turns')
          .update({ peaks })
          .eq('id', turnId)
          .then(() => {}),
    )
    .catch(() => {});
}

// Start a cast made in turns: your first take (from beginCastUpload), the
// people you're making it with, and who you pass the mic to.
export async function startTogetherCast({ title, people, upload, duration, question, passTo }) {
  const userId = await currentUserId();
  await upload.uploaded;
  const { data: cast, error } = await supabase
    .from('casts')
    .insert({
      creator_id: userId,
      sharer_id: userId,
      title,
      audio_path: upload.path,
      duration: duration || null,
      together: true,
    })
    .select()
    .single();
  if (error) throw error;

  const rows = people.map((p) => ({ cast_id: cast.id, profile_id: p.id, name: p.name }));
  if (rows.length > 0) {
    const { error: partError } = await supabase.from('cast_participants').insert(rows);
    if (partError) throw partError;
  }

  const { data: turnId, error: turnError } = await supabase.rpc('add_cast_turn', {
    p_cast: cast.id,
    p_audio_path: upload.path,
    p_duration: duration || null,
    p_question: (question || '').trim() || null,
    p_pass_to: passTo,
  });
  if (turnError) throw turnError;
  // The first take's waveform is the cast's too (for anything that only
  // knows about one file).
  upload.peaks.then((peaks) => peaks && savePeaks(cast.id, peaks)).catch(() => {});
  if (turnId) attachTurnPeaks(turnId, upload);
  transcribeSoon(cast.id);
  return cast;
}

// Add your turn and pass the mic on — or, with `passTo` null, finish it.
export async function addTurn(castId, { upload, duration, question, passTo }) {
  await upload.uploaded;
  const { data: turnId, error } = await supabase.rpc('add_cast_turn', {
    p_cast: castId,
    p_audio_path: upload.path,
    p_duration: duration || null,
    p_question: (question || '').trim() || null,
    p_pass_to: passTo || null,
  });
  if (error) throw error;
  if (turnId) attachTurnPeaks(turnId, upload);
  transcribeSoon(castId);
}

// "We're done": any maker can finish it, whoever's turn it was.
export async function finishTogetherCast(castId) {
  const { error } = await supabase.rpc('finish_together_cast', { p_cast: castId });
  if (error) throw error;
}

// ---- Asking for a cast (cast_requests: visible to its two people only) -----

const REQUEST_SELECT = `id, prompt, created_at, answered_at, answered_cast_id, dismissed_at,
  from:profiles!cast_requests_from_id_fkey(id, name),
  to:profiles!cast_requests_to_id_fkey(id, name)`;

function mapRequest(r) {
  return {
    id: r.id,
    prompt: r.prompt,
    created_at: r.created_at,
    answered: !!r.answered_at,
    answered_cast_id: r.answered_cast_id,
    dismissed: !!r.dismissed_at,
    from: r.from || { id: null, name: 'Someone' },
    to: r.to || { id: null, name: 'Someone' },
  };
}

// Asks involving you: those waiting on you, and those you've sent. Empty (not
// an error) on a database that hasn't got cast_requests yet.
export async function getCastRequests() {
  const { data, error } = await supabase
    .from('cast_requests')
    .select(REQUEST_SELECT)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(mapRequest);
}

export async function askForCast(toId, prompt) {
  const text = (prompt || '').trim();
  if (!text) throw new Error('Write what you’d love to hear about.');
  const { data, error } = await supabase
    .from('cast_requests')
    .insert({ to_id: toId, prompt: text })
    .select(REQUEST_SELECT)
    .single();
  if (error) throw error;
  return mapRequest(data);
}

export async function answerCastRequest(requestId, castId) {
  const { error } = await supabase.rpc('answer_cast_request', {
    p_request: requestId,
    p_cast: castId,
  });
  if (error) throw error;
}

export async function dismissCastRequest(requestId) {
  const { error } = await supabase.rpc('dismiss_cast_request', { p_request: requestId });
  if (error) throw error;
}

export async function withdrawCastRequest(requestId) {
  const { error } = await supabase.from('cast_requests').delete().eq('id', requestId);
  if (error) throw error;
}

// Your bio (shown on your page to the people who can see you).
export async function updateBio(bio) {
  const userId = await currentUserId();
  const text = (bio || '').trim().slice(0, 280);
  const { error } = await supabase
    .from('profiles')
    .update({ bio: text || null })
    .eq('id', userId);
  if (error) throw error;
}

// Delete a cast you created. RLS allows the creator only; the child rows
// (participants/recipients) cascade. The audio object is cleaned up best-effort
// afterwards — an orphaned file is harmless, and a failed cleanup shouldn't make
// a successful delete look like it failed.
export async function deleteCast(castId, audioPath) {
  const { error } = await supabase.from('casts').delete().eq('id', castId);
  if (error) throw error;
  if (audioPath) {
    await supabase.storage
      .from('casts')
      .remove([audioPath])
      .catch(() => {});
  }
}

export async function getAudioUrl(audioPath) {
  const { data } = await supabase.storage.from('casts').createSignedUrl(audioPath, 3600); // 1 hour
  return data?.signedUrl;
}

// ---- Avatars (profile pictures; public bucket) -----------------------------

// Public URL for an avatar object path, or null when the user has no avatar.
// The bucket is public, so this URL is stable and needs no signing; each upload
// uses a fresh filename, so the URL changes when the avatar does (no stale cache).
export function avatarUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data?.publicUrl || null;
}

// Upload a new profile picture and point the user's profile at it. Uses a
// unique filename per change ("<uid>/<timestamp>.<ext>") for cache-busting, then
// removes the previous object best-effort (an orphan is harmless). Returns the
// new path so the caller can update local state without a refetch.
export async function uploadAvatar(uri, mimeType) {
  const userId = await currentUserId();
  if (!userId) throw new Error('You need to be signed in to set a picture.');

  // Read the blob first so we can trust its real mime type (the picker's
  // reported type is unreliable on web).
  const blob = await (await fetch(uri)).blob();
  const contentType = mimeType || blob.type || 'image/jpeg';
  const ext = IMAGE_EXT[contentType] || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType });
  if (uploadError) throw uploadError;

  // Read the old path before we overwrite it, so we can clean it up after.
  const { data: prev } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('id', userId)
    .single();

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId);
  if (updateError) throw updateError;

  if (prev?.avatar_path && prev.avatar_path !== path) {
    await supabase.storage
      .from('avatars')
      .remove([prev.avatar_path])
      .catch(() => {});
  }

  return path;
}

// ---- Comments (RLS: anyone with cast access can read/post; author or cast
// manager can delete) -------------------------------------------------------

function mapComment(row, uid, avatars = new Map()) {
  const authorId = row.author?.id || null;
  return {
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    // Where in the audio the note was left (ms), or null for a general comment.
    at_ms: typeof row.at_ms === 'number' ? row.at_ms : null,
    author_id: authorId,
    author_name: row.author?.name || 'Someone',
    author_avatar: avatars.get(authorId) || null,
    mine: !!uid && authorId === uid,
  };
}

const COMMENT_SELECT =
  'id, body, created_at, author:profiles!cast_comments_author_id_fkey(id, name)';

// Postgres "undefined column": the at_ms migration hasn't reached this database
// yet (e.g. a deploy preview pointed at prod before it lands). We retry without
// the column so comments keep working, just without moments.
function isMissingColumn(error) {
  return error?.code === '42703' || /at_ms/.test(error?.message || '');
}

export async function getComments(castId) {
  const query = (select) =>
    supabase
      .from('cast_comments')
      .select(select)
      .eq('cast_id', castId)
      .order('created_at', { ascending: true });
  let { data, error } = await query(`${COMMENT_SELECT}, at_ms`);
  if (error && isMissingColumn(error)) ({ data, error } = await query(COMMENT_SELECT));
  if (error) throw error;
  const uid = await currentUserId();
  const rows = data || [];
  const avatars = await fetchAvatars(rows.map((r) => r.author?.id));
  return rows.map((row) => mapComment(row, uid, avatars));
}

// Post a comment; pass `atMs` to pin it to a moment in the audio.
export async function addComment(castId, body, atMs = null) {
  const userId = await currentUserId();
  const base = { cast_id: castId, author_id: userId, body };
  const insert = (row, select) =>
    supabase.from('cast_comments').insert(row).select(select).single();
  let { data, error } =
    atMs == null
      ? await insert(base, COMMENT_SELECT)
      : await insert({ ...base, at_ms: Math.max(0, Math.round(atMs)) }, `${COMMENT_SELECT}, at_ms`);
  if (error && atMs != null && isMissingColumn(error)) {
    ({ data, error } = await insert(base, COMMENT_SELECT));
  }
  if (error) throw error;
  const avatars = await fetchAvatars([userId]);
  return mapComment(data, userId, avatars);
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from('cast_comments').delete().eq('id', commentId);
  if (error) throw error;
}

// ---- Notifications (your own inbox; rows are written by DB triggers) --------

const NOTIFICATION_SELECT = `id, type, cast_id, created_at, read_at,
  actor:profiles!notifications_actor_id_fkey(id, name),
  cast:casts!notifications_cast_id_fkey(title)`;

export async function getNotifications() {
  const query = (select) =>
    supabase
      .from('notifications')
      .select(select)
      .order('created_at', { ascending: false })
      .limit(50);
  // Asks carry their prompt; a database without cast_requests yet gets the rest.
  let { data, error } = await query(
    `${NOTIFICATION_SELECT}, request:cast_requests!notifications_request_id_fkey(prompt)`,
  );
  if (error) ({ data, error } = await query(NOTIFICATION_SELECT));
  if (error) throw error;
  return (data || []).map((n) => ({
    id: n.id,
    type: n.type,
    cast_id: n.cast_id,
    cast_title: n.cast?.title || 'a cast',
    actor_id: n.actor?.id || null,
    actor_name: n.actor?.name || 'Someone',
    prompt: n.request?.prompt || null,
    created_at: n.created_at,
    read: !!n.read_at,
  }));
}

export async function getUnreadNotificationCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count || 0;
}

// Mark all of my unread notifications as read (RLS limits this to my own).
export async function markNotificationsRead() {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

// Attach avatar_path to a list of profile objects via the tolerant lookup, so a
// missing column degrades to initials instead of failing the list.
async function withAvatars(profiles) {
  const list = (profiles || []).filter(Boolean);
  if (list.length === 0) return list;
  const avatars = await fetchAvatars(list.map((p) => p.id));
  return list.map((p) => ({ ...p, avatar_path: avatars.get(p.id) || null }));
}

// Your address book: the people you can choose to share with.
// One person, for their page: who they are and whether they're in your address
// book. (Profiles are readable by any signed-in user; casts stay behind RLS.)
export async function getPerson(personId) {
  const userId = await currentUserId();
  const [{ data: profile, error }, { data: link }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', personId).maybeSingle(),
    supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('friend_id', personId)
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (!profile) return null;
  const avatars = await fetchAvatars([personId]);
  return {
    id: profile.id,
    name: profile.name,
    bio: profile.bio || null,
    avatar_path: avatars.get(personId) || null,
    is_friend: !!link,
    is_me: personId === userId,
  };
}

export async function getFriends() {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('friendships')
    .select('profiles!friendships_friend_id_fkey(id, name, email)')
    .eq('user_id', userId);

  if (error) throw error;
  return withAvatars((data || []).map((f) => f.profiles));
}

export async function generateInvite() {
  const { data, error } = await supabase.rpc('generate_invite_code');
  if (error) throw error;
  return data; // the code string
}

export async function getPendingInvites() {
  const { data, error } = await supabase
    .from('invites')
    .select('code, created_at')
    .is('used_by', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Redeem an invite; resolves the inviter's name (or null on an older database
// whose RPC returns nothing).
export async function redeemInvite(code) {
  const { data, error } = await supabase.rpc('redeem_invite', { invite_code: code });
  if (error) throw error;
  return typeof data === 'string' ? data : null;
}
