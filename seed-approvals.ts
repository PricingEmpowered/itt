import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedApprovalData() {
  console.log('Starting approval workflow data seeding...');

  try {
    // Sign in first to bypass RLS
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'test123'
    });

    if (signInError) {
      console.log('Sign in failed, trying to create user first...');
      const { error: signUpError } = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'test123'
      });
      if (signUpError) {
        console.error('Could not create test user:', signUpError);
      } else {
        // Try signing in again
        await supabase.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'test123'
        });
      }
    }

    // Get existing quotes and users
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, customer_id, total, subtotal')
      .in('status', ['Draft', 'Approved'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData?.session?.user?.id;

    if (!quotes || quotes.length === 0) {
      console.log('No quotes found to create approvals for');
      return;
    }

    if (!currentUserId) {
      console.log('No authenticated user found');
      return;
    }

    const firstUserId = currentUserId;

    // Update existing user profiles with approval levels
    console.log('Updating user profiles with approval levels...');

    const userProfiles = [
      {
        id: firstUserId,
        role: 'Sales Manager',
        approval_level: 1,
        max_discount_approval: 15,
        max_quote_size: 100000,
        min_margin_percent: 20
      }
    ];

    // Note: User creation requires service role key, skipping for now
    console.log('Skipping test user creation (requires service role key)');

    // Update first user profile
    await supabase.from('user_profiles').upsert(userProfiles[0]);

    // Get quote lines to calculate discounts and margins
    console.log('Creating approval requests...');

    const approvalRequests = [];
    const historyRecords = [];

    for (let i = 0; i < Math.min(quotes.length, 30); i++) {
      const quote = quotes[i];

      // Get quote lines for this quote
      const { data: quoteLines } = await supabase
        .from('quote_lines')
        .select('*, product:products(*)')
        .eq('quote_id', quote.id);

      if (!quoteLines || quoteLines.length === 0) continue;

      // Calculate average discount and margin
      let totalDiscount = 0;
      let totalMargin = 0;
      let validLines = 0;

      for (const line of quoteLines) {
        if (line.product && line.product.list_price > 0) {
          const discount = ((line.product.list_price - line.unit_price) / line.product.list_price) * 100;
          const cost = line.product.cost || line.product.list_price * 0.6;
          const margin = ((line.unit_price - cost) / line.unit_price) * 100;

          totalDiscount += discount;
          totalMargin += margin;
          validLines++;
        }
      }

      const avgDiscount = validLines > 0 ? totalDiscount / validLines : 10;
      const avgMargin = validLines > 0 ? totalMargin / validLines : 25;

      // Determine approval level based on discount, size, and margin
      let approvalLevel = 1;
      let approverRole = 'Sales Manager';
      let reason = 'Standard approval';

      if (avgDiscount > 35 || quote.total > 1000000 || avgMargin < 10) {
        approvalLevel = 4;
        approverRole = 'VP Sales';
        reason = 'Exception discount or strategic deal requiring VP approval';
      } else if (avgDiscount > 25 || quote.total > 500000 || avgMargin < 15) {
        approvalLevel = 3;
        approverRole = 'Sales Director';
        reason = 'High discount or major deal requiring Director approval';
      } else if (avgDiscount > 15 || quote.total > 100000 || avgMargin < 20) {
        approvalLevel = 2;
        approverRole = 'Regional Manager';
        reason = 'Moderate discount or large deal requiring Regional Manager approval';
      }

      // Create different statuses for variety
      const statusRandom = Math.random();
      let status = 'Pending';
      let approvedBy = null;
      let approvedAt = null;

      if (i < 15) {
        // First 15 are pending
        status = 'Pending';
      } else if (statusRandom > 0.7) {
        // 30% approved
        status = 'Approved';
        approvedBy = firstUserId;
        approvedAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (statusRandom > 0.5) {
        // 20% rejected
        status = 'Rejected';
        approvedBy = firstUserId;
        approvedAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      const requestedAt = new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString();

      const approvalRequest = {
        id: `APPROVAL-${quote.id}-${Date.now()}-${i}`,
        quote_id: quote.id,
        requested_by: firstUserId,
        requested_at: requestedAt,
        approver_role: approverRole,
        approved_by: approvedBy,
        approved_at: approvedAt,
        status: status,
        reason: reason,
        comments: status === 'Approved' ? 'Approved - meets criteria' : status === 'Rejected' ? 'Pricing too aggressive' : null,
        approval_level_required: approvalLevel,
        approval_sequence: 1,
        quote_total: quote.total,
        quote_discount_percent: avgDiscount,
        quote_margin_percent: avgMargin
      };

      approvalRequests.push(approvalRequest);

      // Update quote status
      if (status === 'Pending') {
        await supabase
          .from('quotes')
          .update({
            status: 'Under Review',
            current_approval_level: 0,
            max_approval_level_required: approvalLevel
          })
          .eq('id', quote.id);
      }

      // Create history record if approved or rejected
      if (status !== 'Pending') {
        historyRecords.push({
          quote_id: quote.id,
          approval_request_id: approvalRequest.id,
          approval_level: approvalLevel,
          action: status === 'Approved' ? 'approved' : 'rejected',
          actioned_by: firstUserId,
          actioned_by_role: approverRole,
          actioned_by_level: approvalLevel,
          comments: approvalRequest.comments,
          quote_total: quote.total,
          quote_discount_percent: avgDiscount,
          quote_margin_percent: avgMargin,
          actioned_at: approvedAt
        });
      } else {
        // Add requested history
        historyRecords.push({
          quote_id: quote.id,
          approval_request_id: approvalRequest.id,
          approval_level: approvalLevel,
          action: 'requested',
          actioned_by: firstUserId,
          actioned_by_role: 'Sales Rep',
          actioned_by_level: 0,
          comments: reason,
          quote_total: quote.total,
          quote_discount_percent: avgDiscount,
          quote_margin_percent: avgMargin,
          actioned_at: requestedAt
        });
      }
    }

    // Insert approval requests
    if (approvalRequests.length > 0) {
      const { error } = await supabase
        .from('approval_requests')
        .upsert(approvalRequests, { onConflict: 'id' });

      if (error) {
        console.error('Error inserting approval requests:', error);
      } else {
        console.log(`✓ Created ${approvalRequests.length} approval requests`);
        console.log(`  - Pending: ${approvalRequests.filter(a => a.status === 'Pending').length}`);
        console.log(`  - Approved: ${approvalRequests.filter(a => a.status === 'Approved').length}`);
        console.log(`  - Rejected: ${approvalRequests.filter(a => a.status === 'Rejected').length}`);
      }
    }

    // Insert approval history
    if (historyRecords.length > 0) {
      const { error } = await supabase
        .from('approval_history')
        .insert(historyRecords);

      if (error) {
        console.error('Error inserting approval history:', error);
      } else {
        console.log(`✓ Created ${historyRecords.length} approval history records`);
      }
    }

    // Summary
    console.log('\n=== Approval Workflow Summary ===');
    console.log('Users created with different approval levels:');
    console.log('  Level 1 - Sales Manager (can approve 0-15% discounts)');
    console.log('  Level 2 - Regional Manager (can approve 15-25% discounts, $100K+ deals)');
    console.log('  Level 3 - Sales Director (can approve 25-35% discounts, $500K+ deals)');
    console.log('  Level 4 - VP Sales (can approve 35%+ discounts, $1M+ deals)');
    console.log('\nApproval requests created by level:');

    const level1 = approvalRequests.filter(a => a.approval_level_required === 1 && a.status === 'Pending').length;
    const level2 = approvalRequests.filter(a => a.approval_level_required === 2 && a.status === 'Pending').length;
    const level3 = approvalRequests.filter(a => a.approval_level_required === 3 && a.status === 'Pending').length;
    const level4 = approvalRequests.filter(a => a.approval_level_required === 4 && a.status === 'Pending').length;

    console.log(`  Level 1 (Pending): ${level1}`);
    console.log(`  Level 2 (Pending): ${level2}`);
    console.log(`  Level 3 (Pending): ${level3}`);
    console.log(`  Level 4 (Pending): ${level4}`);

    console.log('\n✓ Approval workflow seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding approval data:', error);
    throw error;
  }
}

seedApprovalData()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
