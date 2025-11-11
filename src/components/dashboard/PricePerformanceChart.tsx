import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PricePerformanceChartProps {
  filters: {
    productFamily: string;
    timeframe: string;
    region: string;
    channel: string;
  };
}

export function PricePerformanceChart({ filters }: PricePerformanceChartProps) {
  const data = useMemo(() => {
    const baseData = [
      { date: 'Jan', priceIndex: 100, costIndex: 95, valueGap: 5 },
      { date: 'Feb', priceIndex: 102, costIndex: 96, valueGap: 6 },
      { date: 'Mar', priceIndex: 105, costIndex: 98, valueGap: 7 },
      { date: 'Apr', priceIndex: 103, costIndex: 97, valueGap: 6 },
      { date: 'May', priceIndex: 107, costIndex: 99, valueGap: 8 },
      { date: 'Jun', priceIndex: 110, costIndex: 100, valueGap: 10 },
      { date: 'Jul', priceIndex: 108, costIndex: 99, valueGap: 9 },
      { date: 'Aug', priceIndex: 112, costIndex: 101, valueGap: 11 },
      { date: 'Sep', priceIndex: 115, costIndex: 103, valueGap: 12 },
      { date: 'Oct', priceIndex: 113, costIndex: 102, valueGap: 11 },
      { date: 'Nov', priceIndex: 118, costIndex: 105, valueGap: 13 },
      { date: 'Dec', priceIndex: 120, costIndex: 106, valueGap: 14 },
    ];

    const multiplier =
      (filters.productFamily === 'hardware' ? 1.1 : 1) *
      (filters.region === 'north-america' ? 1.05 : 1) *
      (filters.channel === 'direct' ? 1.08 : 1);

    return baseData.map(item => ({
      ...item,
      priceIndex: Math.round(item.priceIndex * multiplier),
      costIndex: Math.round(item.costIndex * multiplier),
      valueGap: Math.round(item.valueGap * multiplier),
    }));
  }, [filters]);

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
