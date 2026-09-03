import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AnalyticsFilterBar from "@/components/AnalyticsFilterBar";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, ComposedChart, Cell, BarChart, Bar, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, FileText, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  ANALYTICS_FAMILIES as FAMILIES,
  ANALYTICS_REGIONS as REGIONS,
  ANALYTICS_CHANNELS as CHANNELS,
  ANALYTICS_TIME_PERIODS as TIME_PERIODS,
  ANALYTICS_INDUSTRIES as INDUSTRIES,
} from "@/lib/analyticsConstants";

// Waterfall chart colors
const BRIDGE_COLORS: Record<string, string> = {
  "Last Year YTD": "#1e3a5f",
  "Price": "#22c55e",
  "Cost": "#ef4444",
  "Volume": "#3b82f6",
  "New Business": "#22c55e",
  "Lost Business": "#ef4444",
  "This Year YTD": "#1e3a5f",
};

function KpiCard({ label, value, pct, icon: Icon, format = "currency" }: {
  label: string; value: number; pct: number; icon: React.ElementType; format?: "currency" | "percent" | "number";
}) {
  const formatted = format === "currency"
    ? `$${(value / 1_000_000).toFixed(2)}M`
    : format === "percent"
    ? `${value.toFixed(1)}%`
    : value.toLocaleString();

  const isPositive = pct >= 0;
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{formatted}</p>
            <div className={cn("flex items-center gap-1 mt-1.5 text-xs font-medium", isPositive ? "text-green-600" : "text-red-500")}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isPositive ? "+" : ""}{pct.toFixed(1)}% vs last period
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Waterfall bar shape
function WaterfallBar(props: Record<string, unknown>) {
  const { x, y, width, height, fill } = props as { x: number; y: number; width: number; height: number; fill: string };
  if (!height || height === 0) return null;
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={fill} rx={2} />;
}

export default function OverallPerformance() {
  const [timePeriod, setTimePeriod] = useState("Year over Year");
  const [productFamily, setProductFamily] = useState("All Product Families");
  const [region, setRegion] = useState("All Regions");
  const [channel, setChannel] = useState("All Channels");
  const [industry, setIndustry] = useState("All Industries");

  const { data, isLoading } = trpc.analytics.getOverallPerformance.useQuery(
    { timePeriod, productFamily, region, channel },
    { staleTime: 30_000 }
  );

  // Format period labels
  const priceChartData = useMemo(() => {
    if (!data?.pricePerformance) return [];
    return data.pricePerformance.map((p) => ({
      ...p,
      label: p.period.replace("-", "/"),
    }));
  }, [data]);

  // Build waterfall chart data
  const waterfallData = useMemo(() => {
    if (!data?.marginBridge) return [];
    let running = 0;
    return data.marginBridge.map((b) => {
      const val = parseFloat(String(b.value));
      const isBase = b.component === "Last Year YTD" || b.component === "This Year YTD";
      const bar = {
        name: b.component,
        value: isBase ? val : Math.abs(val),
        base: isBase ? 0 : (val >= 0 ? running : running + val),
        fill: BRIDGE_COLORS[b.component] ?? "#3b82f6",
        isBase,
        raw: val,
      };
      if (!isBase) running += val;
      else if (b.component === "Last Year YTD") running = val;
      return bar;
    });
  }, [data]);

  const filters = [
    { key: "timePeriod", label: "Time Period", options: TIME_PERIODS, value: timePeriod, onChange: setTimePeriod },
    { key: "productFamily", label: "Product Family", options: FAMILIES, value: productFamily, onChange: setProductFamily },
    { key: "region", label: "Region", options: REGIONS, value: region, onChange: setRegion },
    { key: "channel", label: "Channel", options: CHANNELS, value: channel, onChange: setChannel },
    { key: "industry", label: "Industry", options: INDUSTRIES, value: industry, onChange: setIndustry },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <AnalyticsFilterBar filters={filters} />

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : data?.kpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Revenue" value={data.kpis.revenue} pct={data.kpis.revenuePct} icon={DollarSign} format="currency" />
          <KpiCard label="Active Quotes" value={data.kpis.activeQuotes} pct={data.kpis.activeQuotesPct} icon={FileText} format="number" />
          <KpiCard label="Win Rate" value={data.kpis.winRate} pct={data.kpis.winRatePct} icon={Target} format="percent" />
          <KpiCard label="Active Customers" value={data.kpis.activeCustomers} pct={data.kpis.activeCustomersPct} icon={Users} format="number" />
        </div>
      ) : null}

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Price Performance Chart */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Price Performance</CardTitle>
            <p className="text-xs text-muted-foreground">Price Index vs Cost Index with Value Gap</p>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={priceChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[90, 120]} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                    formatter={(val: number, name: string) => [
                      name === "Value Gap %" ? `${val.toFixed(1)}%` : val.toFixed(1),
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area yAxisId="right" type="monotone" dataKey="valueGapPct" name="Value Gap %" fill="#1e3a5f20" stroke="transparent" />
                  <Line yAxisId="left" type="monotone" dataKey="priceIndex" name="Price Index" stroke="#1e3a5f" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="costIndex" name="Cost Index" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  <Line yAxisId="right" type="monotone" dataKey="valueGapPct" name="Value Gap %" stroke="#22c55e" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Margin Analysis Waterfall */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Margin Analysis</CardTitle>
            <p className="text-xs text-muted-foreground">YTD margin bridge by component</p>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                    formatter={(val: number, name: string, props: { payload?: { raw: number; name: string } }) => {
                      const raw = props?.payload?.raw ?? val;
                      return [`$${(Math.abs(raw) / 1_000_000).toFixed(2)}M`, props?.payload?.name];
                    }}
                  />
                  {/* Invisible base bar for stacking */}
                  <Bar dataKey="base" stackId="a" fill="transparent" />
                  <Bar dataKey="value" stackId="a" shape={<WaterfallBar />} radius={[2, 2, 0, 0]}>
                    {waterfallData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
