#!/usr/bin/env node
/*
 * Booking Data -> booking_lines, and the two bridges.
 *
 * This extract earns its place twice over. It is the only one carrying both
 * customer keys and both part keys on the same row, so importing it teaches
 * the database two things nothing else can:
 *
 *   - which bill-to a ship-to belongs to, which is what links a quote (raised
 *     against a bill-to) to the invoice that followed (cut against a ship-to)
 *   - which catalog part number an internal part number refers to, which is
 *     what lets Sales Data resolve to products at all
 *
 * So it writes `customer_ship_to` and `product_part_numbers` as well as its
 * own rows, and a Sales import run afterwards will resolve parts it could not
 * resolve before.
 *
 * Usage:
 *   node db/import/booking-data.mjs booking.tsv [--dry-run]
 */
import { date, number, parseArgs, readTable, requireDatabaseUrl, value } from './lib.mjs';
import {
  catalogPartNumber,
} from './lib.mjs';
import { loadProductIndex, normalisePartNumber, resolveProduct } from './resolve.mjs';
import pg from 'pg';

const COL = {
  bookingDate: 'Booking Date',
  organization: 'Organization L2',
  region: 'Region',
  marketType: 'Market Type',
  orderNumber: 'Order Number',
  itemNumber: 'Item Number',
  itemDescription: 'Item Description',
  productSegment: 'Product Segment',
  keyAccount: 'Key Account Name',
  billTo: 'CustKey Billto',
  billToName: 'Customer Billto',
  shipTo: 'CustKey Shipto',
  shipToName: 'Customer Shipto',
  salesman: 'Salesman',
  intercompany: 'Intercompany',
  orderQty: 'Order Qty',
  orderValue: 'Order Value USD',
  orderCost: 'Order Cost USD',
};

const truthy = (raw) => {
  const v = value(raw);
  if (v === null) return null;
  return /^(yes|true|y|1)$/i.test(v);
};

async function main() {
  const { file, dryRun } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error('Usage: node db/import/booking-data.mjs <file.tsv|file.csv> [--dry-run]');
    process.exit(1);
  }

  const { rows } = readTable(file, Object.values(COL));
  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();

  try {
    const productIndex = await loadProductIndex(client);
    const { rows: customerRows } = await client.query('SELECT id FROM customers');
    const knownCustomers = new Set(customerRows.map((r) => r.id));

    const prepared = [];
    const shipTos = new Map();
    const partBridges = new Map();
    const stats = {
      matchKinds: new Map(),
      unresolved: new Map(),
      intercompany: 0,
      zeroValueWithCost: 0,
      negativeCost: 0,
      billToUnknown: new Set(),
    };

    for (const row of rows) {
      const internal = value(row[COL.itemNumber]);
      const catalog = catalogPartNumber(row[COL.itemDescription]);
      const resolution = resolveProduct(productIndex, {
        catalog: row[COL.itemDescription],
        internal,
        description: row[COL.itemDescription],
        alphaNum: null,
      });

      stats.matchKinds.set(
        resolution.matchedOn ?? 'unresolved',
        (stats.matchKinds.get(resolution.matchedOn ?? 'unresolved') || 0) + 1
      );
      if (!resolution.productId && resolution.matchedValue) {
        stats.unresolved.set(
          resolution.matchedValue,
          (stats.unresolved.get(resolution.matchedValue) || 0) + 1
        );
      }

      /*
       * The part bridge. Even when neither identifier resolves to a product
       * yet, the pairing itself is worth keeping: once an item master for the
       * site arrives, these rows connect Sales Data to it without a reload.
       */
      if (internal && catalog) {
        partBridges.set(`${value(row[COL.organization]) ?? ''}|${internal}`, {
          site: value(row[COL.organization]),
          internal,
          catalog,
          productId: resolution.productId,
        });
      }

      const billTo = value(row[COL.billTo]);
      const shipTo = value(row[COL.shipTo]);
      if (billTo && !knownCustomers.has(billTo)) stats.billToUnknown.add(billTo);

      /* The customer bridge. */
      if (shipTo) {
        const site = value(row[COL.organization]);
        shipTos.set(`${site ?? ''}|${shipTo}`, {
          site: site ?? 'UNKNOWN',
          shipTo,
          name: value(row[COL.shipToName]),
          customerId: billTo && knownCustomers.has(billTo) ? billTo : null,
        });
      }

      const inter = truthy(row[COL.intercompany]);
      if (inter) stats.intercompany += 1;

      const qty = number(row[COL.orderQty]);
      const val = number(row[COL.orderValue]);
      const cost = number(row[COL.orderCost]);
      if ((val === 0 || val === null) && cost !== null && Math.abs(cost) > 0.01) {
        stats.zeroValueWithCost += 1;
      }
      if (cost !== null && cost < 0) stats.negativeCost += 1;

      prepared.push({
        bookingDate: date(row[COL.bookingDate]),
        organization: value(row[COL.organization]),
        region: value(row[COL.region]),
        marketType: value(row[COL.marketType]),
        orderNumber: value(row[COL.orderNumber]),
        sourcePartNumber: internal,
        sourcePartDescription: catalog,
        productId: resolution.productId,
        productSegment: value(row[COL.productSegment]),
        keyAccountName: value(row[COL.keyAccount]),
        billToNo: billTo,
        billToName: value(row[COL.billToName]),
        customerId: billTo && knownCustomers.has(billTo) ? billTo : null,
        shipToNo: shipTo,
        shipToName: value(row[COL.shipToName]),
        shipToSite: value(row[COL.organization]),
        salesman: value(row[COL.salesman]),
        intercompany: inter,
        orderQty: qty,
        orderValue: val,
        orderCost: cost,
        /* Spec 2.4 excludes intercompany from peer statistics. */
        excluded: inter === true,
        exclusionReason: inter === true ? 'Intercompany' : null,
        matchedOn: resolution.matchedOn,
      });
    }

    report(rows.length, prepared, stats, shipTos, partBridges);

    if (dryRun) {
      console.log('\nDry run: nothing written.');
      return;
    }

    await client.query('BEGIN');

    for (const s of shipTos.values()) {
      await client.query(
        `INSERT INTO customer_ship_to (site, ship_to_no, name, customer_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (site, ship_to_no) DO UPDATE
           SET name = COALESCE(EXCLUDED.name, customer_ship_to.name),
               customer_id = COALESCE(EXCLUDED.customer_id, customer_ship_to.customer_id)`,
        [s.site, s.shipTo, s.name, s.customerId]
      );
    }

    for (const b of partBridges.values()) {
      /* Both sides recorded, so a later item master completes the link. */
      await client.query(
        `INSERT INTO product_part_numbers (product_id, kind, site, part_number, normalised, source)
         VALUES ($1,'internal',$2,$3,$4,'booking')
         ON CONFLICT (kind, site, part_number) DO UPDATE
           SET product_id = COALESCE(EXCLUDED.product_id, product_part_numbers.product_id)`,
        [b.productId, b.site, b.internal, normalisePartNumber(b.internal)]
      );
      await client.query(
        `INSERT INTO product_part_numbers (product_id, kind, site, part_number, normalised, source)
         VALUES ($1,'catalog',NULL,$2,$3,'booking')
         ON CONFLICT (kind, site, part_number) DO UPDATE
           SET product_id = COALESCE(EXCLUDED.product_id, product_part_numbers.product_id)`,
        [b.productId, b.catalog, normalisePartNumber(b.catalog)]
      );
    }

    for (const p of prepared) {
      await client.query(
        `INSERT INTO booking_lines
           (booking_date, organization, region, market_type, order_number, source_part_number,
            source_part_description, product_id, product_segment, key_account_name, bill_to_no,
            bill_to_name, customer_id, ship_to_no, ship_to_name, ship_to_site, salesman,
            intercompany, order_qty, order_value_usd, order_cost_usd, excluded, exclusion_reason,
            attributes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         ON CONFLICT (order_number, source_part_number, booking_date) DO UPDATE
           SET order_qty = EXCLUDED.order_qty,
               order_value_usd = EXCLUDED.order_value_usd,
               order_cost_usd = EXCLUDED.order_cost_usd,
               product_id = COALESCE(EXCLUDED.product_id, booking_lines.product_id),
               customer_id = COALESCE(EXCLUDED.customer_id, booking_lines.customer_id)`,
        [
          p.bookingDate, p.organization, p.region, p.marketType, p.orderNumber,
          p.sourcePartNumber, p.sourcePartDescription, p.productId, p.productSegment,
          p.keyAccountName, p.billToNo, p.billToName, p.customerId, p.shipToNo, p.shipToName,
          p.shipToSite, p.salesman, p.intercompany, p.orderQty, p.orderValue, p.orderCost,
          p.excluded, p.exclusionReason, JSON.stringify({ matched_on: p.matchedOn }),
        ]
      );
    }

    await client.query('COMMIT');
    console.log(
      `\nImported ${prepared.length} booking line(s), ${shipTos.size} ship-to location(s) ` +
        `and ${partBridges.size * 2} part identifier(s).`
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

function report(total, prepared, stats, shipTos, partBridges) {
  console.log(`Read ${total} row(s).\n`);
  console.log('Part number resolution:');
  for (const [kind, n] of [...stats.matchKinds].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(7)}  ${kind}`);
  }
  console.log(`\nBridges this file establishes:`);
  console.log(`  ${String(shipTos.size).padStart(7)}  ship-to location(s), linked to a bill-to where known`);
  console.log(`  ${String(partBridges.size).padStart(7)}  internal-to-catalog part pairing(s)`);

  const linked = [...shipTos.values()].filter((s) => s.customerId).length;
  if (linked < shipTos.size) {
    console.log(
      `\n  ${shipTos.size - linked} ship-to(s) could not be linked: their bill-to is not in ` +
        `customers. Load the bill-to master first to complete the bridge.`
    );
  }
  if (stats.billToUnknown.size) {
    console.log(`  ${stats.billToUnknown.size} distinct bill-to number(s) unknown to customers.`);
  }
  if (stats.unresolved.size) {
    console.log(`\n${stats.unresolved.size} part(s) matched no product:`);
    for (const [pn, n] of [...stats.unresolved].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`    ${pn}  (${n})`);
    }
    console.log('  Their identifier pairings are still recorded, so an item master loaded');
    console.log('  later completes the link without re-importing this file.');
  }
  if (stats.intercompany) {
    console.log(`\n${stats.intercompany} intercompany row(s) marked excluded (spec 2.4).`);
  }
  if (stats.zeroValueWithCost) {
    console.log(
      `\n${stats.zeroValueWithCost} row(s) carry zero order value against a non-zero cost. ` +
        `Present in the sample too; confirm with ITT whether that is real or an extract artifact.`
    );
  }
  if (stats.negativeCost) {
    console.log(`${stats.negativeCost} row(s) carry a negative cost (cancellation or adjustment).`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
