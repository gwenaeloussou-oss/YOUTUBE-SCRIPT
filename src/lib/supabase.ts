import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  console.error('⚠️ Variables Supabase manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-key'
);
