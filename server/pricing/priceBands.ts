/**
 * Floor, target and ceiling for a quote line, with the reasoning kept.
 *
 * ## Where each of the three comes from
 *
 *   floor    cost / (1 - minimum margin). Specification 7.2. Policy arithmetic:
 *            the walk-away, independent of what the market has done.
 *   target   the 65th percentile margin of comparable like transactions.
 *            Evidence, set above the midpoint so the desk opens with ambition.
 *   ceiling  mean plus 1.5 standard deviations of that same evidence. The
 *            stretch: defensible because like business has reached it.
 *
 * Target is deliberately NOT cost-plus. Cost-plus states what we would like to
 * earn; it knows nothing about what this kind of business sells for, so a
 * desk pricing from it is guessing in a well-formatted way. Comparable
 * transactions are the only evidence available at launch, so they set the
 * target and cost-plus becomes the fallback for lines with no cohort - clearly
 * labelled as such, because a user should be able to tell a priced line from
 * an assumed one at a glance.
 *
 * ## Comparables set the rate, this line's cost sets the level
 *
 * Absolute prices from other transactions are not transferable: a $40 part and
 * a $4,000 part are not comparable on price however similar the deal. What
 * does transfer is the margin those deals achieved. So the cohort supplies a
 * margin and this line's own cost turns it into a price:
 *
 *     target = cost / (1 - 65th percentile margin of the cohort)
 *
 * That is the same normalisation server/dealScore.ts already uses when it
 * benchmarks quotes on margin and discount percentages rather than on price.
 *
 * ## The cohort definition is not a new one
 *
 * Cohort selection, the twelve-month window, the category match and the
 * minimum sample sizes all mirror server/dealScore.ts, which is where
 * comparability is already defined for this application. Industry cohort is
 * preferred, region second, all comparables last - the same precedence, and
 * the same thresholds (5 lines overall, 3 within a cohort). Two definitions of
 * "comparable" in one product would be a defect in waiting.
 *
 * ## What happens after the first monthly return
 *
 * The target above is the launch position: evidence from past transactions and
 * nothing else. It is meant to be guided afterwards by price response, monthly
 * win rate and escalation outcomes, which arrive in the monthly files from
 * Channel Partners. `TargetAdjustments` is where those enter. None of them
 * exist yet, and an adjustment with an uncalibrated constant in it is worse
 * than no adjustment, so each one is optional, each does nothing when absent,
 * and each states itself in the rationale when applied. See `applyAdjustments`
 * for what is and is not yet decidable.
 *
 * ## Nothing is priced without a cost
 *
 * Every figure derives from cost. Where cost is missing the line comes back
 * unpriced rather than estimated from list price or from the cohort, so a user
 * sees a gap instead of a guess. This matters while the cost basis is
 * unconfirmed - per unit, or extended over the minimum order quantity - since
 * a confident number built on the wrong one has no visible tell.
 */

import { calculateCostPlus, marginOf, type MarginBasis } from './costPlus.js';

/** Minimum comparable lines before the cohort is usable. Mirrors server/dealScore.ts. */
export const MIN_COMPARABLES = 5;
/** Minimum within industry or region before that cohort is preferred. Mirrors dealScore. */
export const MIN_IN_COHORT = 3;

/**
 * Where in the cohort's margin distribution the target sits. ITT's choice.
 *
 * Above the midpoint on purpose: a target at the median asks the desk to do
 * exactly as well as it has always done, which is a forecast rather than a
 * target. The 65th percentile is reachable - a third of comparable business
 * already cleared it - while still asking for more than the habit.
 */
export const TARGET_PERCENTILE = 0.65;

/**
 * How far above the cohort's mean margin the ceiling sits, in standard
 * deviations. ITT's choice.
 *
 * A multiple of the spread rather than a fixed percentile because it adapts
 * to how consistent the cohort is: tightly clustered margins give a ceiling
 * close to the target, a scattered cohort gives more room. On a roughly
 * normal spread 1.5 standard deviations is near the 93rd percentile, so the
 * ceiling is what the best comparable business achieved, not the average of
 * the good ones.
 */
export const CEILING_STDEV_MULTIPLE = 1.5;

/**
 * A historical line used as evidence. Margin rather than price, because margin
 * is what transfers between products of different sizes.
 */
export interface ComparableLine {
  /** Achieved margin as a fraction. 0.32 means the line earned 32%. */
  marginFraction: number;
  inIndustry?: boolean;
  inRegion?: boolean;
}

/**
 * Signals that guide the target once the monthly returns start arriving.
 * All optional. Absent means no adjustment, never an assumed one.
 */
export interface TargetAdjustments {
  /** Observed win rate at or near the target band, from the monthly win/loss file. */
  winRateAtTarget?: number | null;
  /** Share of escalated quotes approved with no change, from the monthly escalation file. */
  escalationApprovedUnchangedRate?: number | null;
  /** Change in win rate per percentage point of margin. Requires won and lost quotes. */
  priceResponsePerMarginPoint?: number | null;
}

export type TargetBasis = 'comparable' | 'cost-plus-fallback' | 'none';
export type CohortUsed = 'industry' | 'region' | 'all' | 'none';

export interface PriceBandInput {
  /** Per-unit cost. Null or non-finite means the line cannot be priced. */
  cost: number | null | undefined;
  /** Comparable lines for this product category. Sets the target when sufficient. */
  comparables?: ComparableLine[];
  /** Used only when the cohort is too thin. Rate per `basis`. */
  fallbackRate: number;
  fallbackBasis: MarginBasis;
  fallbackAdders?: number[];
  /** Cost floor as a margin. 0.20 means never below cost / 0.80. */
  minimumMargin?: number;
  /** Typed list price for configured parts. Reporting only - never moves the band. */
  enteredListPrice?: number | null;
  /** Post-launch guidance. Absent at launch. */
  adjustments?: TargetAdjustments;
  /** Overrides TARGET_PERCENTILE. Per rule set once it is configurable. */
  targetPercentile?: number;
  /** Overrides CEILING_STDEV_MULTIPLE. Per rule set once it is configurable. */
  ceilingStdevMultiple?: number;
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
  priceable: boolean;
  /** Whether the target is evidence or an assumption. Shown to the user. */
  targetBasis: TargetBasis;
  cohortUsed: CohortUsed;
  comparableCount: number;
  targetMargin: number | null;
  discountOffList: number | null;
  rationale: RationaleStep[];
  warnings: string[];
}

/** Percentile by linear interpolation. */
export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function mean(values: number[]): number | null {
  const v = values.filter(Number.isFinite);
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/**
 * Sample standard deviation, with Bessel's correction.
 *
 * The n-1 divisor rather than n because the cohort is a sample of comparable
 * business, not the whole of it, and at the sample sizes here - five lines is
 * the minimum - the difference is large enough to matter to a ceiling.
 * Returns null below two values, where spread is undefined rather than zero.
 */
export function standardDeviation(values: number[]): number | null {
  const v = values.filter(Number.isFinite);
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sumSq = v.reduce((acc, x) => acc + (x - m) ** 2, 0);
  return Math.sqrt(sumSq / (v.length - 1));
}

/** Price that earns a given margin on a given cost. */
function priceAtMargin(cost: number, marginFraction: number): number {
  /* A margin at or above 1 has no finite price. Cap rather than return Infinity. */
  const m = Math.min(marginFraction, 0.99);
  return cost / (1 - m);
}

/**
 * Chooses the cohort the same way server/dealScore.ts does: industry first,
 * region second, everything last.
 */
function selectCohort(comparables: ComparableLine[]): {
  cohort: ComparableLine[];
  used: CohortUsed;
} {
  const industry = comparables.filter((c) => c.inIndustry);
  if (industry.length >= MIN_IN_COHORT) return { cohort: industry, used: 'industry' };
  const region = comparables.filter((c) => c.inRegion);
  if (region.length >= MIN_IN_COHORT) return { cohort: region, used: 'region' };
  return { cohort: comparables, used: 'all' };
}

/**
 * Where price response, win rate and escalation outcomes will act on the
 * target once the monthly files exist.
 *
 * Deliberately inert today. The defensible long-run objective is to pick the
 * margin that maximises expected contribution - (price - cost) x P(win at that
 * price) - which needs a win curve fitted to won AND lost quotes at known
 * margin positions. Every ITT dataset supplied so far records won business
 * only, so that curve cannot be fitted and any coefficient written here would
 * be invented. Escalation outcomes are the clearest early signal: a band that
 * escalates and is then approved unchanged most of the time is set too low.
 *
 * Returns the margin unchanged, plus any rationale steps explaining why.
 */
function applyAdjustments(
  marginFraction: number,
  adjustments: TargetAdjustments | undefined
): { margin: number; steps: RationaleStep[]; warnings: string[] } {
  const steps: RationaleStep[] = [];
  const warnings: string[] = [];

  const haveAny =
    adjustments != null &&
    (adjustments.winRateAtTarget != null ||
      adjustments.escalationApprovedUnchangedRate != null ||
      adjustments.priceResponsePerMarginPoint != null);

  if (!haveAny) {
    steps.push({
      label: 'Post-launch guidance',
      value: null,
      basis: 'Not yet applied - no monthly returns received',
      detail:
        'The target is guided after launch by price response, monthly win rate and escalation outcomes. ' +
        'Those arrive in the monthly files from Channel Partners. Until the first return lands the target ' +
        'rests on comparable transactions alone, and nothing here is estimated in their absence.',
    });
    return { margin: marginFraction, steps, warnings };
  }

  /*
   * Signals are recorded and shown, not yet acted on. Turning a win rate into
   * a margin shift needs a calibrated response curve; reporting the signal is
   * honest, inventing the coefficient is not.
   */
  const parts: string[] = [];
  if (adjustments?.winRateAtTarget != null) {
    parts.push(`win rate at target ${(adjustments.winRateAtTarget * 100).toFixed(0)}%`);
  }
  if (adjustments?.escalationApprovedUnchangedRate != null) {
    const r = adjustments.escalationApprovedUnchangedRate;
    parts.push(`${(r * 100).toFixed(0)}% of escalations approved unchanged`);
    if (r >= 0.8) {
      warnings.push(
        `${(r * 100).toFixed(0)}% of escalated quotes were approved without change, which suggests the target is set below what this business will bear.`
      );
    }
  }
  if (adjustments?.priceResponsePerMarginPoint != null) {
    parts.push(
      `price response ${adjustments.priceResponsePerMarginPoint.toFixed(3)} win-rate points per margin point`
    );
  }

  steps.push({
    label: 'Post-launch guidance',
    value: null,
    basis: 'Signals received, not yet applied to the number',
    detail:
      `${parts.join('; ')}. These are reported rather than applied: converting them into a margin shift ` +
      'requires a win curve fitted to won and lost quotes, and the loss data has only just begun arriving. ' +
      'The target below is still the comparable-derived figure.',
  });

  return { margin: marginFraction, steps, warnings };
}

export function calculatePriceBand(input: PriceBandInput): PriceBand {
  const {
    cost,
    comparables = [],
    fallbackRate,
    fallbackBasis,
    fallbackAdders = [],
    minimumMargin = 0.2,
    enteredListPrice = null,
    adjustments,
    targetPercentile = TARGET_PERCENTILE,
    ceilingStdevMultiple = CEILING_STDEV_MULTIPLE,
  } = input;

  const warnings: string[] = [];
  const rationale: RationaleStep[] = [];

  /* No cost, no band. Returning early rather than defaulting cost to zero. */
  if (cost == null || !Number.isFinite(cost)) {
    return {
      floor: null,
      target: null,
      ceiling: null,
      priceable: false,
      targetBasis: 'none',
      cohortUsed: 'none',
      comparableCount: 0,
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
      warnings: [
        'No cost on this line, so it cannot be priced. A cost is required before a floor or target can be offered.',
      ],
    };
  }

  if (cost === 0) {
    warnings.push('Cost on this line is zero, which makes the whole band zero. Check the source data.');
  }
  if (cost < 0) {
    warnings.push('Cost on this line is negative. The band below is not meaningful.');
  }

  /* The floor is policy and does not depend on the cohort. */
  const floor =
    minimumMargin > 0 && minimumMargin < 1 ? priceAtMargin(cost, minimumMargin) : null;
  if (floor !== null) {
    rationale.push({
      label: 'Floor',
      value: floor,
      basis: `Cost floor at ${(minimumMargin * 100).toFixed(0)}% minimum margin`,
      detail: `${cost.toFixed(2)} ÷ (1 − ${minimumMargin.toFixed(2)}) = ${floor.toFixed(2)}. No price is offered below this.`,
    });
  }

  const usable = comparables.filter(
    (c) => Number.isFinite(c.marginFraction) && c.marginFraction < 1
  );

  let target: number;
  let ceiling: number | null = null;
  let targetBasis: TargetBasis;
  let cohortUsed: CohortUsed = 'none';

  if (usable.length >= MIN_COMPARABLES) {
    const { cohort, used } = selectCohort(usable);
    cohortUsed = used;
    const margins = cohort.map((c) => c.marginFraction);
    const targetMarginRaw = percentile(margins, targetPercentile) as number;

    const adjusted = applyAdjustments(targetMarginRaw, adjustments);
    warnings.push(...adjusted.warnings);

    target = priceAtMargin(cost, adjusted.margin);
    targetBasis = 'comparable';

    const cohortLabel =
      used === 'industry'
        ? `${cohort.length} comparable lines in the same industry`
        : used === 'region'
          ? `${cohort.length} comparable lines in the same region`
          : `${cohort.length} comparable lines`;

    rationale.push({
      label: 'Target',
      value: target,
      basis: `${(targetPercentile * 100).toFixed(0)}th percentile margin of ${cohortLabel}`,
      detail:
        `Comparable business reached ${(adjusted.margin * 100).toFixed(1)}% margin at the ${(targetPercentile * 100).toFixed(0)}th percentile, ` +
        `so roughly ${(100 - targetPercentile * 100).toFixed(0)} in 100 comparable lines did at least this well. ` +
        `Applied to this line's cost: ${cost.toFixed(2)} ÷ (1 − ${adjusted.margin.toFixed(4)}) = ${target.toFixed(2)}. ` +
        'The cohort supplies the margin; this line supplies the cost.',
    });
    rationale.push(...adjusted.steps);

    const cohortMean = mean(margins);
    const cohortSd = standardDeviation(margins);
    if (cohortMean !== null && cohortSd !== null) {
      const ceilingMargin = cohortMean + ceilingStdevMultiple * cohortSd;
      const ceilingCandidate = priceAtMargin(cost, ceilingMargin);
      if (ceilingMargin >= 0.99) {
        warnings.push(
          `The ceiling margin works out at ${(ceilingMargin * 100).toFixed(1)}%, which has no finite price. Capped at 99%.`
        );
      }
      if (ceilingCandidate >= target) {
        ceiling = ceilingCandidate;
        rationale.push({
          label: 'Ceiling',
          value: ceiling,
          basis: `Mean margin plus ${ceilingStdevMultiple} standard deviations across the same ${cohort.length} lines`,
          detail:
            `The cohort averaged ${(cohortMean * 100).toFixed(1)}% margin with a spread of ${(cohortSd * 100).toFixed(1)} points. ` +
            `Mean plus ${ceilingStdevMultiple}× that spread is ${(Math.min(ceilingMargin, 0.99) * 100).toFixed(1)}% margin, or ${ceiling.toFixed(2)} on this cost. ` +
            'Using the spread rather than a fixed percentile means a consistent cohort gives a tight ceiling and a scattered one gives room.',
        });
      } else {
        rationale.push({
          label: 'Ceiling',
          value: null,
          basis: 'Not offered - the spread puts it below the target',
          detail:
            `Mean margin ${(cohortMean * 100).toFixed(1)}% plus ${ceilingStdevMultiple}× a spread of ${(cohortSd * 100).toFixed(1)} points ` +
            `lands below the ${(targetPercentile * 100).toFixed(0)}th percentile target. The cohort is skewed, so no ceiling is claimed.`,
        });
      }
    }

    /* Comparable business earning less than the walk-away is a finding. */
    if (floor !== null && target < floor) {
      warnings.push(
        `Comparable business achieved a median margin of ${(adjusted.margin * 100).toFixed(1)}%, below the ${(minimumMargin * 100).toFixed(0)}% walk-away. The floor applies instead of the evidence.`
      );
      target = floor;
      rationale.push({
        label: 'Floor applied',
        value: floor,
        basis: 'Evidence sits below the walk-away',
        detail:
          'The comparable-derived target fell below the cost floor, so the floor is the target. ' +
          'Either this business is habitually sold below the minimum margin, or the floor is set above what it bears.',
      });
      if (ceiling !== null && ceiling < target) ceiling = null;
    }
  } else {
    /*
     * Too thin a cohort. Cost-plus is the fallback and says so, because a user
     * needs to tell "this is what like business achieved" from "this is what
     * we would like to earn".
     */
    cohortUsed = 'none';
    targetBasis = 'cost-plus-fallback';
    const cp = calculateCostPlus({
      cost,
      standardRate: fallbackRate,
      adders: fallbackAdders,
      basis: fallbackBasis,
      minimumMargin,
    });
    warnings.push(...cp.warnings);
    target = cp.price;

    warnings.push(
      `No comparable history for this line (${usable.length} usable line${usable.length === 1 ? '' : 's'}, ${MIN_COMPARABLES} needed). Priced from cost, not from evidence.`
    );
    rationale.push({
      label: 'Target',
      value: target,
      basis: `Cost-plus fallback - only ${usable.length} comparable line${usable.length === 1 ? '' : 's'}`,
      detail:
        `${cp.formula} = ${target.toFixed(2)}, earning ${cp.marginEarned.toFixed(1)}% margin. ` +
        `This is what we aim to earn, not what comparable business achieved: fewer than ${MIN_COMPARABLES} comparable lines were available, ` +
        'so there is no evidence to price from. Treat it as a starting point for judgement.',
    });
    rationale.push({
      label: 'Ceiling',
      value: null,
      basis: 'Not offered - no comparable history',
      detail:
        'A ceiling states what comparable business has achieved. Without a cohort there is nothing to state, ' +
        'and a ceiling derived from our own cost-plus assumption would look like evidence while being a restatement of it.',
    });
  }

  /* The typed list price reports and does not price. */
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
    targetBasis,
    cohortUsed,
    comparableCount: usable.length,
    targetMargin: marginOf(target, cost),
    discountOffList,
    rationale,
    warnings,
  };
}
