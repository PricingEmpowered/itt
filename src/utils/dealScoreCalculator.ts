/**
 * Deal scoring, and the colour/label conventions that go with it.
 *
 * The scoring itself runs on the server (server/dealScore.ts). It benchmarks
 * a quote against comparable approved deals, which needs a three-level join
 * with filters on the joined tables - the one thing the PostgREST
 * compatibility layer in src/lib/dataClient.ts does not reimplement. The
 * version that lived here issued exactly that query, so it failed on every
 * call and returned a null score through its own catch, silently. That is
 * why no quote in the database carries a score.
 *
 * The signature is unchanged; `products` is no longer needed because the
 * server looks up cost and category itself, and is accepted and ignored so
 * call sites did not have to change shape.
 */
import { DealScoreDetails, QuoteLine, Product } from '../types';
import { trpcClient } from '../lib/trpcClient';

export interface DealScoreResult {
  score: number | null;
  details: DealScoreDetails | null;
  /** Why no score was produced, for display. Null when one was. */
  reason?: string | null;
}

export async function calculateDealScore(
  quoteLines: Partial<QuoteLine>[],
  _products: Product[],
  customerId: string
): Promise<DealScoreResult> {
  if (!customerId || quoteLines.length === 0) {
    return { score: null, details: null, reason: 'No customer or no lines to score.' };
  }

  try {
    const lines = quoteLines
      .filter((line): line is Partial<QuoteLine> & { product_id: string } => !!line.product_id)
      .map((line) => ({
        product_id: line.product_id,
        unit_price: line.unit_price ?? null,
        discount_applied: line.discount_applied ?? null,
      }));

    if (lines.length === 0) {
      return { score: null, details: null, reason: 'No line names a product.' };
    }

    const result = await trpcClient.quotes.dealScore.query({ customerId, lines });
    return {
      score: result.score,
      details: result.details as DealScoreDetails | null,
      reason: result.reason,
    };
  } catch (error) {
    console.error('Error calculating deal score:', error);
    return { score: null, details: null, reason: 'Scoring failed; see the console.' };
  }
}

export function getDealScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'gray';
  if (score >= 110) return 'green';
  if (score >= 90) return 'yellow';
  return 'red';
}

export function getDealScoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'Not Scored';
  if (score >= 110) return 'Excellent';
  if (score >= 90) return 'Good';
  return 'Needs Attention';
}

export function getDealScoreBgColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-800';
  if (score >= 110) return 'bg-green-100 text-green-800';
  if (score >= 90) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}
