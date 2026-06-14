import { supabase } from './supabase';

export async function getFeed() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get friend IDs
  const { data: friendships } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', user.id);

  const friendIds = (friendships || []).map((f) => f.friend_id);
  const visibleIds = [user.id, ...friendIds];

  const { data, error } = await supabase
    .from('casts')
    .select('*, profiles!casts_creator_id_fkey(name, email)')
    .in('creator_id', visibleIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Flatten the joined profile data
  return (data || []).map((cast) => ({
    ...cast,
    creator_name: cast.profiles?.name || 'Someone',
    creator_email: cast.profiles?.email || '',
  }));
}

export async function uploadCast({ title, description, participants, audioUri, duration }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Upload audio to storage
  const fileName = `${user.id}/${Date.now()}.m4a`;
  const response = await fetch(audioUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('casts')
    .upload(fileName, blob, { contentType: 'audio/m4a' });

  if (uploadError) throw uploadError;

  // Insert cast record
  const { data, error } = await supabase
    .from('casts')
    .insert({
      creator_id: user.id,
      title,
      description: description || null,
      participants: participants || null,
      audio_path: fileName,
      duration: duration || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAudioUrl(audioPath) {
  const { data } = await supabase.storage.from('casts').createSignedUrl(audioPath, 3600); // 1 hour expiry
  return data?.signedUrl;
}

export async function getFriends() {
  const { data, error } = await supabase
    .from('friendships')
    .select('profiles!friendships_friend_id_fkey(id, name, email)')
    .eq('user_id', (await supabase.auth.getUser()).data.user.id);

  if (error) throw error;
  return (data || []).map((f) => f.profiles);
}

export async function generateInvite() {
  const { data, error } = await supabase.rpc('generate_invite_code');
  if (error) throw error;
  return data; // returns the code string
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
