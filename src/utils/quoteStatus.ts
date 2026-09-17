/**
 * The quote status vocabulary, in lifecycle order.
 *
 * Screens had been carrying their own four-value subsets of this - Draft,
 * Under Review, Approved, Rejected - while the database triggers and
 * get_dashboard_metrics work with eight. Anything outside a screen's subset
 * was invisible there: the quotes list showed no tile and offered no filter
 * for "Sent", so the nine quotes imported from ITT's extract appeared in the
 * table but in none of the counts above it, and could not be filtered for.
 */
export const QUOTE_STATUSES = [
  'Draft',
  'Sent',
  'Pending Approval',
  'Under Review',
  'Approved',
  'Rejected',
  'Won',
  'Lost',
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Statuses that count as live pipeline, matching get_dashboard_metrics. */
export const ACTIVE_QUOTE_STATUSES: readonly string[] = [
  'Draft',
  'Sent',
  'Pending Approval',
  'Under Review',
];

const BADGES: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-800',
  Sent: 'bg-blue-100 text-blue-800',
  'Pending Approval': 'bg-amber-100 text-amber-800',
  'Under Review': 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Won: 'bg-emerald-100 text-emerald-800',
  Lost: 'bg-rose-100 text-rose-800',
};

const COUNTS: Record<string, string> = {
  Draft: 'text-gray-900',
  Sent: 'text-blue-600',
  'Pending Approval': 'text-amber-600',
  'Under Review': 'text-yellow-600',
  Approved: 'text-green-600',
  Rejected: 'text-red-600',
  Won: 'text-emerald-600',
  Lost: 'text-rose-600',
};

export function quoteStatusBadge(status: string | null | undefined): string {
  return (status && BADGES[status]) || 'bg-gray-100 text-gray-800';
}

export function quoteStatusCountColor(status: string): string {
  return COUNTS[status] || 'text-gray-900';
}
