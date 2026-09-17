import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { trpc } from '../../lib/trpc';
import type { DashboardChartFilters } from './DashboardFilters';

interface PricePerformanceChartProps {
  filters: DashboardChartFilters;
}

/**
 * Average quoted price and average cost by month, both rebased to 100 at the
 * first month with data.
 *
 * This was a hardcoded twelve-point series - Jan 100, Feb 102, Mar 105 and so
 * on - multiplied by a constant keyed off the filter values. Changing a
 * filter moved every point, which made it look connected to something; it
 * never read the database at all.
 */
export function PricePerformanceChart({ filters }: PricePerformanceChartProps) {
  const query = trpc.dashboard.pricePerformance.useQuery(filters);

  const data = useMemo(
    () =>
      (query.data?.points ?? [])
        .filter((point) => point.priceIndex !== null)
        .map((point) => ({
          date: new Date(`${point.month}-01T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit',
            timeZone: 'UTC',
          }),
          priceIndex: point.priceIndex,
          costIndex: point.costIndex,
          valueGap: point.valueGap,
        })),
    [query.data]
  );

  if (query.isLoading) {
    return <p className="text-sm text-slate-500">Loading price performance...</p>;
  }

  if (query.isError) {
    return <p className="text-sm text-red-600">{query.error.message}</p>;
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No priced quote lines match these filters, so there is no series to index.
      </p>
    );
  }

  if (!query.data?.indexed) {
    return (
      <p className="text-sm text-slate-500">
        The earliest month in range has no cost recorded, so the series cannot be
        rebased to an index.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#94a3b8"
          style={{ fontSize: '11px' }}
          axisLine={{ stroke: '#e2e8f0' }}
          tickLine={false}
        />
        <YAxis
          stroke="#94a3b8"
          style={{ fontSize: '11px' }}
          axisLine={{ stroke: '#e2e8f0' }}
          tickLine={false}
          domain={[0, 'auto']}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            fontSize: '12px',
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
          iconType="plainline"
        />
        <Line
          type="monotone"
          dataKey="priceIndex"
          stroke="#3b82f6"
          strokeWidth={2.5}
          name="Price Index"
          dot={false}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="costIndex"
          stroke="#ef4444"
          strokeWidth={2.5}
          name="Cost Index"
          dot={false}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="valueGap"
          stroke="#06b6d4"
          strokeWidth={2.5}
          strokeDasharray="5 5"
          name="Value Gap"
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
