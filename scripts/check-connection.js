
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manual .env parser
function parseEnv(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let value = match[2] || '';
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.replace(/^"|"$/g, '');
            }
            env[match[1]] = value;
        }
    });
    return env;
}

const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = parseEnv(envPath);

if (!envConfig) {
    console.error('❌ Error: Could not find or read .env.local');
    process.exit(1);
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing keys in .env.local. Found:', Object.keys(envConfig));
    process.exit(1);
}

console.log(`✅ Keys found. Testing connection...`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        // Try to select from 'events' - even if empty it should return success (count 0 or [])
        const { data, error, count } = await supabase.from('events').select('*', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Connection Failed:', error.message);
            console.error('   Details:', error);
        } else {
            console.log('✅ Connection Successful! Supabase is reachable.');
        }
    } catch (err) {
        console.error('❌ Unexpected Error:', err.message);
    }
}

testConnection();
