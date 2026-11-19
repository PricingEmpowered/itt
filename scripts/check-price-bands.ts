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
import {
  calculatePriceBand,
  percentile,
  mean,
  standardDeviation,
  MIN_COMPARABLES,
  TARGET_PERCENTILE,
  CEILING_STDEV_MULTIPLE,
  type ComparableLine,
} from '../server/pricing/priceBands.js';

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

const cmp = (marginFraction: number, flags: Partial<ComparableLine> = {}): ComparableLine => ({
  marginFraction,
  ...flags,
});

/** Five lines, margins 30% to 38%. p65 = 35.2%, mean 34%, sample sd 3.162 points. */
const EVEN_COHORT = [0.3, 0.32, 0.34, 0.36, 0.38].map((m) => cmp(m));

const BASE = {
  cost: 100,
  fallbackRate: 0.4,
  fallbackBasis: 'margin' as const,
  minimumMargin: 0.2,
};

console.log('\nstatistics');

check('percentile interpolates between ranks', () => {
  near(percentile([1, 2, 3, 4], 0.75), 3.25, 'p75');
});
check('percentile at 0.65 of five values', () => {
  near(percentile([0.3, 0.32, 0.34, 0.36, 0.38], 0.65), 0.352, 'p65');
});
check('percentile of empty is null, not zero', () => {
  assert.equal(percentile([], 0.5), null);
});
check('percentile handles unsorted input', () => {
  near(percentile([0.38, 0.3, 0.34, 0.32, 0.36], 0.65), 0.352, 'p65');
});
check('mean of empty is null', () => {
  assert.equal(mean([]), null);
});
check('sample standard deviation uses n-1', () => {
  near(standardDeviation([0.3, 0.32, 0.34, 0.36, 0.38]), 0.0316228, 'sd');
});
check('standard deviation of one value is null, not zero', () => {
  assert.equal(standardDeviation([0.3]), null);
});
check('identical values have zero spread', () => {
  near(standardDeviation([0.25, 0.25, 0.25]), 0, 'sd');
});

console.log('\ntarget comes from comparable evidence');

check(`target is the ${TARGET_PERCENTILE * 100}th percentile margin, applied to this cost`, () => {
  const b = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
  assert.equal(b.targetBasis, 'comparable');
  near(b.target, 154.321, 'target');
  near(b.targetMargin, 35.2, 'targetMargin');
});

check(`ceiling is mean plus ${CEILING_STDEV_MULTIPLE} standard deviations`, () => {
  const b = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
  near(b.ceiling, 163.248, 'ceiling');
  assert.ok((b.ceiling as number) > (b.target as number), 'ceiling must exceed target');
});

check('the floor stays policy and ignores the cohort', () => {
  const b = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
  near(b.floor, 125, 'floor');
});

check('band is ordered floor <= target <= ceiling', () => {
  const b = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
  assert.ok((b.floor as number) <= (b.target as number), 'floor above target');
  assert.ok((b.target as number) <= (b.ceiling as number), 'target above ceiling');
});

check('cohort supplies the rate, the line supplies the level', () => {
  const cheap = calculatePriceBand({ ...BASE, cost: 100, comparables: EVEN_COHORT });
  const dear = calculatePriceBand({ ...BASE, cost: 1000, comparables: EVEN_COHORT });
  near(dear.target, (cheap.target as number) * 10, 'target scales with cost');
  near(dear.targetMargin, cheap.targetMargin as number, 'margin is identical');
});

check('a tighter cohort gives a tighter ceiling', () => {
  const tight = calculatePriceBand({ ...BASE, comparables: [0.33, 0.34, 0.34, 0.34, 0.35].map((m) => cmp(m)) });
  const loose = calculatePriceBand({ ...BASE, comparables: [0.1, 0.22, 0.34, 0.46, 0.58].map((m) => cmp(m)) });
  const tightGap = (tight.ceiling as number) - (tight.target as number);
  const looseGap = (loose.ceiling as number) - (loose.target as number);
  assert.ok(looseGap > tightGap, `expected a wider ceiling from a scattered cohort (${looseGap} vs ${tightGap})`);
});

console.log('\ncohort selection mirrors dealScore');

check('industry cohort is preferred when it has three lines', () => {
  const b = calculatePriceBand({
    ...BASE,
    comparables: [
      cmp(0.5, { inIndustry: true }),
      cmp(0.52, { inIndustry: true }),
      cmp(0.54, { inIndustry: true }),
      cmp(0.2, { inRegion: true }),
      cmp(0.22, { inRegion: true }),
    ],
  });
  assert.equal(b.cohortUsed, 'industry');
  near(b.target, 210.97, 'target from the industry cohort only');
});

check('region is used when industry is too thin', () => {
  const b = calculatePriceBand({
    ...BASE,
    comparables: [
      cmp(0.5, { inIndustry: true }),
      cmp(0.52, { inIndustry: true }),
      cmp(0.3, { inRegion: true }),
      cmp(0.32, { inRegion: true }),
      cmp(0.34, { inRegion: true }),
    ],
  });
  assert.equal(b.cohortUsed, 'region');
});

check('all comparables are used when neither cohort qualifies', () => {
  const b = calculatePriceBand({
    ...BASE,
    comparables: [cmp(0.3), cmp(0.32), cmp(0.34), cmp(0.36), cmp(0.38)],
  });
  assert.equal(b.cohortUsed, 'all');
});

console.log('\nthin evidence falls back to cost-plus, and says so');

check(`fewer than ${MIN_COMPARABLES} comparables uses the fallback`, () => {
  const b = calculatePriceBand({ ...BASE, comparables: [0.3, 0.32, 0.34, 0.36].map((m) => cmp(m)) });
  assert.equal(b.targetBasis, 'cost-plus-fallback');
  near(b.target, 166.667, 'cost-plus at 40% margin');
  assert.ok(b.warnings.some((w) => w.includes('Priced from cost, not from evidence')));
});

check('the fallback offers no ceiling', () => {
  const b = calculatePriceBand({ ...BASE, comparables: [cmp(0.3)] });
  assert.equal(b.ceiling, null);
  const step = b.rationale.find((r) => r.label === 'Ceiling');
  assert.ok(step && step.basis.includes('no comparable history'));
});

check('the user can tell evidence from assumption', () => {
  const evidence = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
  const assumption = calculatePriceBand({ ...BASE, comparables: [] });
  const t1 = evidence.rationale.find((r) => r.label === 'Target');
  const t2 = assumption.rationale.find((r) => r.label === 'Target');
  assert.ok(t1 && t1.basis.includes('percentile margin'));
  assert.ok(t2 && t2.basis.includes('fallback'));
});

console.log('\nthe floor is the approval line, not an override');

check('evidence below the approval line is reported and the target is left alone', () => {
  const b = calculatePriceBand({ ...BASE, comparables: [0.1, 0.1, 0.1, 0.1, 0.1].map((m) => cmp(m)) });
  near(b.target, 111.111, 'target stays what the evidence says');
  near(b.floor, 125, 'floor');
  assert.equal(b.targetNeedsApproval, true);
  assert.ok(b.warnings.some((w) => w.includes('needs approval')));
  assert.ok(b.rationale.some((r) => r.label === 'Below the approval line'));
});

check('a target at or above the floor does not need approval', () => {
  const b = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
  assert.equal(b.targetNeedsApproval, false);
  assert.ok(!b.rationale.some((r) => r.label === 'Below the approval line'));
});

check('the floor carries the margin it was built from', () => {
  const b = calculatePriceBand({ ...BASE, minimumMargin: 0.3, comparables: EVEN_COHORT });
  assert.equal(b.floorMargin, 0.3);
  near(b.floor, 142.857, 'floor at 30%');
});

check('the cost-plus fallback does not clamp to the floor either', () => {
  const b = calculatePriceBand({
    ...BASE,
    fallbackRate: 0.1,
    minimumMargin: 0.3,
    comparables: [],
  });
  assert.equal(b.targetBasis, 'cost-plus-fallback');
  near(b.target, 111.111, 'a 10% cost-plus target is not raised to the 30% floor');
  assert.equal(b.targetNeedsApproval, true);
});

check('no minimum margin means no floor, and none is invented', () => {
  const b = calculatePriceBand({ ...BASE, minimumMargin: null, comparables: EVEN_COHORT });
  assert.equal(b.floor, null);
  assert.equal(b.floorMargin, null);
  assert.equal(b.targetNeedsApproval, null);
  const step = b.rationale.find((r) => r.label === 'Floor');
  assert.ok(step && step.basis.includes('No minimum margin'));
});

console.log('\nmissing cost');

check('no cost means no band and nothing invented', () => {
  const b = calculatePriceBand({ ...BASE, cost: null, comparables: EVEN_COHORT });
  assert.equal(b.priceable, false);
  assert.equal(b.targetBasis, 'none');
  assert.equal(b.floor, null);
  assert.equal(b.target, null);
  assert.equal(b.ceiling, null);
});

check('a list price does not rescue a missing cost', () => {
  const b = calculatePriceBand({ ...BASE, cost: null, enteredListPrice: 500 });
  assert.equal(b.target, null, 'target must not be derived from list price');
  assert.equal(b.discountOffList, null);
});

check('comparables do not rescue a missing cost', () => {
  const b = calculatePriceBand({ ...BASE, cost: undefined, comparables: EVEN_COHORT });
  assert.equal(b.target, null, 'a cohort margin is not a price without a cost');
});

console.log('\nentered list price is reporting only');

check('discount off list is computed', () => {
  const b = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT, enteredListPrice: 200 });
  near(b.discountOffList, 22.84, 'discountOffList');
});

check('the entered list price does not move the band', () => {
  const without = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
  for (const list of [50, 250, 10_000]) {
    const withList = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT, enteredListPrice: list });
    assert.equal(withList.target, without.target, `target moved with list price ${list}`);
    assert.equal(withList.ceiling, without.ceiling, `ceiling moved with list price ${list}`);
  }
});

console.log('\npost-launch guidance');

check('absent returns are stated, not assumed', () => {
  const b = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
  const step = b.rationale.find((r) => r.label === 'Post-launch guidance');
  assert.ok(step && step.basis.includes('Not yet applied'));
});

check('signals received do not silently move the number', () => {
  const plain = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
  const guided = calculatePriceBand({
    ...BASE,
    comparables: EVEN_COHORT,
    adjustments: { winRateAtTarget: 0.72, escalationApprovedUnchangedRate: 0.9 },
  });
  assert.equal(guided.target, plain.target, 'target moved on uncalibrated signals');
  assert.ok(
    guided.warnings.some((w) => w.includes('approved without change')),
    'a 90% approve-unchanged rate should be surfaced'
  );
});

console.log('\nrationale');

check('every priced line explains floor and target', () => {
  const b = calculatePriceBand({ ...BASE, comparables: EVEN_COHORT });
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
