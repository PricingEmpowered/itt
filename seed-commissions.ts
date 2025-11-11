import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedCommissions() {
  console.log('Fetching quotes...');

  const { data: quotes, error: quotesError } = await supabase
    .from('quotes')
    .select('id, total, deal_score, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (quotesError) {
    console.error('Error fetching quotes:', quotesError);
    return;
  }

  if (!quotes || quotes.length === 0) {
    console.log('No quotes found');
    return;
  }

  console.log(`Found ${quotes.length} quotes`);

  const { data: tiers, error: tiersError } = await supabase
    .from('commission_tiers')
    .select('*')
    .eq('is_active', true);

  if (tiersError || !tiers || tiers.length === 0) {
    console.error('Error fetching commission tiers:', tiersError);
    return;
  }

  console.log(`Found ${tiers.length} commission tiers`);

  const { data: existingCommissions } = await supabase
    .from('sales_commissions')
    .select('quote_id');

  const existingQuoteIds = new Set(existingCommissions?.map(c => c.quote_id) || []);

  const { data: users } = await supabase.auth.admin.listUsers();
  const userEmails = users?.users.map(u => u.email).filter(Boolean) as string[] || [];

  const commissions = [];
  let skipped = 0;

  for (const quote of quotes) {
    if (existingQuoteIds.has(quote.id)) {
      skipped++;
      continue;
    }

    const dealSize = parseFloat(quote.total);
    const dealScore = quote.deal_score;

    const applicableTier = tiers
      .filter(tier => {
        const meetsMin = dealSize >= parseFloat(tier.min_deal_size);
        const meetsMax = tier.max_deal_size === null || dealSize <= parseFloat(tier.max_deal_size);
        return meetsMin && meetsMax;
      })
      .sort((a, b) => parseFloat(b.min_deal_size) - parseFloat(a.min_deal_size))[0];

    if (!applicableTier) {
      console.log(`No tier found for quote ${quote.id} with deal size ${dealSize}`);
      continue;
    }

    const basePercent = parseFloat(applicableTier.base_commission_percent);
    const qualifiesForBonus = dealScore && dealScore >= applicableTier.min_deal_score;
    const bonusPercent = qualifiesForBonus ? parseFloat(applicableTier.deal_score_bonus_percent) : 0;
    const totalPercent = basePercent + bonusPercent;
    const commissionAmount = dealSize * (totalPercent / 100);

    const randomStatus = Math.random();
    let status = 'pending';
    let wonDate = null;
    let paidDate = null;

    if (randomStatus > 0.7) {
      status = 'won';
      const daysAgo = Math.floor(Math.random() * 30);
      wonDate = new Date();
      wonDate.setDate(wonDate.getDate() - daysAgo);
    } else if (randomStatus > 0.85) {
      status = 'paid';
      const wonDaysAgo = Math.floor(Math.random() * 45) + 15;
      wonDate = new Date();
      wonDate.setDate(wonDate.getDate() - wonDaysAgo);

      const paidDaysAgo = Math.floor(Math.random() * 15);
      paidDate = new Date();
      paidDate.setDate(paidDate.getDate() - paidDaysAgo);
    }

    const salesRepEmail = userEmails[Math.floor(Math.random() * userEmails.length)] || 'sales@example.com';

    commissions.push({
      quote_id: quote.id,
      sales_rep_id: quote.created_by,
      sales_rep_email: salesRepEmail,
      deal_size: dealSize,
      deal_score: dealScore,
      commission_tier_id: applicableTier.id,
      base_commission_percent: basePercent,
      deal_score_bonus_percent: bonusPercent,
      total_commission_percent: totalPercent,
      commission_amount: commissionAmount,
      status: status,
      won_date: wonDate ? wonDate.toISOString().split('T')[0] : null,
      paid_date: paidDate ? paidDate.toISOString().split('T')[0] : null,
    });
  }

  if (commissions.length === 0) {
    console.log(`All quotes already have commissions (skipped ${skipped})`);
    return;
  }

  console.log(`Creating ${commissions.length} commissions (skipped ${skipped} existing)...`);

  const { data, error } = await supabase
    .from('sales_commissions')
    .insert(commissions)
    .select();

  if (error) {
    console.error('Error creating commissions:', error);
    return;
  }

  console.log(`✓ Successfully created ${data?.length || 0} commissions`);

  const statusCounts = {
    pending: commissions.filter(c => c.status === 'pending').length,
    won: commissions.filter(c => c.status === 'won').length,
    paid: commissions.filter(c => c.status === 'paid').length,
  };

  const totalCommissionAmount = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
  const wonCommissionAmount = commissions.filter(c => c.status === 'won').reduce((sum, c) => sum + c.commission_amount, 0);
  const paidCommissionAmount = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0);

  console.log('\nCommission Summary:');
  console.log(`  Total Commissions: $${totalCommissionAmount.toFixed(2)}`);
  console.log(`  Status Breakdown:`);
  console.log(`    - Pending: ${statusCounts.pending} ($${(totalCommissionAmount - wonCommissionAmount - paidCommissionAmount).toFixed(2)})`);
  console.log(`    - Won (Unpaid): ${statusCounts.won} ($${wonCommissionAmount.toFixed(2)})`);
  console.log(`    - Paid: ${statusCounts.paid} ($${paidCommissionAmount.toFixed(2)})`);

  console.log('\nSample Commissions:');
  commissions.slice(0, 5).forEach((comm, i) => {
    console.log(`  ${i + 1}. Quote ${comm.quote_id}`);
    console.log(`     Deal Size: $${comm.deal_size.toFixed(2)} | Score: ${comm.deal_score || 'N/A'}`);
    console.log(`     Commission: ${comm.total_commission_percent.toFixed(1)}% = $${comm.commission_amount.toFixed(2)}`);
    console.log(`     Status: ${comm.status}`);
  });
}

seedCommissions().catch(console.error);
