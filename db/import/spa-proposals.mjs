#!/usr/bin/env node
/*
 * SPA proposals -> spa_proposals, spa_items, spa_item_tiers.
 *
 * This is ITT's quoting system, not a side dataset about special pricing. It
 * carries what most of the target pricing specification reads: win and loss
 * with reasons and competitors, the SPA identifier ship-and-debit matches on,
 * the three channel roles section 3.1 separates, engineering and
 * qualification hours for should-cost, design registration, and a six-slot
 * quantity break structure with margin per tier.
 *
 * ## What was verified against sample rows, and what was not
 *
 * Verified on eight tiers across three quotes:
 *   - MARGIN_n = (PRICE_GIVEN_OEM_n - COST_ESTIMATED) / PRICE_GIVEN_OEM_n.
 *     ITT computes margin on price, not markup on cost.
 *   - TOTAL_VALUE_n = QTY_MOQ_n * PRICE_GIVEN_OEM_n.
 *   - DISCOUNT_n is the step down from the tier above, NOT a discount off
 *     list. Stored under a name that says so.
 *   - PART_NO_ALPHA_NUM is uppercase with non-alphanumerics removed.
 *
 * Not verified, and reported rather than assumed:
 *   - BOOK_COST. It is not COST_ESTIMATED (402.39 against 56.70 on one line)
 *     and not a multiple of quantity. Loaded, never used for margin.
 *   - Code vocabularies. Statuses, reject reasons and category codes are
 *     stored as text; nothing here maps them.
 *
 * The source view has ~250 columns. What the specification reads is modelled;
 * everything else goes to `attributes` rather than being discarded, so a
 * column that turns out to matter can be promoted without reloading.
 *
 * Usage:
 *   node db/import/spa-proposals.mjs spa-items.tsv [--dry-run]
 */
import { number, parseArgs, readTable, requireDatabaseUrl, value } from './lib.mjs';
import { loadProductIndex, resolveProduct, normalisePartNumber } from './resolve.mjs';
import pg from 'pg';

/* Only these are required; the view's other ~230 columns are optional. */
const REQUIRED = ['PROPOSALID', 'ITEMID', 'PART_NO'];

const bool = (raw) => {
  const v = value(raw);
  if (v === null) return null;
  return /^(true|yes|y|1)$/i.test(v);
};

const ts = (raw) => {
  const v = value(raw);
  if (v === null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/* Columns modelled explicitly; the rest are kept in attributes. */
const MODELLED = new Set([
  'PROPOSALID','PROPOSAL_NAME','QUOTE_TYPE_DESCR','STATUS_DESCR','ITT_SITE_DESCR','REGION_DESCR',
  'QUOTING_REGION','SALES_REP_DESCR','CUST_ID','CUST_NAME','CUST_COUNTRY_CODE','CUST_STATE_CODE',
  'DIST_NAME','CEM_NAME','IS_ERP_CUSTOMER','OPP_CATEGORIES_DESCR','OPP_DESIGN_REGISTRATION',
  'PROGRAM_NAME','OFFER_CUR_CODE','EXCHANGE_RATE_TO_USD','TOTAL_VALUE','ESTIMATED_TOTAL_VALUE',
  'REQUESTED_ON','SUBMITTED_ON','COMPLETED_ON','REQUESTED_VALIDITY_DATE','RESPONSE_VALIDITY_DATE',
  'ORDER_NUMBER','IS_DELETED','INACTIVE','ITEMID','PART_NO','PART_NO_MANUF','PART_NO_DESCR',
  'PART_NO_CUSTOMER','PART_NO_COMPETITOR','PART_NO_ALPHA_NUM','PRODUCT_LINE','PRODUCT_SERIES',
  'PRODUCT_CATEGORY_DESCR','QTY','QTY_MOQ','PKG_QTY','COST_ESTIMATED','BOOK_COST',
  'DISTY_COST_GIVEN','PRICE_GIVEN_OEM','REQ_TARGET_PRICE_DISTR','REQ_TARGET_PRICE_RESALE',
  'ITT_MARGIN','DISTR_RESALE_MARGIN','TOTAL_LINE_VALUE','CURRENCY_GIVEN','ENG_HOURS',
  'ENG_CYCLETIME','QUAL_HOURS','QUAL_CYCLE_TIME','SHIP_DEBIT_BUILD_COST','ITEM_STATUS_DESCR',
  'ITEM_ORDER_STATUS_DESCR','HAS_BOOKED','NUMBER_OF_TIME_BOOKED','LOST_REASON_DESCR',
  'COMPETITOR_CODE','COMPETITOR_DESCR','REJECT_REASON_DESCR','LINE_ORDER_NUMBER','ITEM_INDEX',
  'ITEM_IS_DELETED','OBSOLETE',
]);

async function main() {
  const { file, dryRun } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error('Usage: node db/import/spa-proposals.mjs <file.tsv|file.csv> [--dry-run]');
    process.exit(1);
  }

  const { header, rows } = readTable(file, REQUIRED);
  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();

  try {
    const productIndex = await loadProductIndex(client);
    const { rows: customerRows } = await client.query('SELECT id FROM customers');
    const known = new Set(customerRows.map((r) => r.id));

    const proposals = new Map();
    const items = [];
    const stats = {
      matchKinds: new Map(),
      unresolved: new Map(),
      marginMismatch: [],
      tierMismatch: [],
      alphaNumMismatch: [],
      bookCostDiffers: 0,
      excluded: new Map(),
      custUnknown: new Set(),
      extraColumns: header.filter((h) => !MODELLED.has(h)).length,
    };

    for (const row of rows) {
      const proposalId = value(row.PROPOSALID);
      if (!proposalId) continue;

      if (!proposals.has(proposalId)) {
        const custId = value(row.CUST_ID);
        if (custId && !known.has(custId)) stats.custUnknown.add(custId);
        proposals.set(proposalId, {
          proposalId,
          proposalName: value(row.PROPOSAL_NAME),
          quoteType: value(row.QUOTE_TYPE_DESCR),
          status: value(row.STATUS_DESCR),
          ittSite: value(row.ITT_SITE_DESCR),
          region: value(row.REGION_DESCR),
          quotingRegion: value(row.QUOTING_REGION),
          salesRep: value(row.SALES_REP_DESCR),
          custId,
          customerId: custId && known.has(custId) ? custId : null,
          custName: value(row.CUST_NAME),
          custCountry: value(row.CUST_COUNTRY_CODE),
          custState: value(row.CUST_STATE_CODE),
          distName: value(row.DIST_NAME),
          cemName: value(row.CEM_NAME),
          isErpCustomer: bool(row.IS_ERP_CUSTOMER),
          oppCategory: value(row.OPP_CATEGORIES_DESCR),
          designRegistration: value(row.OPP_DESIGN_REGISTRATION),
          programName: value(row.PROGRAM_NAME),
          currency: value(row.OFFER_CUR_CODE),
          exchangeRate: number(row.EXCHANGE_RATE_TO_USD),
          totalValue: number(row.TOTAL_VALUE),
          estimatedTotalValue: number(row.ESTIMATED_TOTAL_VALUE),
          requestedOn: ts(row.REQUESTED_ON),
          submittedOn: ts(row.SUBMITTED_ON),
          completedOn: ts(row.COMPLETED_ON),
          requestedValidity: ts(row.REQUESTED_VALIDITY_DATE),
          responseValidity: ts(row.RESPONSE_VALIDITY_DATE),
          orderNumber: value(row.ORDER_NUMBER),
          isDeleted: bool(row.IS_DELETED) ?? false,
          inactive: bool(row.INACTIVE) ?? false,
        });
      }

      const resolution = resolveProduct(productIndex, {
        catalog: row.PART_NO,
        internal: row.PART_NO_MANUF,
        description: row.PART_NO_DESCR,
        alphaNum: row.PART_NO_ALPHA_NUM,
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
       * ITT's normalisation against ours. They should agree - ours was derived
       * from these very columns - so a disagreement means either a rule we
       * have not seen or a bad row, and either way someone should look.
       */
      const theirs = value(row.PART_NO_ALPHA_NUM);
      const ours = normalisePartNumber(row.PART_NO);
      if (theirs && ours && theirs.toUpperCase() !== ours) {
        stats.alphaNumMismatch.push({ part: value(row.PART_NO), theirs, ours });
      }

      const costEstimated = number(row.COST_ESTIMATED);
      const bookCost = number(row.BOOK_COST);
      if (costEstimated !== null && bookCost !== null && Math.abs(bookCost - costEstimated) > 0.01) {
        stats.bookCostDiffers += 1;
      }

      /* Six tier slots, unpivoted, with the stated margin checked. */
      const tiers = [];
      for (let n = 1; n <= 6; n++) {
        const qty = number(row[`QTY_MOQ_${n}`]);
        const price = number(row[`PRICE_GIVEN_OEM_${n}`]);
        if (qty === null && price === null) continue;
        const stated = number(row[`MARGIN_${n}`]);
        const total = number(row[`TOTAL_VALUE_${n}`]);

        if (stated !== null && price !== null && price > 0 && costEstimated !== null) {
          const computed = ((price - costEstimated) / price) * 100;
          if (Math.abs(computed - stated) > 0.5) {
            stats.marginMismatch.push({
              proposalId, tier: n, price, cost: costEstimated, stated,
              asMargin: computed, asMarkup: ((price - costEstimated) / costEstimated) * 100,
            });
          }
        }
        if (total !== null && qty !== null && price !== null) {
          if (Math.abs(qty * price - total) > 0.05) {
            stats.tierMismatch.push({ proposalId, tier: n, qty, price, total });
          }
        }

        tiers.push({
          index: n, qty, price,
          qtyRelease: number(row[`QTY_RELEASE_${n}`]),
          total, margin: stated,
          step: number(row[`DISCOUNT_${n}`]),
        });
      }

      const isDeleted = bool(row.ITEM_IS_DELETED) ?? false;
      const obsolete = bool(row.OBSOLETE) ?? false;
      let reason = null;
      if (isDeleted) reason = 'Item marked deleted';
      else if (obsolete) reason = 'Item marked obsolete';
      else if (bool(row.IS_DELETED)) reason = 'Proposal marked deleted';
      if (reason) stats.excluded.set(reason, (stats.excluded.get(reason) || 0) + 1);

      const extras = {};
      for (const h of header) {
        if (MODELLED.has(h)) continue;
        const v = value(row[h]);
        if (v !== null) extras[h.toLowerCase()] = v;
      }

      items.push({
        itemId: value(row.ITEMID), proposalId,
        itemIndex: number(row.ITEM_INDEX),
        partNo: value(row.PART_NO), partNoManuf: value(row.PART_NO_MANUF),
        partNoDescr: value(row.PART_NO_DESCR), partNoCustomer: value(row.PART_NO_CUSTOMER),
        partNoCompetitor: value(row.PART_NO_COMPETITOR), partNoAlphaNum: theirs,
        productId: resolution.productId,
        productLine: value(row.PRODUCT_LINE), productSeries: value(row.PRODUCT_SERIES),
        productCategory: value(row.PRODUCT_CATEGORY_DESCR),
        qty: number(row.QTY), qtyMoq: number(row.QTY_MOQ), pkgQty: number(row.PKG_QTY),
        costEstimated, bookCost, distyCostGiven: number(row.DISTY_COST_GIVEN),
        priceGivenOem: number(row.PRICE_GIVEN_OEM),
        reqTargetDistr: number(row.REQ_TARGET_PRICE_DISTR),
        reqTargetResale: number(row.REQ_TARGET_PRICE_RESALE),
        ittMargin: number(row.ITT_MARGIN), distrResaleMargin: number(row.DISTR_RESALE_MARGIN),
        totalLineValue: number(row.TOTAL_LINE_VALUE), currencyGiven: value(row.CURRENCY_GIVEN),
        engHours: number(row.ENG_HOURS), engCycletime: number(row.ENG_CYCLETIME),
        qualHours: number(row.QUAL_HOURS), qualCycleTime: number(row.QUAL_CYCLE_TIME),
        shipDebitBuildCost: number(row.SHIP_DEBIT_BUILD_COST),
        status: value(row.ITEM_STATUS_DESCR), orderStatus: value(row.ITEM_ORDER_STATUS_DESCR),
        hasBooked: bool(row.HAS_BOOKED), numberOfTimeBooked: number(row.NUMBER_OF_TIME_BOOKED),
        lostReason: value(row.LOST_REASON_DESCR),
        competitorCode: value(row.COMPETITOR_CODE), competitorName: value(row.COMPETITOR_DESCR),
        rejectReason: value(row.REJECT_REASON_DESCR),
        orderNumber: value(row.ORDER_NUMBER), lineOrderNumber: value(row.LINE_ORDER_NUMBER),
        isDeleted, obsolete,
        excluded: reason !== null, exclusionReason: reason,
        matchedOn: resolution.matchedOn, extras, tiers,
      });
    }

    report(rows.length, proposals, items, stats);
    if (dryRun) { console.log('\nDry run: nothing written.'); return; }

    await client.query('BEGIN');
    for (const p of proposals.values()) {
      await client.query(
        `INSERT INTO spa_proposals
           (proposal_id, proposal_name, quote_type, status, itt_site, region, quoting_region,
            sales_rep, cust_id, customer_id, cust_name, cust_country_code, cust_state_code,
            dist_name, cem_name, is_erp_customer, opp_category, design_registration, program_name,
            currency_code, exchange_rate_to_usd, total_value, estimated_total_value, requested_on,
            submitted_on, completed_on, requested_validity_date, response_validity_date,
            order_number, is_deleted, inactive, excluded, exclusion_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
                 $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
         ON CONFLICT (proposal_id) DO UPDATE SET
           status = EXCLUDED.status, total_value = EXCLUDED.total_value,
           completed_on = EXCLUDED.completed_on, order_number = EXCLUDED.order_number,
           customer_id = COALESCE(EXCLUDED.customer_id, spa_proposals.customer_id)`,
        [p.proposalId, p.proposalName, p.quoteType, p.status, p.ittSite, p.region, p.quotingRegion,
         p.salesRep, p.custId, p.customerId, p.custName, p.custCountry, p.custState, p.distName,
         p.cemName, p.isErpCustomer, p.oppCategory, p.designRegistration, p.programName,
         p.currency, p.exchangeRate, p.totalValue, p.estimatedTotalValue, p.requestedOn,
         p.submittedOn, p.completedOn, p.requestedValidity, p.responseValidity, p.orderNumber,
         p.isDeleted, p.inactive, p.isDeleted, p.isDeleted ? 'Proposal marked deleted' : null]
      );
    }

    for (const it of items) {
      const { rows: [inserted] } = await client.query(
        `INSERT INTO spa_items
           (item_id, proposal_id, item_index, part_no, part_no_manuf, part_no_descr,
            part_no_customer, part_no_competitor, part_no_alpha_num, product_id, product_line,
            product_series, product_category, qty, qty_moq, pkg_qty, cost_estimated, book_cost,
            disty_cost_given, price_given_oem, req_target_price_distr, req_target_price_resale,
            itt_margin, distr_resale_margin, total_line_value, currency_given, eng_hours,
            eng_cycletime, qual_hours, qual_cycle_time, ship_debit_build_cost, status,
            order_status, has_booked, number_of_time_booked, lost_reason, competitor_code,
            competitor_name, reject_reason, order_number, line_order_number, is_deleted,
            obsolete, excluded, exclusion_reason, attributes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
                 $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,
                 $42,$43,$44,$45,$46)
         ON CONFLICT (proposal_id, item_id) DO UPDATE SET
           price_given_oem = EXCLUDED.price_given_oem,
           cost_estimated  = EXCLUDED.cost_estimated,
           status          = EXCLUDED.status,
           has_booked      = EXCLUDED.has_booked,
           product_id      = COALESCE(EXCLUDED.product_id, spa_items.product_id),
           attributes      = spa_items.attributes || EXCLUDED.attributes
         RETURNING id`,
        [it.itemId, it.proposalId, it.itemIndex, it.partNo, it.partNoManuf, it.partNoDescr,
         it.partNoCustomer, it.partNoCompetitor, it.partNoAlphaNum, it.productId, it.productLine,
         it.productSeries, it.productCategory, it.qty, it.qtyMoq, it.pkgQty, it.costEstimated,
         it.bookCost, it.distyCostGiven, it.priceGivenOem, it.reqTargetDistr, it.reqTargetResale,
         it.ittMargin, it.distrResaleMargin, it.totalLineValue, it.currencyGiven, it.engHours,
         it.engCycletime, it.qualHours, it.qualCycleTime, it.shipDebitBuildCost, it.status,
         it.orderStatus, it.hasBooked, it.numberOfTimeBooked, it.lostReason, it.competitorCode,
         it.competitorName, it.rejectReason, it.orderNumber, it.lineOrderNumber, it.isDeleted,
         it.obsolete, it.excluded, it.exclusionReason,
         JSON.stringify({ matched_on: it.matchedOn, source: it.extras })]
      );

      await client.query('DELETE FROM spa_item_tiers WHERE spa_item_id = $1', [inserted.id]);
      for (const t of it.tiers) {
        await client.query(
          `INSERT INTO spa_item_tiers
             (spa_item_id, tier_index, qty_moq, price_given_oem, qty_release, total_value,
              margin_percent, step_from_previous_tier_percent)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [inserted.id, t.index, t.qty, t.price, t.qtyRelease, t.total, t.margin, t.step]
        );
      }

      /* Record every identifier this row knows the part by. */
      for (const [kind, pn] of [['catalog', it.partNo], ['internal', it.partNoManuf],
                                ['customer', it.partNoCustomer], ['competitor', it.partNoCompetitor]]) {
        if (!pn) continue;
        await client.query(
          `INSERT INTO product_part_numbers (product_id, kind, site, part_number, normalised, source)
           VALUES ($1,$2,NULL,$3,$4,'spa')
           ON CONFLICT (kind, site, part_number) DO UPDATE
             SET product_id = COALESCE(EXCLUDED.product_id, product_part_numbers.product_id)`,
          [it.productId, kind, pn, normalisePartNumber(pn)]
        );
      }
    }
    await client.query('COMMIT');
    console.log(
      `\nImported ${proposals.size} proposal(s), ${items.length} item(s), ` +
        `${items.reduce((n, i) => n + i.tiers.length, 0)} tier(s).`
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

function report(total, proposals, items, stats) {
  console.log(`Read ${total} row(s) -> ${proposals.size} proposal(s), ${items.length} item(s).`);
  console.log(`${stats.extraColumns} unmodelled column(s) preserved in attributes.\n`);

  console.log('Part number resolution:');
  for (const [k, n] of [...stats.matchKinds].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(7)}  ${k}`);
  }

  if (stats.marginMismatch.length) {
    console.log(`\n${stats.marginMismatch.length} tier(s) where the stated margin does not reconcile:`);
    for (const m of stats.marginMismatch.slice(0, 6)) {
      console.log(
        `  ${m.proposalId} tier ${m.tier}: price ${m.price}, cost ${m.cost}, stated ${m.stated}` +
        ` — as margin ${m.asMargin.toFixed(2)}, as markup ${m.asMarkup.toFixed(2)}`
      );
    }
    console.log('  Expected (price - COST_ESTIMATED) / price, which held on every sample tier.');
    console.log('  A mismatch means a different cost basis on those rows. Worth raising with ITT.');
  } else {
    console.log('\nStated margins reconcile to (price - COST_ESTIMATED) / price on every tier.');
  }

  if (stats.tierMismatch.length) {
    console.log(`\n${stats.tierMismatch.length} tier(s) where TOTAL_VALUE != QTY_MOQ x PRICE.`);
  }
  if (stats.alphaNumMismatch.length) {
    console.log(`\n${stats.alphaNumMismatch.length} row(s) where PART_NO_ALPHA_NUM disagrees with ours:`);
    for (const m of stats.alphaNumMismatch.slice(0, 6)) {
      console.log(`  ${m.part}: ITT ${m.theirs}, computed ${m.ours}`);
    }
    console.log('  Ours was derived from these columns, so a disagreement is a rule we have not seen.');
  }
  if (stats.bookCostDiffers) {
    console.log(
      `\n${stats.bookCostDiffers} item(s) where BOOK_COST differs from COST_ESTIMATED. ` +
        `Both are loaded; only COST_ESTIMATED is used for margin, because that is the one ` +
        `ITT's own MARGIN_n reconciles against.`
    );
  }
  if (stats.unresolved.size) {
    console.log(`\n${stats.unresolved.size} part(s) matched no product:`);
    for (const [pn, n] of [...stats.unresolved].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`    ${pn}  (${n})`);
    }
  }
  if (stats.excluded.size) {
    console.log('\nExcluded (marked, not dropped):');
    for (const [r, n] of stats.excluded) console.log(`  ${String(n).padStart(7)}  ${r}`);
  }
  if (stats.custUnknown.size) {
    console.log(`\n${stats.custUnknown.size} CUST_ID value(s) unknown to customers.`);
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
