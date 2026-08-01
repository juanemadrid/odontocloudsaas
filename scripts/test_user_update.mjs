import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUserUpdate() {
    console.log('Fetching profiles...');
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) console.error('Error fetching profiles:', error);
    else console.log('Profiles count:', profiles?.length, profiles);
}

testUserUpdate();
