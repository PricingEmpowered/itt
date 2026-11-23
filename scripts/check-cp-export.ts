/**
 * Checks on reading the real Channel Partners export.
 *
 *   npx tsx scripts/check-cp-export.ts
 *
 * The header row below is the export's actual column list, which is schema.
 * The row values are synthetic: the real export carries named people and ITT's
 * own pricing, and neither belongs in a repository fixture.
 *
 * What these pin down is the part most likely to be quietly wrong: which of
 * the hundred columns is read as the cost, and which are deliberately not.
 */

import assert from 'node:assert/strict';
import { detectDelimiter } from '../src/utils/csv';
import { parseChannelPartnersForm, requestIdOf } from '../src/utils/channelPartnersForm';

let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message}`);
    console.log(`  FAIL ${name}`);
    console.log(`       ${(e as Error).message.split('\n')[0]}`);
  }
}

/** The export's columns, in order. */
const HEADERS = (
  'ITEMID PART_NO PART_NO_MANUF QTY QTY_TYPE QTY_TYPE_DESCR PART_NO_COMPETITOR PART_NO_CUSTOMER ' +
  'LEAD_TIME_REQUEST DRAWING_REVISION CURRENCY_TARGET CURRENCY_TARGET_DESCR PRODUCT_CATEGORY ' +
  'PRODUCT_CATEGORY_DESCR QUOTE_TYPE QUOTE_TYPE_DESCR CURRENCY_GIVEN CURRENCY_GIVEN_DESCR PKG_QTY ' +
  'LEAD_TIME_GIVEN REJECT IS_DELETED DATE_DELETED ITEMID_ORIG INACTIVE VIEWING_CODES ' +
  'VIEWING_CODES_READ_ONLY COMMENTS_EXTERNAL COMMENTS_INTERNAL COMMENTS_RFQ COMMENTS_FACTORY ' +
  'PRODUCT_LINE PRODUCT_SERIES PMU ASSIGNED_TO_PM ASSIGNED_TO_PM_DESCR LEAD_TIME_REQUEST_DESCR ' +
  'LEAD_TIME_GIVEN_DESCR SHIP_DEBIT_BUILD_COST INVENTORY_ON_HAND COST_MAKE_UP COST_MAKE_UP_DESCR ' +
  'STATUS_CODE QTY_MOQ BOOK_COST REQ_TARGET_PRICE_DISTR REQ_TARGET_PRICE_RESALE COST_ESTIMATED ' +
  'PRICE_TRANSFER ITEM_INDEX ORDER_STATUS ORDER_STATUS_DESCR NUMBER_OF_TIME_BOOKED COMMENTS_LOST ' +
  'LOST_REASON LOST_REASON_DESCR ORDER_HANDLING_LOC ORDER_HANDLING_LOC_DESCR DISTY_COST_GIVEN ' +
  'AFFILIATE_SPA_DESTINATION_REGION_REQ_DESCR HAS_RESPONSE AFFILIATE_SPA_DESTINATION_REGION_REQ ' +
  'PRODUCT_LINE_CODE STATUS_DESCR AUTO_LAST_UPDATE EXCEL_IMPORTID_OLD PART_NO_DESCR LEAD_TIME_EST ' +
  'REJECT_REASON_CODE REJECT_REASON_DESCR COMPETITOR_OTHER_VALUE DISCOUNT_TYPE_CODE ' +
  'DISCOUNT_TYPE_DESCR UNIT_DISCOUNT TOTAL_DISCOUNT ITT_MARGIN DISTR_RESALE_MARGIN PRICE_GIVEN_OEM ' +
  'PRICING_CONDITION_CODE PRICING_CONDITION_DESCR WEEKLY_RATE COMMENTS_REJECTED_REASON ' +
  'COMMENTS_PM_CODE COMMENTS_PM_DESCR CURRENCY_FROM_PRICE_CONF TOTAL_LINE_VALUE OBSOLETE ' +
  'INTERNAL_PRODUCT_LINE INTERNAL_PRODUCT_LINE_CODE EXCEL_IMPORTID QTY_MOQ_RESPONSE ' +
  'ITEM_ESTIMATED_TOTAL_VALUE ADD_TO_CP COMPLETED_ON_ORIG COMPLETED_BY_CODE_ORIG ' +
  'COMPLETED_BY_NAME_ORIG HAS_BOOKED QUOTING_REGION_DESCR_I QUOTING_REGION_CODE_I ' +
  'LINE_ORDER_NUMBER COST_PROJECTED'
).split(' ');

/** A row with every column NULL except the ones given, as the export writes it. */
function row(values: Record<string, string>): string {
  for (const k of Object.keys(values)) assert.ok(HEADERS.includes(k), `unknown column ${k}`);
  return HEADERS.map((h) => values[h] ?? 'NULL').join('\t');
}
const file = (...rows: string[]) => [HEADERS.join('\t'), ...rows].join('\n');

const BASE = {
  ITEMID: 'REP.ONE_26_01_01_1700000000000_0001A',
  PART_NO: 'TST-100-A',
  PART_NO_MANUF: '000T00001',
  QTY: '10',
  CURRENCY_GIVEN: 'EUR',
  PRODUCT_LINE: 'Test Line',
  COST_ESTIMATED: '41.25',
  IS_DELETED: '0',
  INACTIVE: '0',
};

console.log('\nthe separator');

check('the header has 101 columns', () => assert.equal(HEADERS.length, 101));
check('tabs are detected', () => assert.equal(detectDelimiter(file(row(BASE))), '\t'));
check('commas are still detected', () => assert.equal(detectDelimiter('Part,Qty,Cost\nA,1,2'), ','));
check('semicolons are detected', () => assert.equal(detectDelimiter('Part;Qty;Cost\nA;1;2'), ';'));
check('a comma inside quotes does not decide it', () =>
  assert.equal(detectDelimiter('"Part, number";Qty;Cost\nA;1;2'), ';'));
check('an empty or separator-free first line is a comma', () => {
  assert.equal(detectDelimiter(''), ',');
  assert.equal(detectDelimiter('Part\nA'), ',');
});
check('a byte order mark does not disturb it', () =>
  assert.equal(detectDelimiter('﻿Part\tQty\nA\t1'), '\t'));

console.log('\nreading the export');

check('the file reads without a fatal error', () => {
  const f = parseChannelPartnersForm(file(row(BASE)));
  assert.deepEqual(f.fatal, []);
  assert.equal(f.delimiter, '\t');
  assert.equal(f.lines.length, 1);
});

check('each field comes from the column named for it', () => {
  const m = parseChannelPartnersForm(file(row(BASE))).matchedHeaders;
  assert.equal(m.partNumber, 'PART_NO');
  assert.equal(m.altPartNumber, 'PART_NO_MANUF');
  assert.equal(m.quantity, 'QTY');
  assert.equal(m.moq, 'QTY_MOQ');
  assert.equal(m.cost, 'COST_ESTIMATED');
  assert.equal(m.productLine, 'PRODUCT_LINE');
  assert.equal(m.region, 'QUOTING_REGION_DESCR_I');
  assert.equal(m.currency, 'CURRENCY_GIVEN');
  assert.equal(m.itemId, 'ITEMID');
  assert.equal(m.description, 'PART_NO_DESCR');
  assert.equal(m.requestedResalePrice, 'REQ_TARGET_PRICE_RESALE');
  assert.equal(m.requestedDistributorPrice, 'REQ_TARGET_PRICE_DISTR');
});

check('values come through', () => {
  const l = parseChannelPartnersForm(
    file(
      row({
        ...BASE,
        QTY_MOQ: '10',
        REQ_TARGET_PRICE_RESALE: '136.48',
        QUOTING_REGION_DESCR_I: 'EMEA',
        PART_NO_DESCR: 'TST-100-A DESCRIPTION',
      })
    )
  ).lines[0];
  assert.equal(l.partNumber, 'TST-100-A');
  assert.equal(l.altPartNumber, '000T00001');
  assert.equal(l.quantity, 10);
  assert.equal(l.moq, 10);
  assert.equal(l.cost, 41.25);
  assert.equal(l.productLine, 'Test Line');
  assert.equal(l.region, 'EMEA');
  assert.equal(l.currency, 'EUR');
  assert.equal(l.itemId, 'REP.ONE_26_01_01_1700000000000_0001A');
  assert.equal(l.requestedResalePrice, 136.48);
  assert.deepEqual(l.errors, []);
});

check('the product line is read, not the product category', () => {
  const l = parseChannelPartnersForm(
    file(row({ ...BASE, PRODUCT_CATEGORY: 'COM', PRODUCT_CATEGORY_DESCR: 'Competitive' }))
  ).lines[0];
  assert.equal(l.productLine, 'Test Line');
});

check('about eighty columns are reported as not used', () => {
  const f = parseChannelPartnersForm(file(row(BASE)));
  assert.ok(f.unmappedHeaders.length > 70, `only ${f.unmappedHeaders.length}`);
});

console.log('\nNULL is an empty cell');

check('NULL is not a value, in any case', () => {
  const l = parseChannelPartnersForm(file(row({ ...BASE, COST_ESTIMATED: 'null', PART_NO_DESCR: 'Null' }))).lines[0];
  assert.equal(l.cost, null);
  assert.equal(l.description, null);
});

check('a part number of NULL is a missing part number, not a part called NULL', () => {
  const l = parseChannelPartnersForm(file(row({ ...BASE, PART_NO: 'NULL' }))).lines[0];
  assert.equal(l.partNumber, null);
  assert.ok(l.errors.some((e) => e.includes('No part number')));
});

check('a quantity of NULL is a missing quantity, not a 1', () => {
  const l = parseChannelPartnersForm(file(row({ ...BASE, QTY: 'NULL' }))).lines[0];
  assert.equal(l.quantity, null);
  assert.ok(l.errors.some((e) => e.includes('No quantity')));
});

console.log('\nthe cost, and what is deliberately not the cost');

check('the cost is COST_ESTIMATED', () => {
  assert.equal(parseChannelPartnersForm(file(row(BASE))).lines[0].cost, 41.25);
});

check('BOOK_COST is never read as the cost, even when it is the only one present', () => {
  const only = parseChannelPartnersForm(file(row({ ...BASE, COST_ESTIMATED: 'NULL', BOOK_COST: '182.02' }))).lines[0];
  assert.equal(only.cost, null, 'BOOK_COST leaked into cost');
});

check('and it does not displace COST_ESTIMATED when both are present', () => {
  const both = parseChannelPartnersForm(file(row({ ...BASE, BOOK_COST: '182.02' }))).lines[0];
  assert.equal(both.cost, 41.25);
});

check('BOOK_COST is reported as a column that was not used', () => {
  const f = parseChannelPartnersForm(file(row({ ...BASE, BOOK_COST: '182.02' })));
  assert.ok(f.unmappedHeaders.includes('BOOK_COST'));
});

check('BOOK_COST is not read as a list price either, until ITT defines it', () => {
  const l = parseChannelPartnersForm(file(row({ ...BASE, BOOK_COST: '182.02' }))).lines[0];
  assert.equal(l.listPrice, null);
});

check('the export has no list price column, so none is invented', () => {
  assert.equal(parseChannelPartnersForm(file(row(BASE))).lines[0].listPrice, null);
});

check('a column literally named list price is still read', () => {
  const l = parseChannelPartnersForm('PART_NO\tQTY\tLIST_PRICE\nX\t1\t99.5').lines[0];
  assert.equal(l.listPrice, 99.5);
});

check('a zero in a cost column means not supplied, and never a zero cost', () => {
  const l = parseChannelPartnersForm(file(row({ ...BASE, COST_ESTIMATED: '0' }))).lines[0];
  assert.equal(l.cost, null);
  assert.deepEqual(l.errors, []);
});

check('an unreadable cost is an error, not a zero', () => {
  const l = parseChannelPartnersForm(file(row({ ...BASE, COST_ESTIMATED: 'TBC' }))).lines[0];
  assert.equal(l.cost, null);
  assert.ok(l.errors.some((e) => e.includes('Cost "TBC"')));
});

console.log('\nrequested prices are information, not ITT\'s price');

check('the requested resale and distributor prices are kept separately', () => {
  const l = parseChannelPartnersForm(
    file(row({ ...BASE, REQ_TARGET_PRICE_RESALE: '169', REQ_TARGET_PRICE_DISTR: '120' }))
  ).lines[0];
  assert.equal(l.requestedResalePrice, 169);
  assert.equal(l.requestedDistributorPrice, 120);
});

console.log('\nlines that should not be priced');

for (const [col, text] of [
  ['IS_DELETED', 'Deleted'],
  ['INACTIVE', 'inactive'],
  ['REJECT', 'Rejected'],
] as const) {
  check(`${col}=1 is an error on that row`, () => {
    const l = parseChannelPartnersForm(file(row({ ...BASE, [col]: '1' }))).lines[0];
    assert.ok(l.errors.some((e) => e.includes(text)), l.errors.join('|'));
  });
}

check('a withdrawn line is flagged so it can be left out of the quote', () => {
  const f = parseChannelPartnersForm(
    file(row(BASE), row({ ...BASE, IS_DELETED: '1' }), row({ ...BASE, REJECT: '1' }), row({ ...BASE, QTY: 'many' }))
  );
  assert.deepEqual(
    f.lines.map((l) => l.withdrawn),
    [false, true, true, false],
    'a bad quantity is not a withdrawn line: it stays so someone can correct it'
  );
});

check('0 and NULL in the flag columns are fine', () => {
  const l = parseChannelPartnersForm(file(row({ ...BASE, REJECT: 'NULL', IS_DELETED: '0', INACTIVE: '0' }))).lines[0];
  assert.deepEqual(l.errors, []);
});

check('a deleted line is kept, so the line count matches the file', () => {
  const f = parseChannelPartnersForm(file(row(BASE), row({ ...BASE, IS_DELETED: '1' }), row(BASE)));
  assert.equal(f.lines.length, 3);
  assert.equal(f.lines[1].errors.length, 1);
});

console.log('\nthe identifier that has to come back');

check('ITEMID is carried on every line', () => {
  const f = parseChannelPartnersForm(
    file(row(BASE), row({ ...BASE, ITEMID: 'REP.ONE_26_01_01_1700000000001_0002B' }))
  );
  assert.deepEqual(
    f.lines.map((l) => l.itemId),
    ['REP.ONE_26_01_01_1700000000000_0001A', 'REP.ONE_26_01_01_1700000000001_0002B']
  );
});

check('a request is not guessed from EXCEL_IMPORTID or LINE_ORDER_NUMBER', () => {
  const f = parseChannelPartnersForm(
    file(
      row({ ...BASE, EXCEL_IMPORTID: 'BATCH_A', LINE_ORDER_NUMBER: '77013' }),
      row({ ...BASE, EXCEL_IMPORTID: 'BATCH_B', LINE_ORDER_NUMBER: '73778' })
    )
  );
  assert.deepEqual(requestIdOf(f), { id: null, conflict: [] });
});

console.log('\ncurrency and history');

check('one currency across the file is reported', () => {
  const f = parseChannelPartnersForm(file(row(BASE), row(BASE)));
  assert.equal(f.currency, 'EUR');
  assert.deepEqual(f.mixedCurrencies, []);
});

check('mixed currencies are reported and no single one is claimed', () => {
  const f = parseChannelPartnersForm(file(row(BASE), row({ ...BASE, CURRENCY_GIVEN: 'USD' })));
  assert.equal(f.currency, null);
  assert.deepEqual(f.mixedCurrencies.sort(), ['EUR', 'USD']);
});

check('lines that already carry an outcome are counted, since that is history not a request', () => {
  const f = parseChannelPartnersForm(
    file(row({ ...BASE, ORDER_STATUS_DESCR: 'Won' }), row(BASE), row({ ...BASE, ORDER_STATUS_DESCR: 'Won' }))
  );
  assert.equal(f.linesWithOutcome, 2);
});

console.log('\nthe original behaviour still holds');

check('comma-separated files still read', () => {
  const f = parseChannelPartnersForm('Part No.,Qty,List Price,Unit Cost\nABC,5,100,60');
  assert.deepEqual(f.fatal, []);
  assert.equal(f.lines[0].cost, 60);
  assert.equal(f.lines[0].listPrice, 100);
});

check('Windows line endings in a tab-separated file are handled', () => {
  const f = parseChannelPartnersForm(file(row(BASE), row(BASE)).replace(/\n/g, '\r\n'));
  assert.equal(f.lines.length, 2);
  assert.equal(f.lines[0].currency, 'EUR');
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
