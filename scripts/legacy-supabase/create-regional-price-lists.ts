import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

interface Product {
  id: string;
  name: string;
}

interface PriceListItem {
  price_list_id: string;
  product_id: string;
  list_price: number;
}

async function fetchExchangeRates(base: string, symbols: string[]): Promise<Record<string, number>> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/currency-rates?base=${base}&symbols=${symbols.join(',')}`
    );
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Failed to fetch exchange rates');
    }
    
    return data.rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    throw error;
  }
}

async function createRegionalPriceLists() {
  console.log('Starting regional price list creation...\n');

  // 1. Get currencies
  const { data: currencies, error: currError } = await supabase
    .from('currencies')
    .select('*')
    .in('code', ['USD', 'EUR', 'GBP', 'AUD']);

  if (currError || !currencies) {
    console.error('Error fetching currencies:', currError);
    return;
  }

  const usd = currencies.find(c => c.code === 'USD')!;
  const eur = currencies.find(c => c.code === 'EUR')!;
  const gbp = currencies.find(c => c.code === 'GBP')!;
  const aud = currencies.find(c => c.code === 'AUD')!;

  console.log('Currencies loaded:', currencies.map(c => c.code).join(', '));

  // 2. Get USD Standard price list items
  const { data: usdPriceList } = await supabase
    .from('price_lists')
    .select('id')
    .eq('currency', 'USD')
    .limit(1)
    .single();

  if (!usdPriceList) {
    console.error('USD price list not found');
    return;
  }

  console.log(`Using USD price list: ${usdPriceList.id}`);

  const { data: usdPriceItems, error: itemsError } = await supabase
    .from('price_list_items')
    .select('product_id, list_price')
    .eq('price_list_id', usdPriceList.id);

  if (itemsError || !usdPriceItems) {
    console.error('Error fetching USD price items:', itemsError);
    return;
  }

  console.log(`\nLoaded ${usdPriceItems.length} products from USD Standard price list\n`);

  // 3. Fetch live exchange rates from USD
  console.log('Fetching live exchange rates from USD...');
  const rates = await fetchExchangeRates('USD', ['EUR', 'GBP', 'AUD']);
  console.log('Exchange rates:');
  console.log(`  USD -> EUR: ${rates.EUR}`);
  console.log(`  USD -> GBP: ${rates.GBP}`);
  console.log(`  USD -> AUD: ${rates.AUD}`);
  console.log('');

  // 4. Create regional price lists
  const regionalPriceLists = [
    {
      id: 'PL-EMEA-001',
      name: 'EMEA Standard Pricing',
      currency: 'EUR',
      currency_id: eur.id,
      rate: rates.EUR,
      effective_from: '2025-01-01',
      effective_to: '2025-12-31',
      version: 1,
    },
    {
      id: 'PL-UK-001',
      name: 'UK Standard Pricing',
      currency: 'GBP',
      currency_id: gbp.id,
      rate: rates.GBP,
      effective_from: '2025-01-01',
      effective_to: '2025-12-31',
      version: 1,
    },
    {
      id: 'PL-APAC-001',
      name: 'APAC Standard Pricing',
      currency: 'AUD',
      currency_id: aud.id,
      rate: rates.AUD,
      effective_from: '2025-01-01',
      effective_to: '2025-12-31',
      version: 1,
    },
  ];

  for (const priceList of regionalPriceLists) {
    console.log(`Creating ${priceList.name}...`);
    
    // Insert price list
    const { error: plError } = await supabase
      .from('price_lists')
      .insert([{
        id: priceList.id,
        name: priceList.name,
        currency: priceList.currency,
        currency_id: priceList.currency_id,
        effective_from: priceList.effective_from,
        effective_to: priceList.effective_to,
        version: priceList.version,
      }]);

    if (plError) {
      console.error(`  Error creating price list:`, plError);
      continue;
    }

    // Convert and insert price items
    const regionalItems: PriceListItem[] = usdPriceItems.map(item => ({
      price_list_id: priceList.id,
      product_id: item.product_id,
      list_price: Math.round(item.list_price * priceList.rate * 100) / 100, // Round to 2 decimals
    }));

    const { error: itemsError } = await supabase
      .from('price_list_items')
      .insert(regionalItems);

    if (itemsError) {
      console.error(`  Error creating price items:`, itemsError);
      continue;
    }

    console.log(`  ✓ Created with ${regionalItems.length} products`);
    console.log(`  Exchange rate used: ${priceList.rate.toFixed(4)}`);
    console.log('');
  }

  console.log('Regional price list creation complete!');
}

createRegionalPriceLists().catch(console.error);
