
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manual .env parsing
try {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split(/\r?\n/).forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                if (key && !process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    }
} catch (e) {
    console.error('Could not read .env.local', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const slug = 'mon-mariage';

    // 1. Check if event exists
    const { data: existing } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

    if (existing) {
        console.log(`Event '${slug}' already exists. ID: ${existing.id}`);
    } else {
        console.log(`Event '${slug}' not found. Creating it...`);
        const { data, error } = await supabase
            .from('events')
            .insert([
                {
                    name: 'Léa & Thomas',
                    slug: slug,
                    date: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating event:', error);
        } else {
            console.log(`Event created successfully! ID: ${data.id}`);
        }
    }
}

main();
