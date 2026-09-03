import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AnalyticsFilterBar from "@/components/AnalyticsFilterBar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

import {
  ANALYTICS_FAMILIES as FAMILIES,
  ANALYTICS_REGIONS as REGIONS,
  ANALYTICS_CHANNELS as CHANNELS,
  ANALYTICS_SEGMENTS as SEGMENTS,
  ANALYTICS_INDUSTRIES as INDUSTRIES,
  generatePeriodOptions,
} from "@/lib/analyticsConstants";

const PERIODS = generatePeriodOptions();
const DEFAULT_PERIOD = PERIODS[0]?.value ?? "2026-07";

const TOTAL_COMPONENTS = new Set(["List Price", "Invoice Price", "Pocket Price"]);

function pct(part: number, total: number) {
  return total !== 0 ? ((part / total) * 100).toFixed(1) : "0.0";
}

export default function PriceWaterfall() {
  const [productFamily, setProductFamily] = useState("All Product Families");
  const [region, setRegion] = useState("All Regions");
  const [channel, setChannel] = useState("All Channels");
  const [segment, setSegment] = useState("All Segments");
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [industry, setIndustry] = useState("All Industries");

  const { data, isLoading } = trpc.analytics.getPriceWaterfall.useQuery(
    { productFamily, region, channel, segment, period },
    { staleTime: 30_000 }
  );

  const filters = [
    { key: "productFamily", label: "Product Family", options: FAMILIES, value: productFamily, onChange: setProductFamily },
    { key: "region", label: "Region", options: REGIONS, value: region, onChange: setRegion },
    { key: "channel", label: "Channel", options: CHANNELS, value: channel, onChange: setChannel },
    { key: "segment", label: "Segment", options: SEGMENTS, value: segment, onChange: setSegment },
    { key: "industry", label: "Industry", options: INDUSTRIES, value: industry, onChange: setIndustry },
    { key: "period", label: "Period", options: PERIODS, value: period, onChange: setPeriod },
  ];

  // Build waterfall chart data with running base
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const listPrice = data.find(d => d.component === "List Price")?.value ?? 0;
    let running = 0;

    return data.map((item) => {
      const isTotal = TOTAL_COMPONENTS.has(item.component);
      const val = item.value;
      const absVal = Math.abs(val);
      const isNegative = val < 0;

      let base: number;
      if (item.component === "List Price") {
        base = 0;
        running = val;
      } else if (isTotal) {
        base = 0;
      } else {
        base = isNegative ? running + val : running;
        running += val;
      }

      return {
        name: item.component,
        value: isTotal ? val : absVal,
        base: isTotal ? 0 : base,
        isTotal,
        isNegative: !isTotal && isNegative,
        raw: val,
        pctOfList: listPrice !== 0 ? ((val / listPrice) * 100).toFixed(1) : "0.0",
      };
    });
  }, [data]);

  const listPrice = data?.find(d => d.component === "List Price")?.value ?? 0;
  const invoicePrice = data?.find(d => d.component === "Invoice Price")?.value ?? 0;
  const pocketPrice = data?.find(d => d.component === "Pocket Price")?.value ?? 0;

  const invoiceDiscount = listPrice !== 0 ? ((listPrice - invoicePrice) / listPrice) * 100 : 0;
  const pocketDiscount = listPrice !== 0 ? ((listPrice - pocketPrice) / listPrice) * 100 : 0;
  const pocketMargin = pocketPrice !== 0 ? ((pocketPrice - listPrice * 0.45) / pocketPrice) * 100 : 0;

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar filters={filters} />

      {/* Summary KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">List Price</p>
              <p className="text-2xl font-bold">${(listPrice / 1_000_000).toFixed(2)}M</p>
              <p className="text-xs text-muted-foreground mt-1">Gross revenue at full list</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Invoice Price</p>
              <p className="text-2xl font-bold">${(invoicePrice / 1_000_000).toFixed(2)}M</p>
              <p className={cn("text-xs mt-1", invoiceDiscount > 15 ? "text-amber-600" : "text-muted-foreground")}>
                {invoiceDiscount.toFixed(1)}% below list
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Pocket Price</p>
              <p className="text-2xl font-bold">${(pocketPrice / 1_000_000).toFixed(2)}M</p>
              <p className={cn("text-xs mt-1", pocketDiscount > 20 ? "text-red-500" : "text-muted-foreground")}>
                {pocketDiscount.toFixed(1)}% below list
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Waterfall Chart */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Price Waterfall</CardTitle>
          <p className="text-xs text-muted-foreground">From List Price to Pocket Price — each element shows value erosion</p>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-80" /> : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  formatter={(val: number, _name: string, props: { payload?: typeof chartData[0] }) => {
                    const entry = props?.payload;
                    const raw = entry?.raw ?? val;
                    const sign = raw < 0 ? "-" : "";
                    return [`${sign}$${(Math.abs(raw) / 1_000_000).toFixed(3)}M (${entry?.pctOfList ?? "0.0"}% of list)`, entry?.name];
                  }}
                />
                {/* Invisible base for stacking */}
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="value" stackId="a" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => {
                    let fill: string;
                    if (entry.isTotal) fill = "#1e3a5f";
                    else if (entry.isNegative) fill = "#ef4444";
                    else fill = "#22c55e";
                    return <Cell key={index} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Detailed Breakdown Table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Waterfall Component Detail</CardTitle>
          <p className="text-xs text-muted-foreground">Each component's value and percentage impact on list price</p>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : data && data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Component</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value ($M)</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">% of List</th>
                    <th className="text-right py-2 pl-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.map((item) => {
                    const isTotal = TOTAL_COMPONENTS.has(item.component);
                    const isNeg = item.value < 0;
                    return (
                      <tr key={item.component} className={cn("hover:bg-muted/30 transition-colors", isTotal && "bg-muted/20 font-semibold")}>
                        <td className="py-2.5 pr-4 text-xs font-medium">{item.component}</td>
                        <td className={cn("py-2.5 px-4 text-xs text-right", isNeg && !isTotal ? "text-red-500" : "")}>
                          {isNeg ? "-" : ""}${(Math.abs(item.value) / 1_000_000).toFixed(3)}M
                        </td>
                        <td className={cn("py-2.5 px-4 text-xs text-right", isNeg && !isTotal ? "text-red-500" : "")}>
                          {isNeg ? "-" : ""}{Math.abs(parseFloat(pct(item.value, listPrice))).toFixed(1)}%
                        </td>
                        <td className="py-2.5 pl-4 text-xs text-right">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                            isTotal ? "bg-primary/10 text-primary" : isNeg ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                          )}>
                            {isTotal ? "Subtotal" : isNeg ? "Deduction" : "Addition"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">No waterfall data available for selected filters.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
