import { useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { trpc } from '../../lib/trpc';
import type { DashboardChartFilters } from './DashboardFilters';
import { formatCurrency } from '../../utils/format';

interface MarginAnalysisChartProps {
  filters: DashboardChartFilters;
}

/**
 * Margin bridge between the two halves of the selected window.
 *
 * What was here was six constants - an $850,000 base margin, a $45,000 price
 * effect and so on - scaled by a multiplier derived from the filter values.
 * No query, and the bars did not even float: each effect was drawn from zero,
 * so it was a bar chart wearing a waterfall's labels.
 *
 * The server decomposes real quoted margin at the (customer, product) grain,
 * and the five effects reconcile exactly to the difference between the two
 * halves. Effect bars float from the running total, which is what makes the
 * shape readable.
 */
export function MarginAnalysisChart({ filters }: MarginAnalysisChartProps) {
  const query = trpc.dashboard.marginBridge.useQuery(filters);

  const data = useMemo(() => {
    const bridge = query.data;
    if (!bridge) return [];

    const steps = [
      { name: 'Price', value: bridge.priceEffect },
      { name: 'Cost', value: bridge.costEffect },
      { name: 'Volume', value: bridge.volumeEffect },
      { name: 'New Business', value: bridge.newBusiness },
      { name: 'Lost Business', value: bridge.lostBusiness },
    ];

    type Bar = {
      name: string;
      offset: number;
      span: number;
      value: number;
      kind: 'total' | 'up' | 'down';
    };
    const bars: Bar[] = [
      { name: 'Earlier half', offset: 0, span: bridge.opening, value: bridge.opening, kind: 'total' },
    ];

    let running = bridge.opening;
    for (const step of steps) {
      const from = running;
      running += step.value;
      bars.push({
        name: step.name,
        offset: Math.min(from, running),
        span: Math.abs(step.value),
        value: step.value,
        kind: step.value >= 0 ? 'up' : 'down',
      });
    }

    bars.push({
      name: 'Later half',
      offset: 0,
      span: bridge.closing,
      value: bridge.closing,
      kind: 'total',
    });

    return bars;
  }, [query.data]);

  const COLORS = { total: '#3b82f6', up: '#10b981', down: '#ef4444' };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const bar = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-slate-900 mb-1">{bar.name}</p>
        <p className="text-sm text-slate-600">
          {bar.kind === 'total' ? 'Quoted margin' : 'Effect'}:{' '}
          <span className="font-medium">{formatCurrency(bar.value, { decimals: 0 })}</span>
        </p>
      </div>
    );
  };

  if (query.isLoading) {
    return <p className="text-sm text-slate-500">Loading margin bridge...</p>;
  }

  if (query.isError) {
    return <p className="text-sm text-red-600">{query.error.message}</p>;
  }

  if (data.length === 0 || query.data?.pairs === 0) {
    return (
      <p className="text-sm text-slate-500">
        No quote line matching these filters carries both a price and a cost, so
        margin cannot be bridged.
      </p>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={330}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#94a3b8"
            style={{ fontSize: '11px' }}
            angle={-45}
            textAnchor="end"
            height={80}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            style={{ fontSize: '11px' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            label={{ value: 'Quoted margin', angle: -90, position: 'insideLeft', style: { fontSize: '11px' } }}
            tickFormatter={(value) => `$${(value / 1_000_000).toFixed(1)}M`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          {/* The offset bar is the float; it is transparent so only the span shows. */}
          <Bar dataKey="offset" stackId="a" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="span" stackId="a" radius={[4, 4, 0, 0]}>
            {data.map((bar) => (
              <Cell key={bar.name} fill={COLORS[bar.kind]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500 mt-2">
        Quoted margin, not booked: no ITT extract is order history, so volume here
        is quoted quantity. Across {query.data?.pairs.toLocaleString()} customer and
        product pairs.
      </p>
    </>
  );
}
