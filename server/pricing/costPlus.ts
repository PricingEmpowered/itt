/**
 * Cost-plus pricing, with the basis stated rather than assumed.
 *
 * ## The defect this replaces
 *
 * The rules engine computed `cost * (1 + 0.40 + adders)` behind a variable
 * named `standardMargin` and a column named `margin_adder`. That arithmetic is
 * a markup: on a $100 part, "40%" returns $140, which earns a 28.6% margin.
 * Earning 40% requires dividing - $100 / 0.60 = $166.67 - so the naming and
 * the arithmetic disagreed, and nobody reading the screen could tell which was
 * intended.
 *
 * ITT's own SPA system computes margin on price: its `MARGIN_n` reconciles to
 * (price - cost) / price on every sample tier, to two decimals. So margin is
 * the likelier intent. That is still not grounds for switching silently -
 * changing the basis reprices every cost-plus quote by about 19%, and this is
 * going into a pilot where sales quote from it. The basis is therefore a
 * configured choice, displayed on every calculation, and the rate it applies
 * to is configuration rather than a literal in a component.
 *
 * ## The floor
 *
 * Nothing previously stopped the engine returning a price below cost.
 * Section 7.2 of the target pricing specification puts a floor at
 * cost / (1 - minimum margin). It is applied after the basis, and it wins.
 */

export type MarginBasis = 'margin' | 'markup';

export interface CostPlusInput {
  cost: number;
  /** Base rate, interpreted per `basis`. 0.40 means 40%. */
  standardRate: number;
  /** Rule-driven additions to the base rate, same interpretation. */
  adders?: number[];
  basis: MarginBasis;
  /** Cost floor as a margin. 0.20 means never below cost / 0.80. */
  minimumMargin?: number;
}

export interface CostPlusResult {
  price: number;
  /** What the price actually earns, whichever basis produced it. */
  marginEarned: number;
  markupApplied: number;
  totalRate: number;
  basis: MarginBasis;
  floorPrice: number | null;
  floorApplied: boolean;
  /** Human-readable, for display next to the number. */
  formula: string;
  warnings: string[];
}

/** Margin a price earns over a cost. Guards the zero-price case. */
export function marginOf(price: number, cost: number): number {
  if (!Number.isFinite(price) || price === 0) return 0;
  return ((price - cost) / price) * 100;
}

export function calculateCostPlus(input: CostPlusInput): CostPlusResult {
  const { cost, standardRate, adders = [], basis, minimumMargin = 0.2 } = input;
  const warnings: string[] = [];

  const totalRate = adders.reduce((sum, a) => sum + (a || 0), standardRate);

  let price: number;
  let formula: string;

  if (basis === 'margin') {
    /*
     * A rate at or above 1 means "100% margin", which has no finite price.
     * Rather than returning Infinity to a quote screen, cap and say so.
     */
    if (totalRate >= 1) {
      warnings.push(
        `Total margin rate is ${(totalRate * 100).toFixed(1)}%, which cannot be priced. Capped at 99%.`
      );
    }
    const rate = Math.min(totalRate, 0.99);
    price = cost / (1 - rate);
    formula = `${cost.toFixed(2)} ÷ (1 − ${rate.toFixed(4)})`;
  } else {
    price = cost * (1 + totalRate);
    formula = `${cost.toFixed(2)} × (1 + ${totalRate.toFixed(4)})`;
  }

  /* Section 7.2. Applied last, and it wins. */
  const floorPrice =
    minimumMargin > 0 && minimumMargin < 1 ? cost / (1 - minimumMargin) : null;
  let floorApplied = false;
  if (floorPrice !== null && price < floorPrice) {
    warnings.push(
      `Computed price ${price.toFixed(2)} is below the cost floor ${floorPrice.toFixed(2)} ` +
        `(minimum margin ${(minimumMargin * 100).toFixed(0)}%). Raised to the floor.`
    );
    price = floorPrice;
    floorApplied = true;
    formula += ` → floored at ${floorPrice.toFixed(2)}`;
  }

  /*
   * A markup basis with a rate people think of as a margin is the defect this
   * module exists for, so say it on every calculation rather than waiting for
   * someone to notice the prices are low.
   */
  if (basis === 'markup') {
    const earned = marginOf(price, cost);
    warnings.push(
      `Priced on a markup basis: a ${(totalRate * 100).toFixed(1)}% markup earns ` +
        `${earned.toFixed(1)}% margin. Switch the rule set to a margin basis if ` +
        `${(totalRate * 100).toFixed(1)}% was meant as margin.`
    );
  }

  return {
    price,
    marginEarned: marginOf(price, cost),
    markupApplied: cost === 0 ? 0 : ((price - cost) / cost) * 100,
    totalRate,
    basis,
    floorPrice,
    floorApplied,
    formula,
    warnings,
  };
}
