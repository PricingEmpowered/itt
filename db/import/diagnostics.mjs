#!/usr/bin/env node
/*
 * Post-import diagnostics.
 *
 * ## Why this exists
 *
 * These importers were written against column definitions and a handful of
 * sample rows, because ITT cannot share extracts. Every assumption in them is
 * therefore unverified against the data it will actually meet.
 *
 * So rather than letting those assumptions fail quietly, each one is a check
 * here. The output is meant to be read by whoever runs the first real load and
 * sent back, and it is written to be actionable on its own: what was assumed,
 * what the data says, and what to do about the difference.
 *
 * Exit code is 0 unless something is wrong in a way that would corrupt a
 * figure someone might quote from.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node db/import/diagnostics.mjs
 */
import { requireDatabaseUrl } from './lib.mjs';
import pg from 'pg';

const findings = [];
const note = (severity, title, detail) => findings.push({ severity, title, detail });

const pct = (n, d) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`);
const fmt = (n, dp = 2) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: dp });

async function main() {
  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    await volumes(client);
    await bookedCostBasis(client);
    await partResolution(client);
    await identityBridges(client);
    await marginReconciliation(client);
    await normalisationDisagreement(client);
    await tierConsistency(client);
    await coverage(client);
    await exclusions(client);
  } finally {
    await client.end();
  }

  console.log('\n' + '='.repeat(72));
  const blocking = findings.filter((f) => f.severity === 'blocking');
  const check = findings.filter((f) => f.severity === 'check');
  if (!findings.length) {
    console.log('No findings. Every assumption held.');
    return;
  }
  console.log(`${blocking.length} blocking, ${check.length} to check.\n`);
  for (const f of [...blocking, ...check]) {
    console.log(`[${f.severity.toUpperCase()}] ${f.title}`);
    for (const line of f.detail) console.log(`    ${line}`);
    console.log();
  }
  if (blocking.length) process.exitCode = 1;
}

async function volumes(client) {
  const { rows } = await client.query(`
    SELECT 'invoice_lines' t, count(*) n, count(*) FILTER (WHERE excluded) x FROM invoice_lines
    UNION ALL SELECT 'booking_lines', count(*), count(*) FILTER (WHERE excluded) FROM booking_lines
    UNION ALL SELECT 'spa_items', count(*), count(*) FILTER (WHERE excluded) FROM spa_items
    UNION ALL SELECT 'quote_lines', count(*), 0 FROM quote_lines
    ORDER BY 1`);
  console.log('LOADED\n');
  for (const r of rows) {
    console.log(`  ${r.t.padEnd(16)} ${String(r.n).padStart(9)} row(s)` +
      (Number(r.x) ? `, ${r.x} excluded` : ''));
  }
}

/*
 * The open question that would corrupt every margin in the system.
 *
 * `Booked Cost` on the quote extract might be per unit or extended over the
 * minimum quantity. The one sample line carrying both reads -84.2% margin per
 * unit and +81.6% extended, and the invoice lines run 65-84%. So extended is
 * the likelier reading, and the code currently treats it as per unit.
 *
 * At volume the question answers itself: if per-unit reads produce a mass of
 * impossible margins that the extended read makes sane, that is the answer.
 */
async function bookedCostBasis(client) {
  const { rows } = await client.query(`
    SELECT count(*)                                                        AS n,
           count(*) FILTER (WHERE (unit_price - booked_cost) / unit_price < -0.5)
                                                                           AS impossible_per_unit,
           count(*) FILTER (WHERE min_qty > 1
                              AND (unit_price - booked_cost / min_qty) / unit_price
                                  BETWEEN 0 AND 0.95)                      AS plausible_extended,
           avg((unit_price - booked_cost) / unit_price * 100)              AS margin_per_unit,
           avg((unit_price - booked_cost / NULLIF(min_qty,0)) / unit_price * 100)
                                                                           AS margin_extended
      FROM quote_lines
     WHERE unit_price IS NOT NULL AND unit_price > 0 AND booked_cost IS NOT NULL`);
  const r = rows[0];
  const n = Number(r.n);
  console.log(`\nBOOKED COST BASIS  (${n} quote line(s) carry both a price and a cost)\n`);
  if (n === 0) {
    console.log('  No line carries both, so the question stays open.');
    return;
  }
  console.log(`  read per unit : mean margin ${fmt(r.margin_per_unit, 1)}%, ` +
    `${r.impossible_per_unit} line(s) below -50%`);
  console.log(`  read extended : mean margin ${fmt(r.margin_extended, 1)}%, ` +
    `${r.plausible_extended} line(s) land in 0-95%`);

  if (Number(r.impossible_per_unit) > n * 0.1) {
    note('blocking', 'Booked Cost is probably extended, not per unit', [
      `${r.impossible_per_unit} of ${n} lines (${pct(Number(r.impossible_per_unit), n)}) read as`,
      'worse than -50% margin when Booked Cost is treated as a unit cost.',
      `Dividing by MinQty gives a mean of ${fmt(r.margin_extended, 1)}% instead of ${fmt(r.margin_per_unit, 1)}%.`,
      '',
      'The importer and server/dealScore.ts both treat it as a unit cost, so every',
      'quote margin and deal score is wrong by a factor of the minimum quantity.',
      'Confirm with ITT, then change db/import/quotes.mjs to divide on load.',
    ]);
  }
}

async function partResolution(client) {
  console.log('\nPART NUMBER RESOLUTION\n');
  const sources = [
    ['invoice_lines', 'source_part_number'],
    ['booking_lines', 'source_part_number'],
    ['spa_items', 'part_no'],
  ];
  for (const [table, col] of sources) {
    const { rows } = await client.query(
      `SELECT count(*) n, count(product_id) resolved,
              count(DISTINCT ${col}) FILTER (WHERE product_id IS NULL) distinct_unresolved
         FROM ${table}`);
    const r = rows[0];
    const n = Number(r.n);
    if (n === 0) continue;
    console.log(`  ${table.padEnd(16)} ${r.resolved}/${n} resolved (${pct(Number(r.resolved), n)})` +
      `, ${r.distinct_unresolved} distinct part(s) unmatched`);
    if (n > 0 && Number(r.resolved) / n < 0.8) {
      const { rows: worst } = await client.query(
        `SELECT ${col} pn, count(*) n FROM ${table}
          WHERE product_id IS NULL AND ${col} IS NOT NULL
          GROUP BY 1 ORDER BY 2 DESC LIMIT 5`);
      note('blocking', `${table}: ${pct(n - Number(r.resolved), n)} of rows have no product`, [
        `${r.distinct_unresolved} distinct part number(s) matched nothing in the catalogue.`,
        'Most common:',
        ...worst.map((w) => `  ${w.pn}  (${w.n} row(s))`),
        '',
        'Usually means the item master for that site has not been loaded. Peer groups',
        'and price realization both need the product, so this blocks sections 3 to 5.',
      ]);
    }
  }
}

async function identityBridges(client) {
  console.log('\nIDENTITY BRIDGES\n');
  const { rows: [st] } = await client.query(
    `SELECT count(*) n, count(customer_id) linked FROM customer_ship_to`);
  console.log(`  ship-to locations   ${st.linked}/${st.n} linked to a bill-to`);

  const { rows: [inv] } = await client.query(
    `SELECT count(*) n, count(customer_id) linked FROM invoice_lines`);
  if (Number(inv.n)) {
    console.log(`  invoice lines       ${inv.linked}/${inv.n} reach a customer`);
    if (Number(inv.linked) === 0 && Number(inv.n) > 0) {
      note('blocking', 'No invoice line reaches a customer', [
        'Invoices are cut against a ship-to, and ship-tos are linked to bill-tos only by',
        'Booking Data. Load Booking before Sales, or reload Sales afterwards.',
        '',
        'Without it, no peer group can be built by customer segment, which is section 3.',
      ]);
    }
  }

  const { rows: [chain] } = await client.query(`
    SELECT count(DISTINCT b.order_number) bookings,
           count(DISTINCT i.order_no)     invoiced
      FROM booking_lines b
      LEFT JOIN invoice_lines i ON i.order_no = b.order_number`);
  if (Number(chain.bookings)) {
    console.log(`  quote-to-invoice    ${chain.invoiced}/${chain.bookings} booking order(s) have an invoice`);
  }
}

/*
 * Verified on ITT's own sample: MARGIN_n reconciles to
 * (price - COST_ESTIMATED) / price. If that stops holding at volume, either a
 * different cost basis is in play on those rows or the assumption was never
 * general.
 */
async function marginReconciliation(client) {
  const { rows } = await client.query(`
    SELECT count(*) n,
           count(*) FILTER (
             WHERE abs((t.price_given_oem - i.cost_estimated) / t.price_given_oem * 100
                       - t.margin_percent) > 0.5) AS mismatched
      FROM spa_item_tiers t
      JOIN spa_items i ON i.id = t.spa_item_id
     WHERE t.margin_percent IS NOT NULL
       AND t.price_given_oem > 0
       AND i.cost_estimated IS NOT NULL`);
  const r = rows[0];
  const n = Number(r.n);
  if (n === 0) return;
  console.log(`\nMARGIN RECONCILIATION\n`);
  console.log(`  ${n - Number(r.mismatched)}/${n} tier(s) reconcile to (price - cost) / price`);
  if (Number(r.mismatched) > 0) {
    note('check', `${r.mismatched} tier(s) where the stated margin does not reconcile`, [
      'Expected (PRICE_GIVEN_OEM - COST_ESTIMATED) / PRICE_GIVEN_OEM, which held on',
      'every tier of the sample ITT supplied.',
      '',
      'A mismatch means a different cost basis on those rows - possibly BOOK_COST, or a',
      'cost that moved after the quote. Worth asking which cost the margin was struck on.',
    ]);
  }
}

async function normalisationDisagreement(client) {
  const { rows } = await client.query(`
    SELECT count(*) n FROM spa_items
     WHERE part_no_alpha_num IS NOT NULL
       AND part_no IS NOT NULL
       AND part_no_alpha_num <> upper(regexp_replace(part_no, '[^A-Za-z0-9]', '', 'g'))`);
  const n = Number(rows[0].n);
  if (n > 0) {
    note('check', `${n} row(s) where ITT's normalised part number differs from ours`, [
      "Ours strips non-alphanumerics and uppercases, which reproduced PART_NO_ALPHA_NUM",
      'on every sample row. A disagreement at volume means a rule we have not seen.',
      '',
      'Related and still open: the price list writes CIR01A203PF80V0 (digit zero) where',
      'the SPA views write ...VO (letter O) for the same suffix. One of the two is wrong,',
      'and the answer decides whether parts join exactly or need reconciliation.',
    ]);
  }
}

/* Spec 5.2: more quantity must never cost more per unit. */
async function tierConsistency(client) {
  const { rows } = await client.query(`
    WITH ordered AS (
      SELECT spa_item_id, tier_index, qty_moq, price_given_oem,
             lag(price_given_oem) OVER (PARTITION BY spa_item_id ORDER BY tier_index) prev_price,
             lag(qty_moq)         OVER (PARTITION BY spa_item_id ORDER BY tier_index) prev_qty
        FROM spa_item_tiers
    )
    SELECT count(*) FILTER (WHERE qty_moq > prev_qty AND price_given_oem > prev_price) AS rising,
           count(*) FILTER (WHERE prev_qty IS NOT NULL) AS comparable
      FROM ordered`);
  const r = rows[0];
  if (Number(r.comparable) === 0) return;
  console.log(`\nQUANTITY BREAK CONSISTENCY\n`);
  console.log(`  ${r.comparable} tier step(s) compared, ${r.rising} where a larger quantity costs more`);
  if (Number(r.rising) > 0) {
    note('check', `${r.rising} quantity break(s) rise in price as quantity increases`, [
      'Section 5.2 of the specification requires that more never costs more per unit.',
      'Either those rows are wrong, or the rule needs qualifying for cases where it',
      'legitimately does not hold.',
    ]);
  }
}

/* What fraction of the data can actually answer the spec's questions. */
async function coverage(client) {
  console.log('\nWHAT THE DATA CAN ANSWER\n');
  const { rows: [inv] } = await client.query(`
    SELECT count(*) n,
           count(*) FILTER (WHERE extended_cost IS NOT NULL AND extended_sell > 0) costed
      FROM invoice_lines WHERE NOT excluded`);
  if (Number(inv.n)) {
    console.log(`  margin from invoices    ${inv.costed}/${inv.n} line(s) (${pct(Number(inv.costed), Number(inv.n))})`);
  }

  const { rows: [real] } = await client.query(`
    SELECT count(*) n, count(pli.list_price) listed
      FROM invoice_lines il
      LEFT JOIN price_list_items pli ON pli.product_id = il.product_id
     WHERE NOT il.excluded`);
  if (Number(real.n)) {
    console.log(`  realization vs list     ${real.listed}/${real.n} line(s) (${pct(Number(real.listed), Number(real.n))})`);
    if (Number(real.listed) === 0) {
      note('check', 'No invoice line can be compared to a list price', [
        'Price realization (sections 4 and 5) is price divided by list, so with no list',
        'price on any invoiced part it cannot be computed at all.',
        '',
        'Either the price lists cover a different business unit from the transactions, or',
        'the two use identifiers that have not been bridged yet. Both have been seen.',
      ]);
    }
  }

  const { rows: [out] } = await client.query(`
    SELECT count(*) n, count(*) FILTER (WHERE has_booked IS NOT NULL) known FROM spa_items`);
  if (Number(out.n)) {
    console.log(`  win/loss known          ${out.known}/${out.n} item(s) (${pct(Number(out.known), Number(out.n))})`);
  }
}

async function exclusions(client) {
  const { rows } = await client.query(`
    SELECT 'invoice_lines' t, exclusion_reason r, count(*) n FROM invoice_lines
      WHERE excluded GROUP BY 1,2
    UNION ALL
    SELECT 'booking_lines', exclusion_reason, count(*) FROM booking_lines
      WHERE excluded GROUP BY 1,2
    UNION ALL
    SELECT 'spa_items', exclusion_reason, count(*) FROM spa_items
      WHERE excluded GROUP BY 1,2
    ORDER BY 3 DESC`);
  if (!rows.length) return;
  console.log('\nEXCLUDED FROM PEER STATISTICS\n');
  for (const r of rows) console.log(`  ${String(r.n).padStart(7)}  ${r.t}: ${r.r}`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
