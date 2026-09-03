import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkQuotes() {
  const { data: quotes } = await supabase
    .from('quotes')
    .select('status')
    .limit(100);

  const statusCounts: { [key: string]: number } = {};
  
  quotes?.forEach(q => {
    statusCounts[q.status] = (statusCounts[q.status] || 0) + 1;
  });

  console.log('Quote statuses:', statusCounts);
}

checkQuotes();
