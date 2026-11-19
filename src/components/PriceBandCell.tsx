/**
 * The pricing guidance shown against one quote line.
 *
 * Three numbers and, more importantly, where they came from. The band is
 * useless to an analyst who cannot tell evidence from assumption, so the
 * basis is stated on the face of the cell rather than hidden in a tooltip:
 * a target drawn from comparable transactions and a target drawn from a
 * cost-plus rate look different here, because trusting them differently is
 * the correct response.
 *
 * The rationale panel is collapsed by default and carries the working -
 * which cohort, how many lines, what margin, what formula. It is the same
 * structure that is stored on the line and goes out with the export, so what
 * the analyst read is what the record says.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import type { PricedLine } from '../../server/pricing/priceQuoteLines';

interface Props {
  priced: PricedLine | undefined;
  /** Applies the target to the line's unit price. */
  onApplyTarget: (price: number) => void;
  format: (value: number) => string;
}

export function PriceBandCell({ priced, onApplyTarget, format }: Props) {
  const [showRationale, setShowRationale] = useState(false);

  if (!priced) {
    return <span className="text-xs text-gray-400">Not priced yet</span>;
  }

  const { band, costSource } = priced;

  if (!band.priceable) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs font-medium text-amber-700">
          <AlertTriangle size={13} />
          No price
        </div>
        <div className="text-xs text-gray-500">
          {costSource === 'none' ? 'No cost on this line.' : 'Cost could not be used.'}
        </div>
      </div>
    );
  }

  const evidenceBased = band.targetBasis === 'comparable';

  return (
    <div className="space-y-1 min-w-[190px]">
      <div className="flex items-baseline gap-2">
        <button
          onClick={() => band.target !== null && onApplyTarget(band.target)}
          className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
          title="Use this as the unit price"
        >
          {band.target === null ? '—' : format(band.target)}
        </button>
        <span className="text-[11px] text-gray-500">target</span>
      </div>

      <div className="flex gap-3 text-[11px] text-gray-600">
        <span>
          floor <span className="font-medium">{band.floor === null ? '—' : format(band.floor)}</span>
        </span>
        <span>
          ceiling{' '}
          <span className="font-medium">
            {band.ceiling === null ? '—' : format(band.ceiling)}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
            evidenceBased
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
          title={
            evidenceBased
              ? `From ${band.comparableCount} comparable lines (${band.cohortUsed} cohort)`
              : 'No comparable history for this line, so the target is a cost-plus assumption'
          }
        >
          {evidenceBased ? `evidence · ${band.comparableCount}` : 'assumed'}
        </span>

        {band.targetMargin !== null && (
          <span className="text-[10px] text-gray-500">{band.targetMargin.toFixed(1)}% margin</span>
        )}

        {band.warnings.length > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-[10px] text-amber-700"
            title={band.warnings.join('\n\n')}
          >
            <AlertTriangle size={11} />
            {band.warnings.length}
          </span>
        )}

        <button
          onClick={() => setShowRationale((v) => !v)}
          className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-gray-800"
        >
          {showRationale ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          why
        </button>
      </div>

      {showRationale && (
        <div className="mt-1 p-2 bg-gray-50 border border-gray-200 rounded space-y-2 max-w-sm">
          {band.rationale.map((step, i) => (
            <div key={i} className="text-[11px] leading-snug">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-800">{step.label}</span>
                {step.value !== null && (
                  <span className="font-medium text-gray-700">{format(step.value)}</span>
                )}
              </div>
              <div className="text-gray-600">{step.basis}</div>
              <div className="text-gray-500">{step.detail}</div>
            </div>
          ))}

          {band.warnings.length > 0 && (
            <div className="pt-1 border-t border-gray-200 space-y-1">
              {band.warnings.map((w, i) => (
                <div key={i} className="flex gap-1 text-[11px] text-amber-800">
                  <Info size={11} className="mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
