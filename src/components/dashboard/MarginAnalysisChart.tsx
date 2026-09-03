import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MarginAnalysisChartProps {
  filters: {
    productFamily: string;
    timeframe: string;
    region: string;
    channel: string;
  };
}

export function MarginAnalysisChart({ filters }: MarginAnalysisChartProps) {
  const data = useMemo(() => {
    const multiplier =
      (filters.productFamily === 'hardware' ? 1.1 : filters.productFamily === 'software' ? 1.3 : 1) *
      (filters.region === 'north-america' ? 1.05 : filters.region === 'europe' ? 0.95 : 1) *
      (filters.channel === 'direct' ? 1.08 : filters.channel === 'partner' ? 0.92 : 1);

    const baseMargin = 850000 * multiplier;
    const priceEffect = 45000 * multiplier;
    const costEffect = -28000 * multiplier;
    const volumeEffect = 62000 * multiplier;
    const newBusinessEffect = 38000 * multiplier;
    const lostBusinessEffect = -52000 * multiplier;
    const finalMargin = baseMargin + priceEffect + costEffect + volumeEffect + newBusinessEffect + lostBusinessEffect;

    return [
      {
        name: 'Last Year FY',
        baseValue: baseMargin,
        positiveEffect: 0,
        negativeEffect: 0,
        category: 'base'
      },
      {
        name: 'Price',
        baseValue: 0,
        positiveEffect: priceEffect,
        negativeEffect: 0,
        category: 'positive'
      },
      {
        name: 'Cost',
        baseValue: 0,
        positiveEffect: 0,
        negativeEffect: costEffect,
        category: 'negative'
      },
      {
        name: 'Volume',
        baseValue: 0,
        positiveEffect: volumeEffect,
        negativeEffect: 0,
        category: 'positive'
      },
      {
        name: 'New Business',
        baseValue: 0,
        positiveEffect: newBusinessEffect,
        negativeEffect: 0,
        category: 'positive'
      },
      {
        name: 'Lost Business',
        baseValue: 0,
        positiveEffect: 0,
        negativeEffect: lostBusinessEffect,
        category: 'negative'
      },
      {
        name: 'This Year FY',
        baseValue: finalMargin,
        positiveEffect: 0,
        negativeEffect: 0,
        category: 'base'
      },
    ];
  }, [filters]);

  const formatValue = (value: number) => {
    return `$${(Math.abs(value) / 1000000).toFixed(2)}M`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    let value = 0;
    let label = '';

    if (data.category === 'base') {
      value = data.baseValue;
      label = 'Margin';
    } else if (data.category === 'positive') {
      value = data.positiveEffect;
      label = 'Positive Effect';
    } else {
      value = data.negativeEffect;
      label = 'Negative Effect';
    }

    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-slate-900 mb-1">{data.name}</p>
        <p className="text-sm text-slate-600">
          {label}: <span className="font-medium">{formatValue(value)}</span>
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
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
          label={{ value: 'Amount ($M)', angle: -90, position: 'insideLeft', style: { fontSize: '11px' } }}
          tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
          domain={[0, 'auto']}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
        <Bar dataKey="baseValue" name="Base/Final" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="positiveEffect" name="Positive Effect" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="negativeEffect" name="Negative Effect" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
