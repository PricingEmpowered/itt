import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedCostAlerts() {
  console.log('Fetching products...');

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, base_cost')
    .eq('status', 'Active')
    .limit(10);

  if (productsError) {
    console.error('Error fetching products:', productsError);
    return;
  }

  if (!products || products.length === 0) {
    console.log('No products found');
    return;
  }

  const costChangeReasons = [
    'Supplier price increase',
    'Material cost increase',
    'Labor cost increase',
    'Shipping cost increase',
    'Currency fluctuation',
    'Regulatory/compliance costs'
  ];

  const alerts = [];
  const today = new Date();

  for (let i = 0; i < Math.min(8, products.length); i++) {
    const product = products[i];
    const costIncreasePercent = 5 + Math.random() * 20; // 5-25% increase
    const expectedNewCost = product.base_cost * (1 + costIncreasePercent / 100);

    // Vary the effective dates
    const daysUntilEffective = i < 2 ? 20 + Math.random() * 10 : // Critical (20-30 days)
                              i < 4 ? 40 + Math.random() * 20 : // High (40-60 days)
                              i < 6 ? 70 + Math.random() * 20 : // Medium (70-90 days)
                              100 + Math.random() * 30; // Low (100-130 days)

    const effectiveDate = new Date(today);
    effectiveDate.setDate(effectiveDate.getDate() + Math.floor(daysUntilEffective));

    const { data: priceListItem } = await supabase
      .from('price_list_items')
      .select('list_price')
      .eq('product_id', product.id)
      .eq('price_list_id', 'master')
      .maybeSingle();

    const currentListPrice = priceListItem?.list_price || product.base_cost * 1.4;

    // Calculate recommended price to maintain 30% margin
    const targetMargin = 30;
    const recommendedPrice = expectedNewCost / (1 - targetMargin / 100);
    const increasePercent = ((recommendedPrice - currentListPrice) / currentListPrice) * 100;

    alerts.push({
      product_id: product.id,
      current_cost: product.base_cost,
      expected_new_cost: expectedNewCost,
      expected_cost_change_percent: costIncreasePercent,
      effective_date: effectiveDate.toISOString().split('T')[0],
      reason: costChangeReasons[Math.floor(Math.random() * costChangeReasons.length)],
      recommended_price_increase: recommendedPrice,
      recommended_price_increase_percent: increasePercent,
      status: i < 7 ? 'pending' : 'acknowledged',
      notes: i % 3 === 0 ? 'High priority - affects multiple customers' :
             i % 3 === 1 ? 'Monitor competitive pricing before adjusting' : null
    });
  }

  console.log(`Creating ${alerts.length} cost change alerts...`);

  const { data, error } = await supabase
    .from('expected_cost_changes')
    .insert(alerts)
    .select();

  if (error) {
    console.error('Error creating alerts:', error);
    return;
  }

  console.log(`✓ Successfully created ${data?.length || 0} cost change alerts`);

  // Display summary
  console.log('\nAlert Summary:');
  alerts.forEach((alert, i) => {
    const product = products.find(p => p.id === alert.product_id);
    const daysAway = Math.floor((new Date(alert.effective_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  ${i + 1}. ${product?.name}`);
    console.log(`     Cost: $${alert.current_cost.toFixed(2)} → $${alert.expected_new_cost.toFixed(2)} (+${alert.expected_cost_change_percent.toFixed(1)}%)`);
    console.log(`     Effective in ${daysAway} days`);
    console.log(`     Recommended price: $${alert.recommended_price_increase.toFixed(2)} (+${alert.recommended_price_increase_percent.toFixed(1)}%)`);
  });
}

seedCostAlerts().catch(console.error);
