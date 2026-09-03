import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AnalyticsFilterBar from "@/components/AnalyticsFilterBar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Cell,
} from "recharts";
import { FileText, DollarSign, Target, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  ANALYTICS_TIME_PERIODS as TIME_PERIODS,
  ANALYTICS_REGIONS as REGIONS,
  ANALYTICS_CHANNELS as CHANNELS,
  ANALYTICS_SEGMENTS as SEGMENTS,
  ANALYTICS_INDUSTRIES as INDUSTRIES,
} from "@/lib/analyticsConstants";

const STAGE_COLORS: Record<string, string> = {
  "Technical Review": "#1e3a5f",
  "Negotiation": "#3b82f6",
  "Won": "#22c55e",
};

function KpiCard({ label, value, icon: Icon, format = "number", sub }: {
  label: string; value: number; icon: React.ElementType; format?: "currency" | "percent" | "number" | "days"; sub?: string;
}) {
  const formatted = format === "currency"
    ? `$${(value / 1_000_000).toFixed(2)}M`
    : format === "percent"
    ? `${value.toFixed(1)}%`
    : format === "days"
    ? `${Math.round(value)} days`
    : value.toLocaleString();

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{formatted}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Custom funnel bar shape — narrows each stage
function FunnelShape(props: Record<string, unknown>) {
  const { x, y, width, height, index, total } = props as { x: number; y: number; width: number; height: number; index: number; total: number };
  const maxWidth = width;
  const barWidth = maxWidth * (1 - (index / (total + 1)) * 0.35);
  const xOffset = (maxWidth - barWidth) / 2;
  return <rect x={(x as number) + xOffset} y={y} width={barWidth} height={height} rx={3} fill={(props.fill as string) ?? "#1e3a5f"} />;
}

export default function QuoteFunnel() {
  const [timePeriod, setTimePeriod] = useState("Year over Year");
  const [region, setRegion] = useState("All Regions");
  const [channel, setChannel] = useState("All Channels");
  const [segment, setSegment] = useState("All Segments");
  const [industry, setIndustry] = useState("All Industries");

  const { data, isLoading } = trpc.analytics.getQuoteFunnel.useQuery(
    { timePeriod, region, channel, segment, timeRange: "Last Year" },
    { staleTime: 30_000 }
  );

  const filters = [
    { key: "timePeriod", label: "Time Period", options: TIME_PERIODS, value: timePeriod, onChange: setTimePeriod },
    { key: "region", label: "Region", options: REGIONS, value: region, onChange: setRegion },
    { key: "channel", label: "Channel", options: CHANNELS, value: channel, onChange: setChannel },
    { key: "segment", label: "Segment", options: SEGMENTS, value: segment, onChange: setSegment },
    { key: "industry", label: "Industry", options: INDUSTRIES, value: industry, onChange: setIndustry },
  ];

  // Funnel chart — stacked bars per stage
  const funnelChartData = useMemo(() => {
    if (!data?.funnelData) return [];
    return data.funnelData.map((f, i) => ({
      ...f,
      total: f.newBusiness + f.repeatBusiness,
      index: i,
    }));
  }, [data]);

  // Conversion rates between stages
  const conversionRates = useMemo(() => {
    if (!funnelChartData.length) return [];
    return funnelChartData.slice(1).map((stage, i) => {
      const prev = funnelChartData[i];
      const rate = prev.total > 0 ? (stage.total / prev.total) * 100 : 0;
      return { from: prev.stage, to: stage.stage, rate };
    });
  }, [funnelChartData]);

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar filters={filters} />

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : data?.kpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Quotes" value={data.kpis.totalQuotes} icon={FileText} format="number" />
          <KpiCard label="Total Pipeline Value" value={data.kpis.totalValue} icon={DollarSign} format="currency" />
          <KpiCard label="Win Rate" value={data.kpis.winRate} icon={Target} format="percent" />
          <KpiCard label="Avg Cycle Time" value={data.kpis.avgCycleTime} icon={Clock} format="days" sub="from submission to close" />
        </div>
      ) : null}

      {/* Funnel + Conversion */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Funnel Chart */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Quote Funnel</CardTitle>
            <p className="text-xs text-muted-foreground">New vs Repeat business by stage</p>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnelChartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="newBusiness" name="New Business" stackId="a" fill="#1e3a5f" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="repeatBusiness" name="Repeat Business" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Conversion Rates */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Stage Conversion</CardTitle>
            <p className="text-xs text-muted-foreground">Conversion rate between stages</p>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <div className="space-y-4 pt-2">
                {funnelChartData.map((stage, i) => (
                  <div key={stage.stage} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{stage.stage}</span>
                      <span className="text-xs font-bold">{stage.total.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${funnelChartData[0]?.total ? (stage.total / funnelChartData[0].total) * 100 : 0}%`,
                          background: STAGE_COLORS[stage.stage] ?? "#1e3a5f",
                        }}
                      />
                    </div>
                    {i < conversionRates.length && (
                      <div className="text-xs text-muted-foreground text-right">
                        ↓ {conversionRates[i]?.rate.toFixed(1)}% conversion
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trends over time */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Quote Trends Over Time</CardTitle>
          <p className="text-xs text-muted-foreground">Submitted vs Won quotes by business type</p>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data?.trendsData ?? []} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v.replace("-", "/")} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }} labelFormatter={(v) => v.replace("-", "/")} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="newSubmitted" name="New Submitted" stroke="#1e3a5f" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="newWon" name="New Won" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="repeatSubmitted" name="Repeat Submitted" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="repeatWon" name="Repeat Won" stroke="#86efac" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* New vs Repeat Comparison Table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Business Segment Comparison</CardTitle>
          <p className="text-xs text-muted-foreground">New Business vs Repeat Business performance metrics</p>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : data?.segmentComparison ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metric</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Business</th>
                    <th className="text-right py-2 pl-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Repeat Business</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {[
                    { label: "Total Quotes", newVal: data.segmentComparison.newBusiness.totalQuotes.toLocaleString(), repVal: data.segmentComparison.repeatBusiness.totalQuotes.toLocaleString() },
                    { label: "Total Value", newVal: `$${(data.segmentComparison.newBusiness.totalValue / 1_000_000).toFixed(2)}M`, repVal: `$${(data.segmentComparison.repeatBusiness.totalValue / 1_000_000).toFixed(2)}M` },
                    { label: "Avg Quote Value", newVal: `$${(data.segmentComparison.newBusiness.avgValue / 1_000).toFixed(1)}K`, repVal: `$${(data.segmentComparison.repeatBusiness.avgValue / 1_000).toFixed(1)}K` },
                    { label: "Win Rate", newVal: `${data.segmentComparison.newBusiness.winRate}%`, repVal: `${data.segmentComparison.repeatBusiness.winRate}%` },
                    { label: "Avg Cycle Time", newVal: `${data.segmentComparison.newBusiness.avgCycleTime} days`, repVal: `${data.segmentComparison.repeatBusiness.avgCycleTime} days` },
                  ].map((row) => (
                    <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 text-xs font-medium text-muted-foreground">{row.label}</td>
                      <td className="py-2.5 px-4 text-xs font-semibold text-right">{row.newVal}</td>
                      <td className="py-2.5 pl-4 text-xs font-semibold text-right">{row.repVal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
