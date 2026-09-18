import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { db } from '../../lib/dataClient';
import { LoadingSpinner } from '../LoadingSpinner';

/*
 * This tab used to read a single hardcoded row -- a $1,000,000 list price with
 * round-number discounts, dated December 2023, that nothing derived and
 * nothing refreshed. It now reads what `refresh_price_waterfall()` computes
 * from finalised quotes, which means three of the nine bars have no source
 * and come back NULL. They are rendered as "not captured" rather than as
 * zero: zero would assert there is no off-invoice leakage, and nobody has
 * made that claim.
 */
interface WaterfallData {
  period_start: string;
  list_price: number;
  volume_discount: number;
  contract_discount: number;
  promotional_discount: number;
  invoice_price: number;
  rebates: number | null;
  payment_terms: number | null;
  freight: number | null;
  pocket_price: number;
  lines_total: number;
  lines_with_list_price: number;
  lines_with_break: number;
  spa_linked_lines: number;
}

const usd = (value: number, compact = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    ...(compact ? { notation: 'compact' as const } : {}),
  }).format(value);

/* Every percentage on this screen is a share of list. With no list price the
   denominator is zero, so say so instead of printing NaN or Infinity. */
const shareOfList = (value: number, listPrice: number) =>
  listPrice > 0 ? `${((value / listPrice) * 100).toFixed(1)}% of list` : null;

export function PriceWaterfallAnalysis() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WaterfallData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await db
        .from('analytics_price_waterfall')
        .select('*')
        .is('product_family', null)
        .is('region', null)
        .is('channel', null)
        .is('segment', null)
        .order('period_start', { ascending: false })
        .limit(1);

      if (error) throw error;
      setData(rows && rows.length > 0 ? (rows[0] as WaterfallData) : null);
    } catch (error) {
      console.error('Error loading price waterfall:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-slate-600">
        No finalised quotes yet. The waterfall is derived from them, so it
        appears once quotes have been approved or rejected.
      </div>
    );
  }

  const hasListPrice = Number(data.list_price) > 0;
  const coverage =
    data.lines_total > 0
      ? (data.lines_with_list_price / data.lines_total) * 100
      : 0;

  const onInvoiceDiscount =
    Number(data.volume_discount) +
    Number(data.contract_discount) +
    Number(data.promotional_discount);

  /* A bar is either a known amount or an explicit gap in the source data. */
  const components: {
    label: string;
    value: number | null;
    isTotal?: boolean;
    isNegative?: boolean;
  }[] = [
    { label: 'List Price', value: Number(data.list_price), isTotal: true },
    { label: 'Volume Discount', value: -Number(data.volume_discount), isNegative: true },
    { label: 'Contract Discount', value: -Number(data.contract_discount), isNegative: true },
    { label: 'Other Discount', value: -Number(data.promotional_discount), isNegative: true },
    { label: 'Invoice Price', value: Number(data.invoice_price), isTotal: true },
    { label: 'Rebates', value: data.rebates === null ? null : -Number(data.rebates), isNegative: true },
    { label: 'Payment Terms', value: data.payment_terms === null ? null : -Number(data.payment_terms), isNegative: true },
    { label: 'Freight', value: data.freight === null ? null : -Number(data.freight), isNegative: true },
    { label: 'Pocket Price', value: Number(data.pocket_price), isTotal: true },
  ];

  const missing = components.filter((c) => c.value === null).map((c) => c.label);
  const maxValue = Math.max(Number(data.list_price), Number(data.invoice_price), 1);

  return (
    <div className="space-y-6">
      {!hasListPrice && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={18} />
          <div className="text-sm">
            <p className="font-medium text-amber-900">No list price on file</p>
            <p className="text-amber-800 mt-1">
              None of the {data.lines_total.toLocaleString()} quoted lines in this
              period matched a part on their quote's price list, so the waterfall
              has no starting point. Load the price lists for the business unit
              these quotes belong to and refresh the aggregates.
            </p>
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-slate-500 mt-0.5 flex-shrink-0" size={18} />
          <div className="text-sm">
            <p className="font-medium text-slate-900">
              Off-invoice leakage is not captured
            </p>
            <p className="text-slate-700 mt-1">
              {missing.join(', ')} are not present in any source extract, so they
              are shown as unknown rather than as zero. Pocket price therefore
              equals invoice price and is a ceiling, not a measurement.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Price Waterfall Breakdown
          </h3>
          <div className="text-xs text-slate-500 text-right">
            <div>
              Period starting{' '}
              {new Date(data.period_start).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </div>
            <div>
              {data.lines_with_list_price.toLocaleString()} of{' '}
              {data.lines_total.toLocaleString()} lines priced ({coverage.toFixed(0)}% coverage)
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-4">
          <SummaryTile
            tone="blue"
            label="List Price"
            value={Number(data.list_price)}
            caption={hasListPrice ? null : 'no list price on file'}
          />
          <SummaryTile
            tone="yellow"
            label="Invoice Price"
            value={Number(data.invoice_price)}
            caption={shareOfList(Number(data.invoice_price), Number(data.list_price))}
          />
          <SummaryTile
            tone="green"
            label="Pocket Price"
            value={Number(data.pocket_price)}
            caption={
              missing.length > 0
                ? 'ceiling — off-invoice leakage unknown'
                : shareOfList(Number(data.pocket_price), Number(data.list_price))
            }
          />
        </div>

        {!hasListPrice ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
            Nothing to chart until the quoted parts carry a list price.
          </div>
        ) : (
        <div className="h-96 flex items-end justify-between gap-2">
          {components.map((component, idx) => {
            const known = component.value !== null;
            const height = known
              ? (Math.abs(component.value as number) / maxValue) * 100
              : 0;
            const bgColor = !known
              ? 'bg-slate-200'
              : component.isTotal
              ? 'bg-blue-600'
              : component.isNegative
              ? 'bg-red-500'
              : 'bg-green-500';

            return (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full ${bgColor} rounded-t transition-all hover:opacity-80 ${
                    known ? 'cursor-pointer' : 'border border-dashed border-slate-400'
                  }`}
                  style={{ height: `${height}%`, minHeight: '12px' }}
                  title={
                    known
                      ? `${component.label}: ${usd(Math.abs(component.value as number))}`
                      : `${component.label}: not captured in any source extract`
                  }
                />
                <div className="mt-3 text-center">
                  <div className="text-xs text-slate-600 mb-1 leading-tight">
                    {component.label}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      known ? 'text-slate-900' : 'text-slate-400 italic'
                    }`}
                  >
                    {known ? usd(Math.abs(component.value as number), true) : 'n/a'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        <div className="flex items-center justify-center gap-6 mt-6 text-sm">
          <LegendSwatch className="bg-blue-600" label="Total Values" />
          <LegendSwatch className="bg-red-500" label="Deductions" />
          <LegendSwatch
            className="bg-slate-200 border border-dashed border-slate-400"
            label="Not captured"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Price Leakage Analysis
        </h3>

        <div className="space-y-4">
          <LeakageRow
            title="Total Discounts"
            subtitle="Pre-invoice reductions"
            amount={onInvoiceDiscount}
            caption={shareOfList(onInvoiceDiscount, Number(data.list_price))}
          />
          <LeakageRow
            title="Post-Invoice Costs"
            subtitle="Rebates, terms, freight"
            amount={missing.length > 0 ? null : 0}
            caption="not captured in any source extract"
          />
          <LeakageRow
            title="Explained by a Quantity Break"
            subtitle={`${data.lines_with_break.toLocaleString()} of ${data.lines_with_list_price.toLocaleString()} priced lines matched a break`}
            amount={Number(data.volume_discount)}
            caption={shareOfList(Number(data.volume_discount), Number(data.list_price))}
          />
          <LeakageRow
            title="Explained by a Contract"
            subtitle={
              data.spa_linked_lines > 0
                ? `${data.spa_linked_lines.toLocaleString()} lines tied to a special pricing agreement`
                : 'no lines tied to a special pricing agreement — SPA extract not loaded'
            }
            amount={Number(data.contract_discount)}
            caption={shareOfList(Number(data.contract_discount), Number(data.list_price))}
          />
        </div>
      </div>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded ${className}`} />
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

function SummaryTile({
  tone,
  label,
  value,
  caption,
}: {
  tone: 'blue' | 'yellow' | 'green';
  label: string;
  value: number;
  caption: string | null;
}) {
  const tones = {
    blue: ['bg-blue-50 border-blue-200', 'text-blue-700', 'text-blue-900', 'text-blue-600'],
    yellow: ['bg-yellow-50 border-yellow-200', 'text-yellow-700', 'text-yellow-900', 'text-yellow-600'],
    green: ['bg-green-50 border-green-200', 'text-green-700', 'text-green-900', 'text-green-600'],
  }[tone];

  return (
    <div className={`${tones[0]} border rounded-lg p-4`}>
      <div className={`text-sm ${tones[1]} mb-1`}>{label}</div>
      <div className={`text-2xl font-bold ${tones[2]}`}>{usd(value)}</div>
      {caption && <div className={`text-xs ${tones[3]} mt-1`}>{caption}</div>}
    </div>
  );
}

function LeakageRow({
  title,
  subtitle,
  amount,
  caption,
}: {
  title: string;
  subtitle: string;
  amount: number | null;
  caption: string | null;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
      <div>
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-sm text-slate-600">{subtitle}</div>
      </div>
      <div className="text-right">
        <div
          className={`text-2xl font-bold ${
            amount === null ? 'text-slate-400 italic' : 'text-slate-900'
          }`}
        >
          {amount === null ? 'n/a' : usd(amount)}
        </div>
        {caption && <div className="text-sm text-slate-500">{caption}</div>}
      </div>
    </div>
  );
}
