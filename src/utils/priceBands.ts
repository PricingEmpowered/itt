/**
 * Floor, target and ceiling for a quote line, with the reasoning kept.
 *
 * ## Why this exists
 *
 * The pilot prices a whole uploaded quote at once and shows the user a band
 * per line rather than a single number. Each of the three comes from a
 * different place, and conflating them is how a pilot ends up quoting a
 * figure nobody can account for:
 *
 *   floor    cost / (1 - minimum margin). Specification 7.2. Arithmetic.
 *   target   cost-plus at the configured rate, floored. See costPlus.ts.
 *   ceiling  what comparable won business actually achieved. Evidence.
 *
 * ## The ceiling is allowed to be absent
 *
 * A ceiling is a claim about what the market has paid. With four comparable
 * lines it is not a claim, it is an anecdote. Below the sample threshold this
 * module returns `ceiling: null` and says why, rather than manufacturing one
 * from the target - which would look like evidence while being a restatement
 * of our own cost-plus assumption.
 *
 * That follows the standard the rest of the codebase already sets:
 * winProbabilityCalculator treats absent history as "no opinion" rather than
 * a coin flip, and DealScoreIndicator requires five comparable deals before
 * it scores anything. Five is used here for the same reason.
 *
 * ## Nothing is priced without a cost
 *
 * Every number below is derived from cost. Where cost is missing the band is
 * not estimated from list price or from the comparables - the line comes back
 * unpriced and says so, so that a user sees a gap instead of a guess. This
 * matters because the pilot's own data has lines whose cost basis is still
 * unconfirmed (per unit, or extended over the minimum order quantity), and a
 * confident number built on the wrong one is the failure mode with no tell.
 */

import { calculateCostPlus, marginOf, type MarginBasis } from './costPlus';

/** Minimum comparable lines before a ceiling is offered. Matches DealScoreIndicator. */
export const MIN_COMPARABLES = 5;

/** A historical line used as evidence. Won business only - losses do not set a ceiling. */
export interface ComparableLine {
  unitPrice: number;
  quantity?: number;
}

export interface PriceBandInput {
  /** Per-unit cost. Null or non-finite means the line cannot be priced. */
  cost: number | null | undefined;
  standardRate: number;
  adders?: number[];
  basis: MarginBasis;
  minimumMargin?: number;
  /** Comparable won lines. Fewer than MIN_COMPARABLES yields no ceiling. */
  comparables?: ComparableLine[];
  /** Typed list price for configured parts. Reporting only - never moves the band. */
  enteredListPrice?: number | null;
}

/** One step of the explanation, rendered identically by screen and export. */
export interface RationaleStep {
  label: string;
  value: number | null;
  /** Where the number came from, in a few words. */
  basis: string;
  /** The working, for someone who wants to check it. */
  detail: string;
}

export interface PriceBand {
  floor: number | null;
  target: number | null;
  ceiling: number | null;
  /** False when there is no cost. Floor and target are null and nothing is guessed. */
  priceable: boolean;
  /** Margin the target earns, on the stated basis. Null when unpriceable. */
  targetMargin: number | null;
  /** Target as a discount off the typed list price, when one was given. */
  discountOffList: number | null;
  rationale: RationaleStep[];
  warnings: string[];
}

/**
 * Upper quartile by linear interpolation. Used rather than the maximum
 * because one outlier should not become the ceiling for every later quote.
 */
export function upperQuartile(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = 0.75 * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function calculatePriceBand(input: PriceBandInput): PriceBand {
  const {
    cost,
    standardRate,
    adders = [],
    basis,
    minimumMargin = 0.2,
    comparables = [],
    enteredListPrice = null,
  } = input;

  const warnings: string[] = [];
  const rationale: RationaleStep[] = [];

  /*
   * No cost, no band. Returning early rather than defaulting cost to zero,
   * which would floor and target at zero and look like a priced line.
   */
  if (cost == null || !Number.isFinite(cost)) {
    warnings.push(
      'No cost on this line, so it cannot be priced. A cost is required before a floor or target can be offered.'
    );
    return {
      floor: null,
      target: null,
      ceiling: null,
      priceable: false,
      targetMargin: null,
      discountOffList: null,
      rationale: [
        {
          label: 'Not priced',
          value: null,
          basis: 'Cost missing',
          detail: 'Every figure in the band derives from cost. Nothing is estimated in its absence.',
        },
      ],
      warnings,
    };
  }

  if (cost === 0) {
    warnings.push('Cost on this line is zero, which makes the floor and target zero. Check the source data.');
  }
  if (cost < 0) {
    warnings.push('Cost on this line is negative. The band below is not meaningful.');
  }

  const cp = calculateCostPlus({ cost, standardRate, adders, basis, minimumMargin });
  warnings.push(...cp.warnings);

  const floor = cp.floorPrice;
  const target = cp.price;

  if (floor !== null) {
    rationale.push({
      label: 'Floor',
      value: floor,
      basis: `Cost floor at ${(minimumMargin * 100).toFixed(0)}% minimum margin`,
      detail: `${cost.toFixed(2)} ÷ (1 − ${minimumMargin.toFixed(2)}) = ${floor.toFixed(2)}. No price is offered below this.`,
    });
  }

  const totalRatePct = (cp.totalRate * 100).toFixed(1);
  const adderNote = adders.length
    ? ` (${(standardRate * 100).toFixed(1)}% standard plus ${adders.length} adder${adders.length === 1 ? '' : 's'})`
    : '';
  rationale.push({
    label: 'Target',
    value: target,
    basis:
      basis === 'margin'
        ? `Cost-plus at ${totalRatePct}% margin on price${adderNote}`
        : `Cost-plus at ${totalRatePct}% markup on cost${adderNote}`,
    detail:
      `${cp.formula} = ${target.toFixed(2)}` +
      (cp.floorApplied ? '. The computed price fell below the floor, so the floor applies.' : '') +
      ` Earns ${cp.marginEarned.toFixed(1)}% margin.`,
  });

  /*
   * Ceiling from evidence or not at all. The sample test comes before the
   * arithmetic so that a thin sample is reported as a thin sample rather than
   * as a quartile of three numbers.
   */
  let ceiling: number | null = null;
  const usable = comparables.filter((c) => Number.isFinite(c.unitPrice) && c.unitPrice > 0);

  if (usable.length < MIN_COMPARABLES) {
    rationale.push({
      label: 'Ceiling',
      value: null,
      basis: 'Not offered - insufficient comparable history',
      detail:
        `${usable.length} comparable line${usable.length === 1 ? '' : 's'} found; ${MIN_COMPARABLES} are required. ` +
        'A ceiling states what comparable business has achieved, and a smaller sample does not support that claim.',
    });
    warnings.push(
      `No ceiling: ${usable.length} comparable line${usable.length === 1 ? '' : 's'} is below the threshold of ${MIN_COMPARABLES}.`
    );
  } else {
    const q3 = upperQuartile(usable.map((c) => c.unitPrice));
    if (q3 !== null && q3 >= target) {
      ceiling = q3;
      rationale.push({
        label: 'Ceiling',
        value: ceiling,
        basis: `Upper quartile of ${usable.length} comparable won lines`,
        detail:
          `Three in four comparable lines were won at or below ${ceiling.toFixed(2)}. ` +
          'The upper quartile is used rather than the highest price so that one outlier does not set the ceiling.',
      });
    } else if (q3 !== null) {
      /*
       * Comparable history below our own target is a finding, not a null to
       * swallow. Either the target is above what this market has paid, or the
       * comparables are not comparable. Both are worth a user seeing.
       */
      rationale.push({
        label: 'Ceiling',
        value: null,
        basis: 'Not offered - comparable history sits below the target',
        detail:
          `The upper quartile of ${usable.length} comparable lines is ${q3.toFixed(2)}, below the target of ${target.toFixed(2)}. ` +
          'Either the target is above what comparable business has achieved, or these lines are not comparable.',
      });
      warnings.push(
        `Comparable history (upper quartile ${q3.toFixed(2)}) sits below the cost-plus target (${target.toFixed(2)}). Worth checking before quoting.`
      );
    }
  }

  /*
   * The typed list price reports and does not price. Kept as its own step so
   * that it is visibly a reporting figure rather than an input to the band.
   */
  let discountOffList: number | null = null;
  if (enteredListPrice != null && Number.isFinite(enteredListPrice) && enteredListPrice > 0) {
    discountOffList = ((enteredListPrice - target) / enteredListPrice) * 100;
    rationale.push({
      label: 'Discount off list',
      value: discountOffList,
      basis: 'Reporting only - the entered list price does not affect the band',
      detail:
        `Target ${target.toFixed(2)} against an entered list price of ${enteredListPrice.toFixed(2)} ` +
        `is ${discountOffList.toFixed(1)}% off list.`,
    });
    if (discountOffList < 0) {
      warnings.push('The target is above the entered list price, so the discount off list is negative.');
    }
  }

  return {
    floor,
    target,
    ceiling,
    priceable: true,
    targetMargin: marginOf(target, cost),
    discountOffList,
    rationale,
    warnings,
  };
}
