#!/usr/bin/env node
/*
 * Sales Data -> invoice_lines.
 *
 * Section 2.1 of the target pricing specification needs invoice lines, and
 * this is the only extract that carries them. It is also the only source of a
 * cost basis: Extended Cost per line is what makes margin computable at all.
 *
 * Written against the column definitions and a four-row sample; ITT cannot
 * share extracts. So this loads rows rather than rejecting them, marks what
 * it excluded and why, and leaves the judgement calls to the diagnostics.
 *
 * Usage:
 *   node db/import/sales-data.mjs sales.tsv [--dry-run]
 */
import {
  date,
  number,
  parseArgs,
  readTable,
  requireDatabaseUrl,
  value,
} from './lib.mjs';
import { loadProductIndex, resolveProduct, customerRoleHint } from './resolve.mjs';
import pg from 'pg';

const COL = {
  businessUnit: 'Business Unit',
  orderNo: 'Order No',
  invoiceNumber: 'Invoice Number',
  invoiceDate: 'Invoice Date',
  customerNo: 'Customer No',
  customerName: 'customer_sold_to',
  itemNumber: 'item_number',
  itemCategory: 'Item Category',
  billingType: 'Billing Type',
  extendedSell: 'Extended Sell (USD)',
  extendedCost: 'Extended Cost (USD)',
  qtySold: 'Qty Sold',
  uom: 'UOM',
  currency: 'document_currency',
  customerPart: 'customer part',
  group: 'customer_group_description',
};

/*
 * Section 2.4: exclude intercompany, samples, zero-price lines, returns and
 * credit memos. Rows are marked rather than dropped, so the exclusions can be
 * counted and argued with.
 *
 * The zero-price rule is not theoretical here. One of four sample rows is a
 * no-charge rework billed at $0.009 against $9,477 of cost - a line margin of
 * -105,299,900%. A single row like that destroys any average it enters.
 */
function exclusionFor(row) {
  const billing = value(row[COL.billingType]);
  if (billing && !/^invoice$/i.test(billing)) {
    return `Billing Type is "${billing}", not Invoice`;
  }
  const sell = number(row[COL.extendedSell]);
  const qty = number(row[COL.qtySold]);
  if (sell === null || sell === 0) return 'No extended sell value';
  if (qty !== null && qty < 0) return 'Negative quantity (return or credit)';
  if (sell < 0) return 'Negative sell value (return or credit)';
  /*
   * A unit price this small is a no-charge line rather than a real price.
   * The threshold is deliberately low: the aim is to catch $0.001 rework
   * lines, not to second-guess a genuinely cheap part.
   */
  if (qty && sell / qty < 0.01) {
    return `Unit price ${(sell / qty).toFixed(5)} is effectively zero (no-charge line)`;
  }
  return null;
}

async function main() {
  const { file, dryRun } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error('Usage: node db/import/sales-data.mjs <file.tsv|file.csv> [--dry-run]');
    process.exit(1);
  }

  const { rows } = readTable(file, Object.values(COL));
  const connectionString = requireDatabaseUrl();
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const productIndex = await loadProductIndex(client);
    const { rows: customerRows } = await client.query('SELECT id FROM customers');
    const knownCustomers = new Set(customerRows.map((r) => r.id));

    const prepared = [];
    const stats = {
      excluded: new Map(),
      unresolvedParts: new Map(),
      matchKinds: new Map(),
      shipToUnknown: new Set(),
      roleMismatch: [],
      currencies: new Set(),
    };

    for (const row of rows) {
      const shipToNo = value(row[COL.customerNo]);
      const resolution = resolveProduct(productIndex, {
        internal: row[COL.itemNumber],
        catalog: null,
        description: null,
        alphaNum: null,
      });

      stats.matchKinds.set(
        resolution.matchedOn ?? 'unresolved',
        (stats.matchKinds.get(resolution.matchedOn ?? 'unresolved') || 0) + 1
      );
      if (!resolution.productId && resolution.matchedValue) {
        stats.unresolvedParts.set(
          resolution.matchedValue,
          (stats.unresolvedParts.get(resolution.matchedValue) || 0) + 1
        );
      }

      /*
       * Sales Data's Customer No is a ship-to, and ship-tos are not in
       * `customers` - that table holds bill-tos. Booking Data is what links
       * the two, so a sales row on its own usually cannot name a customer.
       * That is expected, not an error, and the diagnostics count it.
       */
      const hint = customerRoleHint(shipToNo);
      if (hint === 'bill-to') {
        stats.roleMismatch.push(shipToNo);
      }
      if (shipToNo && !knownCustomers.has(shipToNo)) stats.shipToUnknown.add(shipToNo);

      const currency = value(row[COL.currency]);
      if (currency) stats.currencies.add(currency);

      const reason = exclusionFor(row);
      if (reason) stats.excluded.set(reason, (stats.excluded.get(reason) || 0) + 1);

      prepared.push({
        businessUnit: value(row[COL.businessUnit]),
        orderNo: value(row[COL.orderNo]),
        invoiceNumber: value(row[COL.invoiceNumber]),
        invoiceDate: date(row[COL.invoiceDate]),
        shipToNo,
        shipToSite: value(row[COL.businessUnit]),
        customerId: knownCustomers.has(shipToNo) ? shipToNo : null,
        sourceCustomerName: value(row[COL.customerName]),
        sourcePartNumber: value(row[COL.itemNumber]),
        productId: resolution.productId,
        customerPart: value(row[COL.customerPart]),
        itemCategory: value(row[COL.itemCategory]),
        billingType: value(row[COL.billingType]),
        /* Space-padded to a fixed width in the sample. */
        channel: value(row[COL.group]),
        qtySold: number(row[COL.qtySold]),
        uom: value(row[COL.uom]),
        extendedSell: number(row[COL.extendedSell]),
        extendedCost: number(row[COL.extendedCost]),
        currency,
        excluded: reason !== null,
        exclusionReason: reason,
        matchedOn: resolution.matchedOn,
      });
    }

    report(rows.length, prepared, stats);

    if (dryRun) {
      console.log('\nDry run: nothing written.');
      return;
    }

    await client.query('BEGIN');
    for (const p of prepared) {
      await client.query(
        `INSERT INTO invoice_lines
           (business_unit, order_no, invoice_number, invoice_date, ship_to_no, ship_to_site,
            customer_id, source_customer_name, source_part_number, product_id, customer_part,
            item_category, billing_type, channel, qty_sold, uom, extended_sell, extended_cost,
            document_currency, excluded, exclusion_reason, attributes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         ON CONFLICT (invoice_number, order_no, source_part_number, invoice_date)
         DO UPDATE SET
           extended_sell = EXCLUDED.extended_sell,
           extended_cost = EXCLUDED.extended_cost,
           qty_sold      = EXCLUDED.qty_sold,
           product_id    = EXCLUDED.product_id,
           customer_id   = EXCLUDED.customer_id,
           excluded      = EXCLUDED.excluded,
           exclusion_reason = EXCLUDED.exclusion_reason,
           attributes    = invoice_lines.attributes || EXCLUDED.attributes`,
        [
          p.businessUnit, p.orderNo, p.invoiceNumber, p.invoiceDate, p.shipToNo, p.shipToSite,
          p.customerId, p.sourceCustomerName, p.sourcePartNumber, p.productId, p.customerPart,
          p.itemCategory, p.billingType, p.channel, p.qtySold, p.uom, p.extendedSell,
          p.extendedCost, p.currency, p.excluded, p.exclusionReason,
          JSON.stringify({ matched_on: p.matchedOn }),
        ]
      );
    }
    await client.query('COMMIT');
    console.log(`\nImported ${prepared.length} invoice line(s).`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

function report(total, prepared, stats) {
  const loaded = prepared.filter((p) => !p.excluded).length;
  console.log(`Read ${total} row(s) -> ${loaded} usable, ${total - loaded} excluded.\n`);

  console.log('Part number resolution:');
  for (const [kind, n] of [...stats.matchKinds].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(7)}  ${kind}`);
  }
  if (stats.unresolvedParts.size) {
    console.log(
      `\n  ${stats.unresolvedParts.size} distinct part number(s) matched no product. ` +
        `Sales Data carries only the internal number, so these need either an item ` +
        `master for this site or a Booking row to bridge them:`
    );
    for (const [pn, n] of [...stats.unresolvedParts].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`    ${pn}  (${n} line(s))`);
    }
  }

  if (stats.excluded.size) {
    console.log('\nExcluded (loaded and marked, not dropped):');
    for (const [reason, n] of [...stats.excluded].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(7)}  ${reason}`);
    }
  }

  if (stats.shipToUnknown.size) {
    console.log(
      `\n${stats.shipToUnknown.size} ship-to number(s) are not in customers. Expected: ` +
        `customers holds bill-tos, and Booking Data is what links a ship-to to one.`
    );
  }
  if (stats.roleMismatch.length) {
    console.log(
      `\n${stats.roleMismatch.length} Customer No value(s) look like bill-to numbers ` +
        `(000 prefix) in a ship-to column. Worth querying with ITT.`
    );
  }
  if (stats.currencies.size > 1) {
    console.log(
      `\nMore than one document currency present (${[...stats.currencies].join(', ')}), ` +
        `while the value columns are labelled USD. Confirm whether they are pre-converted.`
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
