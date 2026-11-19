/**
 * Checks on the price band calculator.
 *
 * This repository has no test runner. The band calculator decides what a
 * pilot quotes to customers, so it does not go in unverified; this script
 * runs the cases that matter and exits non-zero on any failure.
 *
 *   npx tsx scripts/check-price-bands.ts
 *
 * If a test runner is adopted later these become its first suite unchanged.
 */

import assert from 'node:assert/strict';
import { calculatePriceBand, upperQuartile, MIN_COMPARABLES } from '../src/utils/priceBands';

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

/** Floats: compare to the cent, which is the precision a quote is given in. */
function near(actual: number | null, expected: number, label: string) {
  assert.ok(actual !== null, `${label}: expected ${expected}, got null`);
  assert.ok(
    Math.abs((actual as number) - expected) < 0.005,
    `${label}: expected ${expected}, got ${actual}`
  );
}

const BASE = { standardRate: 0.4, basis: 'margin' as const, minimumMargin: 0.2 };

console.log('\nupperQuartile');

check('interpolates between ranks', () => {
  near(upperQuartile([1, 2, 3, 4]), 3.25, 'q3');
});
check('single value is its own quartile', () => {
  near(upperQuartile([10]), 10, 'q3');
});
check('empty is null, not zero', () => {
  assert.equal(upperQuartile([]), null);
});
check('unsorted input is handled', () => {
  near(upperQuartile([220, 180, 200, 190, 210]), 210, 'q3');
});

console.log('\nband arithmetic');

check('margin basis divides: 40% on $100 cost targets $166.67', () => {
  const b = calculatePriceBand({ ...BASE, cost: 100 });
  near(b.target, 166.667, 'target');
  near(b.floor, 125, 'floor');
  near(b.targetMargin, 40, 'targetMargin');
  assert.equal(b.priceable, true);
});

check('markup basis multiplies and earns less than it says', () => {
  const b = calculatePriceBand({ ...BASE, basis: 'markup', cost: 100 });
  near(b.target, 140, 'target');
  near(b.targetMargin, 28.571, 'targetMargin');
  assert.ok(
    b.warnings.some((w) => w.includes('markup basis')),
    'expected a warning that markup earns less than the stated rate'
  );
});

check('floor wins when the rate would price below it', () => {
  const b = calculatePriceBand({ ...BASE, standardRate: 0.1, cost: 100 });
  near(b.target, 125, 'target floored');
  near(b.floor, 125, 'floor');
  near(b.targetMargin, 20, 'targetMargin at the floor');
});

check('adders raise the target', () => {
  const b = calculatePriceBand({ ...BASE, cost: 100, adders: [0.05, 0.05] });
  near(b.target, 200, 'target at 50%');
});

check('floor never exceeds target', () => {
  for (const rate of [0.05, 0.2, 0.4, 0.75]) {
    const b = calculatePriceBand({ ...BASE, standardRate: rate, cost: 250 });
    assert.ok((b.floor as number) <= (b.target as number), `floor > target at rate ${rate}`);
  }
});

console.log('\nmissing cost');

check('no cost means no band and nothing invented', () => {
  const b = calculatePriceBand({ ...BASE, cost: null });
  assert.equal(b.priceable, false);
  assert.equal(b.floor, null);
  assert.equal(b.target, null);
  assert.equal(b.ceiling, null);
  assert.ok(b.warnings.some((w) => w.includes('cannot be priced')));
});

check('a list price does not rescue a missing cost', () => {
  const b = calculatePriceBand({ ...BASE, cost: null, enteredListPrice: 500 });
  assert.equal(b.target, null, 'target must not be derived from list price');
  assert.equal(b.discountOffList, null);
});

console.log('\nceiling');

check('enough comparables above target yields the upper quartile', () => {
  const b = calculatePriceBand({
    ...BASE,
    cost: 100,
    comparables: [180, 190, 200, 210, 220].map((unitPrice) => ({ unitPrice })),
  });
  near(b.ceiling, 210, 'ceiling');
  assert.ok((b.ceiling as number) >= (b.target as number), 'ceiling below target');
});

check(`fewer than ${MIN_COMPARABLES} comparables yields no ceiling`, () => {
  const b = calculatePriceBand({
    ...BASE,
    cost: 100,
    comparables: [180, 190, 200, 210].map((unitPrice) => ({ unitPrice })),
  });
  assert.equal(b.ceiling, null);
  const step = b.rationale.find((r) => r.label === 'Ceiling');
  assert.ok(step && step.basis.includes('insufficient'), 'rationale should say why there is no ceiling');
});

check('comparables below target are reported, not swallowed', () => {
  const b = calculatePriceBand({
    ...BASE,
    cost: 100,
    comparables: [120, 130, 140, 150, 160].map((unitPrice) => ({ unitPrice })),
  });
  assert.equal(b.ceiling, null, 'must not offer a ceiling below the target');
  assert.ok(
    b.warnings.some((w) => w.includes('sits below the cost-plus target')),
    'expected a warning that history sits below target'
  );
});

check('zero-price comparables are discarded before counting', () => {
  const b = calculatePriceBand({
    ...BASE,
    cost: 100,
    comparables: [0, 0, 0, 200, 210].map((unitPrice) => ({ unitPrice })),
  });
  assert.equal(b.ceiling, null, 'two usable lines is not a sample');
});

console.log('\nentered list price is reporting only');

check('discount off list is computed', () => {
  const b = calculatePriceBand({ ...BASE, cost: 100, enteredListPrice: 250 });
  near(b.discountOffList, 33.333, 'discountOffList');
});

check('the entered list price does not move the band', () => {
  const without = calculatePriceBand({ ...BASE, cost: 100 });
  for (const list of [50, 250, 10_000]) {
    const withList = calculatePriceBand({ ...BASE, cost: 100, enteredListPrice: list });
    assert.equal(withList.target, without.target, `target moved with list price ${list}`);
    assert.equal(withList.floor, without.floor, `floor moved with list price ${list}`);
  }
});

check('a target above list reports a negative discount and warns', () => {
  const b = calculatePriceBand({ ...BASE, cost: 100, enteredListPrice: 150 });
  assert.ok((b.discountOffList as number) < 0);
  assert.ok(b.warnings.some((w) => w.includes('above the entered list price')));
});

console.log('\nrationale');

check('every priced line explains floor and target', () => {
  const b = calculatePriceBand({ ...BASE, cost: 100 });
  const labels = b.rationale.map((r) => r.label);
  assert.ok(labels.includes('Floor'), 'no Floor step');
  assert.ok(labels.includes('Target'), 'no Target step');
  for (const step of b.rationale) {
    assert.ok(step.basis.length > 0, `step ${step.label} has no basis`);
    assert.ok(step.detail.length > 0, `step ${step.label} has no detail`);
  }
});

check('an unpriceable line still explains itself', () => {
  const b = calculatePriceBand({ ...BASE, cost: undefined });
  assert.equal(b.rationale.length, 1);
  assert.equal(b.rationale[0].label, 'Not priced');
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
