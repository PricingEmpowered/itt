import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function syncApprovals() {
  console.log('Syncing approval queue with pending quotes...');

  // Get all quotes with "Pending Approval" status
  const { data: pendingQuotes, error: quotesError } = await supabase
    .from('quotes')
    .select('*')
    .eq('status', 'Pending Approval');

  if (quotesError) {
    console.error('Error fetching pending quotes:', quotesError);
    return;
  }

  console.log(`Found ${pendingQuotes?.length || 0} quotes with Pending Approval status`);

  if (!pendingQuotes || pendingQuotes.length === 0) {
    console.log('No pending quotes found. Creating some sample pending quotes...');
    
    // Get some draft quotes and mark them as pending
    const { data: draftQuotes } = await supabase
      .from('quotes')
      .select('*')
      .eq('status', 'Draft')
      .limit(15);

    if (draftQuotes && draftQuotes.length > 0) {
      // Update these quotes to Pending Approval
      for (const quote of draftQuotes) {
        await supabase
          .from('quotes')
          .update({ 
            status: 'Pending Approval',
            approval_requested_at: new Date().toISOString()
          })
          .eq('id', quote.id);
      }
      
      console.log(`Updated ${draftQuotes.length} quotes to Pending Approval status`);
      
      // Re-fetch pending quotes
      const { data: newPendingQuotes } = await supabase
        .from('quotes')
        .select('*')
        .eq('status', 'Pending Approval');
      
      if (newPendingQuotes) {
        await createApprovalRequests(newPendingQuotes);
      }
    }
  } else {
    await createApprovalRequests(pendingQuotes);
  }
}

async function createApprovalRequests(quotes: any[]) {
  console.log(`Creating approval requests for ${quotes.length} quotes...`);

  for (const quote of quotes) {
    // Check if approval request already exists
    const { data: existingApproval } = await supabase
      .from('approval_requests')
      .select('id')
      .eq('quote_id', quote.id)
      .eq('status', 'Pending')
      .maybeSingle();

    if (existingApproval) {
      console.log(`Approval request already exists for quote ${quote.id}`);
      continue;
    }

    // Determine approval level based on quote value and margin
    const margin = ((quote.total - (quote.total * 0.7)) / quote.total) * 100; // Simplified margin calc
    let approvalLevel = 1;
    let reason = 'Standard approval required';

    if (quote.total > 500000) {
      approvalLevel = 4;
      reason = 'High value quote requires executive approval';
    } else if (quote.total > 250000) {
      approvalLevel = 3;
      reason = 'Large quote requires senior management approval';
    } else if (quote.total > 100000 || margin < 25) {
      approvalLevel = 2;
      reason = 'Quote value or margin requires manager approval';
    }

    // Create approval request
    const { error: insertError } = await supabase
      .from('approval_requests')
      .insert({
        quote_id: quote.id,
        requested_by: quote.created_by,
        requested_at: quote.approval_requested_at || new Date().toISOString(),
        approver_role: getApproverRole(approvalLevel),
        status: 'Pending',
        reason: reason,
        approval_level_required: approvalLevel,
        approval_sequence: 1
      });

    if (insertError) {
      console.error(`Error creating approval for quote ${quote.id}:`, insertError);
    } else {
      console.log(`✓ Created approval request for quote ${quote.id} (Level ${approvalLevel})`);
    }
  }
}

function getApproverRole(level: number): string {
  switch (level) {
    case 1: return 'Sales Manager';
    case 2: return 'Regional Director';
    case 3: return 'VP of Sales';
    case 4: return 'CFO';
    default: return 'Sales Manager';
  }
}

syncApprovals()
  .then(() => {
    console.log('✅ Approval sync complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error syncing approvals:', error);
    process.exit(1);
  });
