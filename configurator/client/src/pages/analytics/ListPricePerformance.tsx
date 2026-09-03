import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AnalyticsFilterBar from "@/components/AnalyticsFilterBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Line, Cell, BarChart, Legend, ReferenceLine,
} from "recharts";

import {
  ANALYTICS_FAMILIES as FAMILIES,
  ANALYTICS_INDUSTRIES as INDUSTRIES,
  generatePeriodOptions,
} from "@/lib/analyticsConstants";

const PERIODS = generatePeriodOptions();
// Default to the most recent period (first in the list since it's newest-first)
const DEFAULT_PERIOD = PERIODS[0]?.value ?? "2026-07";

const PARETO_COLORS: Record<string, string> = { A: "#1e3a5f", B: "#3b82f6", C: "#93c5fd", D: "#dbeafe" };
const DISCOUNT_COLORS: Record<string, string> = { list_price: "#1e3a5f", standard_discount: "#3b82f6", custom_discount: "#ef4444" };
const DISCOUNT_LABELS: Record<string, string> = { list_price: "List Price", standard_discount: "Standard Discount", custom_discount: "Custom Discount" };

export default function ListPricePerformance() {
  const [productFamily, setProductFamily] = useState("All Product Families");
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [competitor, setCompetitor] = useState("Competitor A");
  const [industry, setIndustry] = useState("All Industries");

  const { data, isLoading } = trpc.analytics.getListPricePerformance.useQuery(
    { productFamily, period },
    { staleTime: 30_000 }
  );

  const filters = [
    { key: "productFamily", label: "Product Family", options: FAMILIES, value: productFamily, onChange: setProductFamily },
    { key: "period", label: "Period", options: PERIODS, value: period, onChange: setPeriod },
    { key: "industry", label: "Industry", options: INDUSTRIES, value: industry, onChange: setIndustry },
  ];

  // Scatter data for Margin vs Sales
  const marginScatterData = useMemo(() =>
    (data?.products ?? []).map(p => ({ x: p.sales / 1_000_000, y: p.marginAtListPct, name: p.partNumber, family: p.productFamily })),
    [data]
  );

  // Scatter data for Competitive Premium
  const competitiveScatterData = useMemo(() =>
    (data?.products ?? []).map(p => ({
      x: p.sales / 1_000_000,
      y: (p.competitivePremiums as Record<string, number> | null)?.[competitor] ?? 0,
      name: p.partNumber,
    })),
    [data, competitor]
  );

  // Pareto chart data (top 20 by sales)
  const paretoData = useMemo(() => {
    const sorted = [...(data?.products ?? [])].sort((a, b) => b.sales - a.sales).slice(0, 20);
    const total = sorted.reduce((s, p) => s + p.sales, 0);
    let cumulative = 0;
    return sorted.map(p => {
      cumulative += p.sales;
      return {
        name: p.partNumber.slice(-8),
        sales: p.sales / 1_000,
        cumPct: (cumulative / total) * 100,
        category: p.paretoCategory,
        fullPn: p.partNumber,
      };
    });
  }, [data]);

  // Discount trend (stacked 100% bar)
  const discountTrendData = useMemo(() => {
    const byPeriod: Record<string, Record<string, number>> = {};
    (data?.discountTrend ?? []).forEach(d => {
      if (!byPeriod[d.period]) byPeriod[d.period] = { list_price: 0, standard_discount: 0, custom_discount: 0 };
      byPeriod[d.period][d.discountType] = (byPeriod[d.period][d.discountType] ?? 0) + d.totalSales;
    });
    return Object.entries(byPeriod).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([p, v]) => {
      const total = Object.values(v).reduce((s, x) => s + x, 0);
      return {
        period: p.replace("-", "/"),
        list_price: total > 0 ? (v.list_price / total) * 100 : 0,
        standard_discount: total > 0 ? (v.standard_discount / total) * 100 : 0,
        custom_discount: total > 0 ? (v.custom_discount / total) * 100 : 0,
      };
    });
  }, [data]);

  // Discount vs Sales scatter
  const discountScatterData = useMemo(() =>
    (data?.products ?? []).map(p => ({ x: p.sales / 1_000_000, y: p.avgDiscountPct, name: p.partNumber })),
    [data]
  );

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar filters={filters} />

      {/* Category Summary */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : data?.categorySummary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["A", "B", "C", "D"] as const).map(cat => (
            <Card key={cat} className="border-border/60 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-sm" style={{ background: PARETO_COLORS[cat] }} />
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Category {cat}</span>
                </div>
                <div className="text-xl font-bold">{data.categorySummary[cat]?.count ?? 0} <span className="text-sm font-normal text-muted-foreground">parts</span></div>
                <div className="text-xs text-muted-foreground">{(data.categorySummary[cat]?.salesPct ?? 0).toFixed(1)}% of sales</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Tabbed analysis: Margin vs Sales / Competitive Cone */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">List Price Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="margin">
            <TabsList className="mb-4 h-8">
              <TabsTrigger value="margin" className="text-xs">Margin vs Sales</TabsTrigger>
              <TabsTrigger value="competitive" className="text-xs">Competitive Premium</TabsTrigger>
            </TabsList>

            <TabsContent value="margin">
              {isLoading ? <Skeleton className="h-64" /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="x" name="Sales" type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(1)}M`} label={{ value: "Sales ($M)", position: "insideBottom", offset: -2, fontSize: 10 }} />
                    <YAxis dataKey="y" name="Margin %" type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} label={{ value: "Margin at List %", angle: -90, position: "insideLeft", fontSize: 10 }} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(val: number, name: string) => [name === "y" ? `${val.toFixed(1)}%` : `$${val.toFixed(2)}M`, name === "y" ? "Margin %" : "Sales"]}
                    />
                    <Scatter data={marginScatterData} fill="#1e3a5f" fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </TabsContent>

            <TabsContent value="competitive">
              <div className="flex items-center gap-3 mb-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Competitor</label>
                <Select value={competitor} onValueChange={setCompetitor}>
                  <SelectTrigger className="h-8 w-44 text-xs border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Competitor A", "Competitor B", "Competitor C", "Competitor D"].map(c => (
                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isLoading ? <Skeleton className="h-64" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="x" name="Sales" type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(1)}M`} label={{ value: "Sales ($M)", position: "insideBottom", offset: -2, fontSize: 10 }} />
                    <YAxis dataKey="y" name="Price Premium %" type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[-20, 20]} label={{ value: "Price Premium %", angle: -90, position: "insideLeft", fontSize: 10 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(val: number, name: string) => [name === "y" ? `${val.toFixed(1)}%` : `$${val.toFixed(2)}M`, name === "y" ? "Premium %" : "Sales"]}
                    />
                    <Scatter data={competitiveScatterData} fill="#3b82f6" fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Pareto Chart */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Product Pareto Analysis</CardTitle>
          <p className="text-xs text-muted-foreground">Top 20 parts by sales — bars show individual sales, line shows cumulative %</p>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={paretoData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}K`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(val: number, name: string) => [
                    name === "cumPct" ? `${val.toFixed(1)}%` : `$${val.toFixed(0)}K`,
                    name === "cumPct" ? "Cumulative %" : "Sales",
                  ]}
                />
                <Bar yAxisId="left" dataKey="sales" name="Sales ($K)" radius={[2, 2, 0, 0]}>
                  {paretoData.map((entry, i) => (
                    <Cell key={i} fill={PARETO_COLORS[entry.category] ?? "#1e3a5f"} />
                  ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="cumPct" name="Cumulative %" stroke="#ef4444" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Discount Analysis */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sales by Discount Type */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sales by Discount Type</CardTitle>
            <p className="text-xs text-muted-foreground">100% stacked — proportion of each discount type over time</p>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={discountTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, DISCOUNT_LABELS[name] ?? name]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => DISCOUNT_LABELS[v] ?? v} />
                  <Bar dataKey="list_price" stackId="a" fill={DISCOUNT_COLORS.list_price} />
                  <Bar dataKey="standard_discount" stackId="a" fill={DISCOUNT_COLORS.standard_discount} />
                  <Bar dataKey="custom_discount" stackId="a" fill={DISCOUNT_COLORS.custom_discount} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Average Discount vs Sales */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Average Discount vs Sales</CardTitle>
            <p className="text-xs text-muted-foreground">Correlation between sales volume and average discount applied</p>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="x" name="Sales" type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(1)}M`} label={{ value: "Sales ($M)", position: "insideBottom", offset: -2, fontSize: 10 }} />
                  <YAxis dataKey="y" name="Avg Discount %" type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 32]} label={{ value: "Avg Discount %", angle: -90, position: "insideLeft", fontSize: 10 }} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(val: number, name: string) => [name === "y" ? `${val.toFixed(1)}%` : `$${val.toFixed(2)}M`, name === "y" ? "Avg Discount" : "Sales"]}
                  />
                  <Scatter data={discountScatterData} fill="#3b82f6" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
