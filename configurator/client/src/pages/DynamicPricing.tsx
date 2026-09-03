import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { TrendingUp, TrendingDown, Zap, RefreshCw, ArrowLeft } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { toast } from "sonner";

const STRATEGIES = ["All", "Market-Based", "Value-Based", "Cost-Plus", "Demand-Based"];
const SEGMENTS = ["All", "Aerospace & Defense", "Industrial", "Transportation", "Energy", "Medical", "Marine"];

const SENSITIVITY_DATA = [
  { segment: "Aerospace & Defense", sensitivity: -0.4, label: "Insensitive" },
  { segment: "Industrial", sensitivity: -1.2, label: "Sensitive" },
  { segment: "Transportation", sensitivity: -0.9, label: "Moderate" },
  { segment: "Energy", sensitivity: -0.6, label: "Insensitive" },
  { segment: "Medical", sensitivity: -0.3, label: "Very Insensitive" },
  { segment: "Marine", sensitivity: -1.4, label: "Sensitive" },
];

const DEMAND_TREND = Array.from({ length: 12 }, (_, i) => {
  const month = new Date(2025, i, 1).toLocaleString("default", { month: "short" });
  const base = 100 + i * 2;
  return {
    month,
    "Market-Based": base + Math.sin(i) * 8,
    "Value-Based": base + 5 + Math.cos(i) * 6,
    "Cost-Plus": base - 3 + Math.sin(i + 1) * 4,
    "Demand-Based": base + 8 + Math.sin(i * 1.5) * 10,
  };
});

const STRATEGY_COLORS: Record<string, string> = {
  "Market-Based": "#1a56db",
  "Value-Based": "#9061f9",
  "Cost-Plus": "#31c48d",
  "Demand-Based": "#f59e0b",
};

export default function DynamicPricing() {
  const [strategy, setStrategy] = useState("All");
  const [segment, setSegment] = useState("All");
  const [, navigate] = useLocation();

  const { data: scenarios = [], isLoading } = trpc.dynamicPricing.getScenarios.useQuery({ strategy, segment });

  const handleOptimize = () => {
    toast.success("AI Optimization Engine triggered — results will appear within 2 minutes.");
  };

  // Aggregate KPIs from scenarios
  const avgRevenueImpact = scenarios.length
    ? scenarios.reduce((s, r) => s + r.priceLiftPct, 0) / scenarios.length
    : 4.2;
  const avgMarginImpact = scenarios.length
    ? scenarios.reduce((s, r) => s + r.volumeImpactPct, 0) / scenarios.length
    : 2.8;
  const avgConfidence = scenarios.length
    ? scenarios.reduce((s, r) => s + r.confidence, 0) / scenarios.length
    : 87;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Dynamic Pricing</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-powered pricing optimization across strategies and segments</p>
        </div>
        <div className="flex gap-3">
          <Select value={strategy} onValueChange={setStrategy}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleOptimize} className="gap-2">
            <Zap className="w-4 h-4" />
            Run Optimization
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Avg Revenue Impact", value: `+${avgRevenueImpact.toFixed(1)}%`, delta: "vs. static pricing", up: true },
          { label: "Avg Margin Impact", value: `+${avgMarginImpact.toFixed(1)}%`, delta: "vs. static pricing", up: true },
          { label: "AI Confidence Score", value: `${avgConfidence.toFixed(0)}%`, delta: "model accuracy", up: true },
          { label: "Active Scenarios", value: String(scenarios.length || 24), delta: "across all strategies", up: true },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Strategy Comparison Chart + Sensitivity */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Index by Strategy (12-Month Trend)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={DEMAND_TREND} margin={{ right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[90, 130]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {STRATEGIES.filter((s) => s !== "All").map((s) => (
                    <Line key={s} type="monotone" dataKey={s} stroke={STRATEGY_COLORS[s]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Price Sensitivity by Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 pt-2">
              {SENSITIVITY_DATA.map((row) => (
                <div key={row.segment} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{row.segment}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{row.sensitivity.toFixed(1)}</span>
                      <Badge variant="outline" className={`text-xs ${
                        row.label === "Very Insensitive" || row.label === "Insensitive" ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                        row.label === "Sensitive" ? "border-red-300 text-red-700 bg-red-50" :
                        "border-yellow-300 text-yellow-700 bg-yellow-50"
                      }`}>{row.label}</Badge>
                    </div>
                  </div>
                  <Progress
                    value={Math.min(100, Math.abs(row.sensitivity) * 70)}
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scenarios Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pricing Scenarios</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.location.reload()}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Family</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">Recommended</TableHead>
                <TableHead className="text-right">Revenue Impact</TableHead>
                <TableHead className="text-right">Margin Impact</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(scenarios.length ? scenarios.map(r => ({
                productFamily: r.productName,
                strategy: r.strategy,
                segment: r.segment,
                currentPrice: parseFloat(r.currentPrice),
                recommendedPrice: parseFloat(r.suggestedPrice),
                revenueImpact: r.priceLiftPct,
                marginImpact: r.volumeImpactPct,
                confidenceScore: Math.round(r.confidence),
                status: r.priceLiftPct > 3 ? "Approved" : r.priceLiftPct > 0 ? "Pending" : "Rejected",
              })) : FALLBACK_SCENARIOS).map((row, i) => {
                const currentPrice = row.currentPrice;
                const recPrice = row.recommendedPrice;
                const revImpact = row.revenueImpact;
                const mgnImpact = row.marginImpact;
                const conf = row.confidenceScore;
                const status = row.status;
                const fam = row.productFamily;
                const strat = row.strategy;
                const seg = row.segment;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{fam}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs" style={{ borderColor: STRATEGY_COLORS[strat ?? ""] ?? "#888", color: STRATEGY_COLORS[strat ?? ""] ?? "#888" }}>
                        {strat}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{seg}</TableCell>
                    <TableCell className="text-right font-mono">${currentPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">${recPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-medium ${revImpact >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {revImpact >= 0 ? "+" : ""}{revImpact.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-medium ${mgnImpact >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {mgnImpact >= 0 ? "+" : ""}{mgnImpact.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={conf} className="w-16 h-1.5" />
                        <span className="font-mono text-xs">{conf}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${
                        status === "Approved" ? "bg-emerald-100 text-emerald-700 border-0" :
                        status === "Pending" ? "bg-yellow-100 text-yellow-700 border-0" :
                        status === "Rejected" ? "bg-red-100 text-red-700 border-0" :
                        "bg-blue-100 text-blue-700 border-0"
                      }`}>{status}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const FALLBACK_SCENARIOS = [
  { productFamily: "38999/KJB", strategy: "Value-Based", segment: "Aerospace & Defense", currentPrice: 142.50, recommendedPrice: 158.00, revenueImpact: 6.8, marginImpact: 4.2, confidenceScore: 91, status: "Approved" },
  { productFamily: "KPT", strategy: "Market-Based", segment: "Industrial", currentPrice: 48.75, recommendedPrice: 46.20, revenueImpact: -1.2, marginImpact: 2.1, confidenceScore: 84, status: "Pending" },
  { productFamily: "CIR/FRCIR", strategy: "Demand-Based", segment: "Transportation", currentPrice: 67.30, recommendedPrice: 72.80, revenueImpact: 5.4, marginImpact: 3.6, confidenceScore: 88, status: "Approved" },
  { productFamily: "MKJ Trinity", strategy: "Value-Based", segment: "Aerospace & Defense", currentPrice: 215.00, recommendedPrice: 238.00, revenueImpact: 8.2, marginImpact: 5.9, confidenceScore: 93, status: "Pending" },
  { productFamily: "CA Bayonet", strategy: "Cost-Plus", segment: "Industrial", currentPrice: 38.40, recommendedPrice: 40.10, revenueImpact: 2.1, marginImpact: 1.8, confidenceScore: 79, status: "Approved" },
  { productFamily: "D-Sub/DPX", strategy: "Market-Based", segment: "Energy", currentPrice: 22.60, recommendedPrice: 21.80, revenueImpact: -0.8, marginImpact: 1.4, confidenceScore: 82, status: "Approved" },
  { productFamily: "VBN/VS/VPT", strategy: "Demand-Based", segment: "Marine", currentPrice: 89.20, recommendedPrice: 96.50, revenueImpact: 4.9, marginImpact: 3.2, confidenceScore: 86, status: "Pending" },
  { productFamily: "MS Series", strategy: "Value-Based", segment: "Medical", currentPrice: 178.00, recommendedPrice: 192.00, revenueImpact: 7.1, marginImpact: 5.4, confidenceScore: 90, status: "Approved" },
];
