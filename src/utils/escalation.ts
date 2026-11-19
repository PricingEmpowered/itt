/**
 * Whether a quote line, at the price currently entered, needs approval.
 *
 * Runs in the browser against the price as the analyst edits it, so the flag
 * moves with every keystroke without a round trip. The minimum margin comes
 * from the server, which resolves it per product line and region; this only
 * does the comparison.
 *
 * Approval itself happens in Channel Partners. This tells the analyst, before
 * they export, that the price they have chosen will be escalated there.
 *
 * ## "Unknown" is an answer, not a default to either side
 *
 * With no cost, no price, or no minimum margin the line cannot be assessed,
 * and the result says so. Reporting such a line as within authority would let
 * an unpriced or uncosted line pass as fine; reporting it as needing approval
 * would raise alarms the data cannot support.
 */

export type EscalationStatus = 'needs-approval' | 'within-authority' | 'unknown';

export interface EscalationInput {
  /** Unit price before discount. */
  unitPrice: number | null | undefined;
  /** Discount in percent, 0 to 100. */
  discountPercent: number | null | undefined;
  /** Per-unit cost. */
  cost: number | null | undefined;
  /** Minimum margin as a fraction: 0.30 is 30%. */
  minimumMargin: number | null | undefined;
}

export interface EscalationAssessment {
  status: EscalationStatus;
  /** Margin at the current price, in percent. Null when it cannot be known. */
  marginPercent: number | null;
  minimumMarginPercent: number | null;
  /** One sentence for the screen. */
  reason: string;
}

/**
 * Margins are compared to two decimal places of a percent, the precision a
 * margin is shown at. A price is rounded to the cent, and a price built to hit
 * exactly 30.00% can come out at 29.998% once rounded; without this, the
 * recommended price itself would be flagged as needing approval.
 */
function atDisplayedPrecision(fraction: number): number {
  return Math.round(fraction * 10000) / 10000;
}

export function assessEscalation(input: EscalationInput): EscalationAssessment {
  const { unitPrice, discountPercent, cost, minimumMargin } = input;

  const unknown = (reason: string, margin: number | null = null): EscalationAssessment => ({
    status: 'unknown',
    marginPercent: margin,
    minimumMarginPercent:
      minimumMargin != null && Number.isFinite(minimumMargin) ? minimumMargin * 100 : null,
    reason,
  });

  if (minimumMargin == null || !Number.isFinite(minimumMargin)) {
    return unknown('No minimum margin is set for this line.');
  }
  if (cost == null || !Number.isFinite(cost) || cost <= 0) {
    return unknown('There is no cost on this line, so its margin cannot be worked out.');
  }
  if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return unknown('No price has been entered yet.');
  }

  const discount = discountPercent != null && Number.isFinite(discountPercent) ? discountPercent : 0;
  const effective = unitPrice * (1 - discount / 100);
  if (effective <= 0) {
    return unknown('The discount leaves nothing to price.');
  }

  const margin = (effective - cost) / effective;
  const marginPercent = margin * 100;
  const minimumMarginPercent = minimumMargin * 100;

  if (atDisplayedPrecision(margin) < atDisplayedPrecision(minimumMargin)) {
    return {
      status: 'needs-approval',
      marginPercent,
      minimumMarginPercent,
      reason: `${marginPercent.toFixed(1)}% is below the ${minimumMarginPercent.toFixed(1)}% minimum margin.`,
    };
  }

  return {
    status: 'within-authority',
    marginPercent,
    minimumMarginPercent,
    reason: `${marginPercent.toFixed(1)}% meets the ${minimumMarginPercent.toFixed(1)}% minimum margin.`,
  };
}

/** How many lines in a quote need approval, and how many could not be assessed. */
export function summariseEscalation(assessments: EscalationAssessment[]): {
  needsApproval: number;
  unknown: number;
  total: number;
} {
  return {
    needsApproval: assessments.filter((a) => a.status === 'needs-approval').length,
    unknown: assessments.filter((a) => a.status === 'unknown').length,
    total: assessments.length,
  };
}
