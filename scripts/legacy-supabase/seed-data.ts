import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const categories = ['Pumps', 'Valves', 'Controls', 'Actuators', 'Sensors', 'Filters', 'Seals', 'Gaskets', 'Bearings', 'Motors'];
const pumpTypes = ['Centrifugal', 'Positive Displacement', 'Diaphragm', 'Peristaltic', 'Gear', 'Screw', 'Vane', 'Piston'];
const valveTypes = ['Ball', 'Gate', 'Globe', 'Butterfly', 'Check', 'Needle', 'Plug', 'Diaphragm'];
const materials = ['Stainless Steel', 'Carbon Steel', 'Bronze', 'Cast Iron', 'PVC', 'PTFE', 'Brass', 'Aluminum'];
const voltages = ['120V', '240V', '480V', '24V DC', '12V DC'];
const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
const segments = ['Tier 1 Industrial', 'Tier 2 Industrial', 'Tier 3 Industrial', 'OEM', 'Distributor', 'End User'];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

async function seedProducts() {
  console.log('Seeding 1000 products...');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('No authenticated user. Attempting to sign in with test account...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'test@itt.com',
      password: 'testpass123',
    });

    if (signInError) {
      console.log('Test account not found. Creating it...');
      const { error: signUpError } = await supabase.auth.signUp({
        email: 'test@itt.com',
        password: 'testpass123',
      });

      if (signUpError) {
        console.error('Error creating test account:', signUpError);
        return [];
      }

      await supabase.auth.signInWithPassword({
        email: 'test@itt.com',
        password: 'testpass123',
      });
    }
  }

  const products = [];

  for (let i = 1; i <= 1000; i++) {
    const category = randomChoice(categories);
    let productName = '';

    if (category === 'Pumps') {
      productName = `${randomChoice(pumpTypes)} Pump Series ${String.fromCharCode(65 + (i % 26))}`;
    } else if (category === 'Valves') {
      productName = `${randomChoice(valveTypes)} Valve Model ${i}`;
    } else {
      productName = `${category} Unit ${String(i).padStart(4, '0')}`;
    }

    const attributes: any = {
      material: randomChoice(materials),
      pressure_rating: `${randomInt(100, 1000)} PSI`,
      temperature_range: `${randomInt(-40, 200)}°F to ${randomInt(200, 500)}°F`,
    };

    if (category === 'Pumps') {
      attributes.flow_rate = `${randomInt(50, 1000)} GPM`;
      attributes.head = `${randomInt(50, 500)} ft`;
    }

    if (['Pumps', 'Motors', 'Actuators', 'Controls'].includes(category)) {
      attributes.voltage = randomChoice(voltages);
      attributes.power = `${randomFloat(0.5, 50)} HP`;
    }

    products.push({
      id: `PROD-${category.toUpperCase().slice(0, 4)}-${String(i).padStart(4, '0')}`,
      name: productName,
      category,
      attributes,
      base_cost: randomFloat(50, 5000),
      uom: 'EA',
      status: i % 20 === 0 ? 'Inactive' : 'Active',
    });
  }

  const batchSize = 100;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const { error } = await supabase.from('products').insert(batch);
    if (error) {
      console.error(`Error inserting products batch ${i / batchSize + 1}:`, error);
    } else {
      console.log(`Inserted products batch ${i / batchSize + 1} of ${Math.ceil(products.length / batchSize)}`);
    }
  }

  console.log('Products seeded successfully!');
  return products;
}

async function seedCustomers() {
  console.log('Seeding 200 customers...');
  const customers = [];

  const companyPrefixes = ['Global', 'United', 'American', 'International', 'National', 'Premier', 'Advanced', 'Superior'];
  const companySuffixes = ['Industries', 'Manufacturing', 'Systems', 'Technologies', 'Solutions', 'Corporation', 'Group', 'Enterprises'];

  for (let i = 1; i <= 200; i++) {
    const companyName = `${randomChoice(companyPrefixes)} ${randomChoice(companySuffixes)} ${i}`;
    const region = randomChoice(regions);
    const segment = randomChoice(segments);

    customers.push({
      id: `CUST-${String(i).padStart(4, '0')}`,
      name: companyName,
      segment,
      region,
      contact_email: `contact${i}@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      annual_volume: randomFloat(10000, 5000000, 0),
    });
  }

  const batchSize = 100;
  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize);
    const { error } = await supabase.from('customers').insert(batch);
    if (error) {
      console.error(`Error inserting customers batch ${i / batchSize + 1}:`, error);
    } else {
      console.log(`Inserted customers batch ${i / batchSize + 1} of ${Math.ceil(customers.length / batchSize)}`);
    }
  }

  console.log('Customers seeded successfully!');
  return customers;
}

async function seedPriceLists(products: any[]) {
  console.log('Seeding price lists...');

  const priceLists = [
    {
      id: 'PL-2025-US',
      name: 'US Standard 2025',
      currency: 'USD',
      effective_from: '2025-01-01',
      effective_to: '2025-12-31',
      version: 1,
    },
    {
      id: 'PL-2025-EU',
      name: 'Europe Standard 2025',
      currency: 'EUR',
      effective_from: '2025-01-01',
      effective_to: '2025-12-31',
      version: 1,
    },
    {
      id: 'PL-2025-APAC',
      name: 'Asia Pacific 2025',
      currency: 'USD',
      effective_from: '2025-01-01',
      effective_to: '2025-12-31',
      version: 1,
    },
  ];

  const { error: plError } = await supabase.from('price_lists').insert(priceLists);
  if (plError) {
    console.error('Error inserting price lists:', plError);
    return;
  }

  console.log('Price lists created. Adding price list items...');

  const priceListItems = [];
  for (const priceList of priceLists) {
    const activeProducts = products.filter(p => p.status === 'Active');

    for (const product of activeProducts) {
      const markup = randomFloat(1.3, 2.0);
      const currencyMultiplier = priceList.currency === 'EUR' ? 0.92 : 1;

      priceListItems.push({
        price_list_id: priceList.id,
        product_id: product.id,
        list_price: parseFloat((product.base_cost * markup * currencyMultiplier).toFixed(2)),
      });
    }
  }

  const batchSize = 500;
  for (let i = 0; i < priceListItems.length; i += batchSize) {
    const batch = priceListItems.slice(i, i + batchSize);
    const { error } = await supabase.from('price_list_items').insert(batch);
    if (error) {
      console.error(`Error inserting price list items batch ${i / batchSize + 1}:`, error);
    } else {
      console.log(`Inserted price list items batch ${i / batchSize + 1} of ${Math.ceil(priceListItems.length / batchSize)}`);
    }
  }

  console.log('Price lists seeded successfully!');
  return priceLists;
}

async function seedDiscountRules() {
  console.log('Seeding discount rules...');

  const discountRules = [
    {
      id: 'DISC-TIER1-GLOBAL',
      name: 'Tier 1 Industrial Global',
      segment: 'Tier 1 Industrial',
      criteria: { min_volume: 100000 },
      discount_percent: 15,
      approval_threshold: 20,
      stackable: false,
      active: true,
    },
    {
      id: 'DISC-TIER2-GLOBAL',
      name: 'Tier 2 Industrial Global',
      segment: 'Tier 2 Industrial',
      criteria: { min_volume: 50000 },
      discount_percent: 10,
      approval_threshold: 15,
      stackable: false,
      active: true,
    },
    {
      id: 'DISC-TIER3-GLOBAL',
      name: 'Tier 3 Industrial Global',
      segment: 'Tier 3 Industrial',
      criteria: { min_volume: 25000 },
      discount_percent: 7,
      approval_threshold: 12,
      stackable: false,
      active: true,
    },
    {
      id: 'DISC-OEM-VOLUME',
      name: 'OEM Volume Discount',
      segment: 'OEM',
      criteria: { min_volume: 200000 },
      discount_percent: 20,
      approval_threshold: 25,
      stackable: false,
      active: true,
    },
  ];

  const { error } = await supabase.from('discount_rules').insert(discountRules);
  if (error) {
    console.error('Error inserting discount rules:', error);
  } else {
    console.log('Discount rules seeded successfully!');
  }
}

async function seedQuotes(customers: any[], products: any[], priceLists: any[]) {
  console.log('Seeding 25 quotes...');

  const { data: userData } = await supabase.auth.getUser();
  let userId = userData?.user?.id;

  if (!userId) {
    console.log('No authenticated user found. Creating test account...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'test@itt.com',
      password: 'testpass123',
    });

    if (signUpError) {
      console.error('Error creating test user:', signUpError);
      return;
    }

    userId = signUpData?.user?.id;
  }

  if (!userId) {
    console.error('Could not get user ID for quotes');
    return;
  }

  const quotes = [];
  const quoteLines = [];
  const statuses = ['Draft', 'Under Review', 'Approved', 'Rejected'];
  const activeProducts = products.filter(p => p.status === 'Active');

  for (let i = 1; i <= 25; i++) {
    const quoteId = `Q-2025-${String(i).padStart(5, '0')}`;
    const customer = randomChoice(customers);
    const priceList = randomChoice(priceLists);
    const status = randomChoice(statuses);
    const lineCount = randomInt(2, 8);

    let subtotal = 0;

    for (let j = 0; j < lineCount; j++) {
      const product = randomChoice(activeProducts);
      const quantity = randomInt(1, 50);
      const markup = randomFloat(1.4, 2.2);
      const unitPrice = parseFloat((product.base_cost * markup).toFixed(2));
      const discountApplied = randomFloat(0, 12);
      const lineTotal = parseFloat((quantity * unitPrice * (1 - discountApplied / 100)).toFixed(2));

      subtotal += lineTotal;

      quoteLines.push({
        quote_id: quoteId,
        product_id: product.id,
        quantity,
        unit_price: unitPrice,
        discount_applied: discountApplied,
        line_total: lineTotal,
      });
    }

    const tax = parseFloat((subtotal * 0.05).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    quotes.push({
      id: quoteId,
      customer_id: customer.id,
      price_list_id: priceList.id,
      status,
      subtotal,
      tax,
      total,
      created_by: userId,
      approvals_required: status === 'Under Review' || status === 'Approved' ? 1 : 0,
      created_at: new Date(2025, 0, randomInt(1, 31), randomInt(0, 23), randomInt(0, 59)).toISOString(),
    });
  }

  const { error: quotesError } = await supabase.from('quotes').insert(quotes);
  if (quotesError) {
    console.error('Error inserting quotes:', quotesError);
    return;
  }
  console.log('Quotes inserted successfully!');

  const batchSize = 100;
  for (let i = 0; i < quoteLines.length; i += batchSize) {
    const batch = quoteLines.slice(i, i + batchSize);
    const { error } = await supabase.from('quote_lines').insert(batch);
    if (error) {
      console.error(`Error inserting quote lines batch ${i / batchSize + 1}:`, error);
    } else {
      console.log(`Inserted quote lines batch ${i / batchSize + 1} of ${Math.ceil(quoteLines.length / batchSize)}`);
    }
  }

  const approvalRequests = [];
  const reviewedQuotes = quotes.filter(q => q.status === 'Under Review' || q.status === 'Approved' || q.status === 'Rejected');

  for (const quote of reviewedQuotes) {
    approvalRequests.push({
      id: `APPROVAL-${quote.id}`,
      quote_id: quote.id,
      requested_by: userId,
      requested_at: quote.created_at,
      approver_role: 'Regional Manager',
      approved_by: quote.status !== 'Under Review' ? userId : null,
      approved_at: quote.status !== 'Under Review' ? new Date(quote.created_at).toISOString() : null,
      status: quote.status === 'Under Review' ? 'Pending' : quote.status === 'Approved' ? 'Approved' : 'Rejected',
      reason: 'Discount exceeds standard threshold',
      comments: quote.status !== 'Under Review' ? `${quote.status} by manager` : null,
    });
  }

  if (approvalRequests.length > 0) {
    const { error: approvalsError } = await supabase.from('approval_requests').insert(approvalRequests);
    if (approvalsError) {
      console.error('Error inserting approval requests:', approvalsError);
    } else {
      console.log('Approval requests seeded successfully!');
    }
  }

  console.log('Quotes seeded successfully!');
}

async function main() {
  console.log('Starting database seeding...\n');

  try {
    const products = await seedProducts();
    const customers = await seedCustomers();
    const priceLists = await seedPriceLists(products);
    await seedDiscountRules();
    await seedQuotes(customers, products, priceLists);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('Summary:');
    console.log('- 1000 products');
    console.log('- 200 customers');
    console.log('- 3 price lists with items');
    console.log('- 4 discount rules');
    console.log('- 25 quotes with line items');
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
  }
}

main();
