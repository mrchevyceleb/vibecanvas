import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://xcjqilfhlwbykckzdzry.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjanFpbGZobHdieWtja3pkenJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MjQzMjIsImV4cCI6MjA3ODMwMDMyMn0.n7VzSZmCxTQR4yeajgUlWoYTvk_QamK0ARFbT3Lmr7E';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);