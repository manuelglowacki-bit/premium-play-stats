import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://azgksiwcgvbertzzzhvq.supabase.co';
const supabaseKey = 'sb_publishable_NwALJ8h6gzAlC-GgiqnFow_Ol45BzTj';

export const supabase = createClient(supabaseUrl, supabaseKey);
