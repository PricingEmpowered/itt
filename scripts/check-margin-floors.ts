/**
 * Checks on which minimum margin applies to a line, and on the live approval
 * comparison made as the analyst edits a price.
 *
 *   npx tsx scripts/check-margin-floors.ts
 *
 * These decide who has to approve a quote, so the rule for "which row wins"
 * and the edge at exactly the minimum margin are pinned down here rather than
 * discovered on a customer's quote.
 */

import assert from 'node:assert/strict';
import {
  resolveFloor,
  canonicalRegion,
  normaliseProductLine,
  type MarginFloorRow,
} from '../server/pricing/marginFloors.js';
import { assessEscalation, summariseEscalation } from '../src/utils/escalation';

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

const row = (
  productLine: string,
  region: string,
  minimumMargin: number,
  extra: Partial<MarginFloorRow> = {}
): MarginFloorRow => ({
  authorityLevel: 'analyst',
  productLine,
  region,
  minimumMargin,
  isPlaceholder: false,
  note: null,
  ...extra,
});

const DEFAULT_ROW = row('*', '*', 0.3, { isPlaceholder: true, note: 'holder' });

console.log('\nthe placeholder');

check('with only the default row, every line gets 30% and it is marked a placeholder', () => {
  for (const [line, region] of [
    ['38999 Series', 'North America'],
    ['Pumps', 'Europe'],
    [null, null],
    ['Anything', 'Asia Pacific'],
  ] as const) {
    const r = resolveFloor([DEFAULT_ROW], 'analyst', line, region);
    assert.equal(r.minimumMargin, 0.3, `${line}/${region}`);
    assert.equal(r.isPlaceholder, true);
  }
});

console.log('\nwhich row wins');

const ALL = [
  DEFAULT_ROW,
  row('*', 'Europe', 0.33),
  row('Pumps', '*', 0.41),
  row('Pumps', 'Europe', 0.52),
];

check('product line and region together beat everything', () => {
  assert.equal(resolveFloor(ALL, 'analyst', 'Pumps', 'Europe').minimumMargin, 0.52);
});

check('product line in any region beats a region default', () => {
  assert.equal(resolveFloor(ALL, 'analyst', 'Pumps', 'North America').minimumMargin, 0.41);
});

check('a region default beats the global default', () => {
  assert.equal(resolveFloor(ALL, 'analyst', 'Valves', 'Europe').minimumMargin, 0.33);
});

check('the global default applies when nothing more specific does', () => {
  assert.equal(resolveFloor(ALL, 'analyst', 'Valves', 'North America').minimumMargin, 0.3);
});

check('row order in the table does not change the answer', () => {
  const shuffled = [ALL[3], ALL[0], ALL[2], ALL[1]];
  assert.equal(resolveFloor(shuffled, 'analyst', 'Pumps', 'Europe').minimumMargin, 0.52);
  assert.equal(resolveFloor(shuffled, 'analyst', 'Valves', 'Europe').minimumMargin, 0.33);
});

check('product lines match ignoring case and spacing', () => {
  assert.equal(resolveFloor(ALL, 'analyst', '  PUMPS ', 'Europe').minimumMargin, 0.52);
  assert.equal(
    resolveFloor([DEFAULT_ROW, row('38999 Series I', '*', 0.57)], 'analyst', '38999   series i', null)
      .minimumMargin,
    0.57
  );
});

check('an unrecognised region is never assumed, it falls to the product line', () => {
  assert.equal(resolveFloor(ALL, 'analyst', 'Pumps', 'Antarctica').minimumMargin, 0.41);
});

check('a missing region and a missing product line use the default', () => {
  assert.equal(resolveFloor(ALL, 'analyst', null, null).minimumMargin, 0.3);
});

check('the reason names the row that applied', () => {
  const r = resolveFloor(ALL, 'analyst', 'Pumps', 'Europe');
  assert.ok(r.reason.includes('52.0%') && r.reason.includes('Pumps in Europe'), r.reason);
});

console.log('\nauthority levels');

check('rows for another level are ignored', () => {
  const rows = [DEFAULT_ROW, row('Pumps', '*', 0.1, { authorityLevel: 'director' })];
  assert.equal(resolveFloor(rows, 'analyst', 'Pumps', null).minimumMargin, 0.3);
  assert.equal(resolveFloor(rows, 'director', 'Pumps', null).minimumMargin, 0.1);
});

console.log('\nno row applies');

check('with no default row an unmatched line gets nothing, not a built-in number', () => {
  const r = resolveFloor([row('Pumps', 'Europe', 0.5)], 'analyst', 'Valves', 'North America');
  assert.equal(r.minimumMargin, null);
  assert.ok(r.reason.includes('no default row'));
});

check('an empty table gives nothing', () => {
  assert.equal(resolveFloor([], 'analyst', 'Pumps', 'Europe').minimumMargin, null);
});

console.log('\nregions and names');

check('region spellings map to the three the table uses', () => {
  assert.equal(canonicalRegion('North America'), 'North America');
  assert.equal(canonicalRegion(' europe '), 'Europe');
  assert.equal(canonicalRegion('Asia Pacific'), 'Asia Pacific');
  assert.equal(canonicalRegion('Asia'), 'Asia Pacific');
  assert.equal(canonicalRegion('APAC'), 'Asia Pacific');
});

check('anything else is null rather than a guess', () => {
  for (const v of ['Antarctica', '', null, undefined, 'US']) {
    assert.equal(canonicalRegion(v), null, JSON.stringify(v));
  }
});

check('product line normalisation', () => {
  assert.equal(normaliseProductLine('  Veam   PT '), 'veam pt');
  assert.equal(normaliseProductLine(null), '');
});

console.log('\nlive approval check');

const COST = 100;
const MIN = 0.3;
const FLOOR_PRICE = COST / (1 - MIN);

check('a price above the minimum margin is within authority', () => {
  const a = assessEscalation({ unitPrice: 180, discountPercent: 0, cost: COST, minimumMargin: MIN });
  assert.equal(a.status, 'within-authority');
});

check('a price below the minimum margin needs approval', () => {
  const a = assessEscalation({ unitPrice: 130, discountPercent: 0, cost: COST, minimumMargin: MIN });
  assert.equal(a.status, 'needs-approval');
  assert.ok(a.reason.includes('below the 30.0%'), a.reason);
});

check('the recommended price, rounded to the cent, is not flagged', () => {
  /* 142.857142... rounds to 142.86, which is a hair under 30.00% before rounding the margin. */
  const rounded = Math.round(FLOOR_PRICE * 100) / 100;
  const a = assessEscalation({ unitPrice: rounded, discountPercent: 0, cost: COST, minimumMargin: MIN });
  assert.equal(a.status, 'within-authority');
  for (const c of [87.31, 133.17, 412.88, 19.99, 1234.56]) {
    for (const m of [0.2, 0.3, 0.452, 0.57, 0.892]) {
      const p = Math.round((c / (1 - m)) * 100) / 100;
      const r = assessEscalation({ unitPrice: p, discountPercent: 0, cost: c, minimumMargin: m });
      assert.equal(r.status, 'within-authority', `cost ${c}, minimum ${m}, price ${p}`);
    }
  }
});

check('a genuinely lower price is still flagged', () => {
  const a = assessEscalation({ unitPrice: 140, discountPercent: 0, cost: COST, minimumMargin: MIN });
  assert.equal(a.status, 'needs-approval');
});

check('a discount lowers the margin the check sees', () => {
  const none = assessEscalation({ unitPrice: 160, discountPercent: 0, cost: COST, minimumMargin: MIN });
  const deep = assessEscalation({ unitPrice: 160, discountPercent: 15, cost: COST, minimumMargin: MIN });
  assert.equal(none.status, 'within-authority');
  assert.equal(deep.status, 'needs-approval');
});

check('a line that cannot be assessed says unknown, never fine and never an alarm', () => {
  const base = { unitPrice: 160, discountPercent: 0, cost: COST, minimumMargin: MIN };
  for (const [name, input] of [
    ['no cost', { ...base, cost: null }],
    ['zero cost', { ...base, cost: 0 }],
    ['no minimum margin', { ...base, minimumMargin: null }],
    ['no price', { ...base, unitPrice: 0 }],
    ['price not a number', { ...base, unitPrice: Number.NaN }],
    ['everything discounted', { ...base, discountPercent: 100 }],
  ] as const) {
    assert.equal(assessEscalation(input).status, 'unknown', name);
  }
});

check('quote summary counts approvals and unknowns', () => {
  const s = summariseEscalation([
    assessEscalation({ unitPrice: 180, discountPercent: 0, cost: COST, minimumMargin: MIN }),
    assessEscalation({ unitPrice: 130, discountPercent: 0, cost: COST, minimumMargin: MIN }),
    assessEscalation({ unitPrice: 0, discountPercent: 0, cost: COST, minimumMargin: MIN }),
  ]);
  assert.deepEqual(s, { needsApproval: 1, unknown: 1, total: 3 });
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
