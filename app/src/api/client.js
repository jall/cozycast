import { Platform } from 'react-native';
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

// Upload a blob to the casts bucket. On web we use XHR so we can report upload
// progress — supabase-js's upload() exposes none. Elsewhere (and whenever no
// progress callback is supplied, e.g. in tests) we use the SDK. The content-type
// is set explicitly so the bucket's audio/* restriction sees the real type.
async function uploadAudio(path, blob, contentType, onProgress) {
  if (onProgress && Platform.OS === 'web' && typeof XMLHttpRequest !== 'undefined') {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/casts/${path}`);
      xhr.setRequestHeader('authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('cache-control', 'max-age=3600');
      if (contentType) xhr.setRequestHeader('content-type', contentType);
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

  const { error } = await supabase.storage.from('casts').upload(path, blob, { contentType });
  if (error) throw error;
}

// The feed is everything the current user can access — RLS already limits this
// to casts they created, are the sharer of, are tagged in, or were shared with.
export async function getFeed() {
  const { data, error } = await supabase
    .from('casts')
    .select(
      `
      *,
      creator:profiles!casts_creator_id_fkey(id, name, email),
      sharer:profiles!casts_sharer_id_fkey(id, name, email),
      cast_participants(profile_id, name),
      cast_recipients(recipient_id)
      `,
    )
    .order('created_at', { ascending: false });

  if (error) throw error;

  const uid = await currentUserId();

  return (data || []).map((cast) => ({
    ...cast,
    creator_name: cast.creator?.name || 'Someone',
    creator_email: cast.creator?.email || '',
    sharer_name: cast.sharer?.name || cast.creator?.name || 'Someone',
    sharer_id: cast.sharer_id || cast.creator?.id,
    participants: (cast.cast_participants || []).map((p) => p.name),
    recipient_count: (cast.cast_recipients || []).length,
    // Did this land in my feed because someone shared it with me (vs. mine)?
    shared_with_me: cast.creator?.id !== uid,
  }));
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
  const response = await fetch(audioUri);
  const blob = await response.blob();

  await uploadAudio(fileName, blob, contentType, onProgress);

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

export async function getAudioUrl(audioPath) {
  const { data } = await supabase.storage.from('casts').createSignedUrl(audioPath, 3600); // 1 hour
  return data?.signedUrl;
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
