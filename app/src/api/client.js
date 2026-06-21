import { supabase } from './supabase';

async function currentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
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
}) {
  const userId = await currentUserId();

  // Upload audio into the creator's own folder (storage RLS keys off this).
  const fileName = `${userId}/${Date.now()}.m4a`;
  const response = await fetch(audioUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('casts')
    .upload(fileName, blob, { contentType: 'audio/m4a' });

  if (uploadError) throw uploadError;

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
