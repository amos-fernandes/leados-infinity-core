
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import readline from 'readline';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env file.');
  console.log('Please add SUPABASE_SERVICE_ROLE_KEY to your .env file to run this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('WARNING: This will delete ALL data from the "leads" table.');
console.log('This action cannot be undone.');

rl.question('Are you sure you want to proceed? (type "yes" to confirm): ', async (answer) => {
  if (answer.toLowerCase() !== 'yes') {
    console.log('Operation cancelled.');
    process.exit(0);
  }

  try {
    console.log('Deleting all leads...');
    
    // Using delete with a filter that matches all rows is one way, 
    // but TRUNCATE is not directly exposed via JS client usually without RPC.
    // However, delete with neq constraint on a primary key or similar might work,
    // or just deleting where id is not null.
    
    // Assuming 'id' exists and is not null.
    const { error, count } = await supabase
      .from('leads')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything where ID is not a dummy UUID

    if (error) {
      throw error;
    }

    console.log(`Successfully deleted ${count} leads.`);
  } catch (error) {
    console.error('Error deleting leads:', error);
  } finally {
    rl.close();
    process.exit(0);
  }
});
