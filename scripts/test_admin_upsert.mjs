import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log('Testing RPC or querying users/profiles tables...');
    
    // Select 1 user from users or profiles
    const { data: users, error: err1 } = await supabase.from('users').select('*').limit(5);
    console.log('Users sample:', users, err1);

    const { data: profiles, error: err2 } = await supabase.from('profiles').select('*').limit(5);
    console.log('Profiles sample:', profiles, err2);
}

testRpc();
