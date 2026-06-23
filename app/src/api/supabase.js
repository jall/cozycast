import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 12-factor: config comes from the environment (Netlify build env / local
// .env), never the repo. EXPO_PUBLIC_* vars are inlined at build time.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase config: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
      '(see .env.example).',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, parse auth params from the URL so password-recovery (and email
    // confirmation) links establish a session when the user lands back here.
    // Native has no URL to parse.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
