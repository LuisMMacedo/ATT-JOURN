import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kzeeujqyxzgdggxettdu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A2uSS51a_Maz1-Z-2YXL6g_d0Qnhn_I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
