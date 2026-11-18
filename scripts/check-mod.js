
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumn() {
    console.log('Checking event "mon-mariage"...');

    // Try to select the column specifically
    const { data, error } = await supabase
        .from('events')
        .select('id, name, moderation_enabled')
        .eq('slug', 'mon-mariage')
        .single();

    if (error) {
        console.error('Error fetching event:', error);
        if (error.message.includes('does not exist')) {
            console.log('❌ Column moderation_enabled DOES NOT EXIST.');
        }
    } else {
        console.log('✅ Event found:', data);
        console.log('moderation_enabled value:', data.moderation_enabled);

        // Test Update
        console.log('Attempting to set moderation_enabled = true...');
        const { error: updateError } = await supabase
            .from('events')
            .update({ moderation_enabled: true })
            .eq('id', data.id);

        if (updateError) {
            console.error('Update failed:', updateError);
        } else {
            console.log('✅ Update successful! Moderation is ON.');

            // Insert a dummy pending photo for testing
            console.log('Inserting dummy pending photo...');
            const { error: photoError } = await supabase
                .from('photos')
                .insert({
                    event_id: data.id,
                    storage_path: 'demo/test-photo.jpg', // Fake path, visual might be broken but card will show
                    status: 'pending',
                    caption: 'Test Photo from Agent'
                });

            if (photoError) console.error('Photo Insert Failed:', photoError);
            else console.log('✅ Pending photo inserted.');
        }
    }
}

checkColumn();
