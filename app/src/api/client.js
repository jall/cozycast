import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

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
  cast_recipients(recipient_id)
`;

// Flatten a joined cast row into the shape the UI consumes. `uid` is the
// current user, used to decide whether the cast was shared *with* them.
function mapCast(cast, uid) {
  return {
    ...cast,
    creator_name: cast.creator?.name || 'Someone',
    creator_email: cast.creator?.email || '',
    sharer_name: cast.sharer?.name || cast.creator?.name || 'Someone',
    sharer_id: cast.sharer_id || cast.creator?.id,
    participants: (cast.cast_participants || []).map((p) => p.name),
    recipient_count: (cast.cast_recipients || []).length,
    // Did this land in my feed because someone shared it with me (vs. mine)?
    shared_with_me: cast.creator?.id !== uid,
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
  return (data || []).map((cast) => mapCast(cast, uid));
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
  return mapCast(data, uid);
}

// Create a cast: upload the audio, insert the row, then tag participants.
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
}) {
  const userId = await currentUserId();

  // Upload audio into the creator's own folder (storage RLS keys off this).
  const contentType = mimeType || 'audio/m4a';
  const fileName = `${userId}/${Date.now()}.${extFromMime(mimeType)}`;

  await uploadAudio(fileName, audioUri, contentType, onProgress);

  const { data: cast, error } = await supabase
    .from('casts')
    .insert({
      creator_id: userId,
      sharer_id: sharerId || userId,
      title,
      summary: summary || null,
      audio_path: fileName,
      duration: duration || null,
    })
    .select()
    .single();

  if (error) throw error;

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

  return cast;
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
  return (data || []).map((r) => r.profiles).filter(Boolean);
}

export async function updateCastSummary(castId, summary) {
  const { error } = await supabase
    .from('casts')
    .update({ summary: summary || null })
    .eq('id', castId);
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

// ---- Comments (RLS: anyone with cast access can read/post; author or cast
// manager can delete) -------------------------------------------------------

function mapComment(row, uid) {
  return {
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    author_id: row.author?.id || null,
    author_name: row.author?.name || 'Someone',
    mine: !!uid && row.author?.id === uid,
  };
}

export async function getComments(castId) {
  const { data, error } = await supabase
    .from('cast_comments')
    .select('id, body, created_at, author:profiles!cast_comments_author_id_fkey(id, name)')
    .eq('cast_id', castId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const uid = await currentUserId();
  return (data || []).map((row) => mapComment(row, uid));
}

export async function addComment(castId, body) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('cast_comments')
    .insert({ cast_id: castId, author_id: userId, body })
    .select('id, body, created_at, author:profiles!cast_comments_author_id_fkey(id, name)')
    .single();
  if (error) throw error;
  return mapComment(data, userId);
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from('cast_comments').delete().eq('id', commentId);
  if (error) throw error;
}

// Your address book: the people you can choose to share with.
export async function getFriends() {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('friendships')
    .select('profiles!friendships_friend_id_fkey(id, name, email)')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map((f) => f.profiles).filter(Boolean);
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

export async function redeemInvite(code) {
  const { error } = await supabase.rpc('redeem_invite', { invite_code: code });
  if (error) throw error;
}
