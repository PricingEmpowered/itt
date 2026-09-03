import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, Target, Shield, Zap, AlertTriangle, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell,
} from "recharts";

const SEGMENTS = ["All", "Aerospace & Defense", "Industrial", "Transportation", "Energy", "Medical", "Marine"];
const PERIODS = ["Last 12 Months", "Last 6 Months", "Last Quarter", "Year to Date"];
const COLORS = ["#1a56db", "#e74694", "#16bdca", "#9061f9", "#31c48d", "#f98080"];

const COMPETITORS = [
  { name: "Amphenol", color: "#1a56db" },
  { name: "TE Connectivity", color: "#e74694" },
  { name: "Molex", color: "#16bdca" },
  { name: "Souriau", color: "#9061f9" },
  { name: "Glenair", color: "#31c48d" },
];

const WIN_LOSS_DATA = [
  { reason: "Price", wins: 38, losses: 52 },
  { reason: "Lead Time", wins: 62, losses: 28 },
  { reason: "Quality", wins: 71, losses: 18 },
  { reason: "Technical Support", wins: 58, losses: 32 },
  { reason: "Availability", wins: 45, losses: 44 },
  { reason: "Certifications", wins: 80, losses: 12 },
];

const POSITIONING_DATA = [
  { subject: "Price Competitiveness", ITT: 72, Amphenol: 85, TE: 78, Molex: 82 },
  { subject: "Product Range", ITT: 88, Amphenol: 92, TE: 95, Molex: 80 },
  { subject: "Quality", ITT: 94, Amphenol: 88, TE: 86, Molex: 84 },
  { subject: "Lead Time", ITT: 76, Amphenol: 80, TE: 74, Molex: 82 },
  { subject: "Technical Support", ITT: 90, Amphenol: 82, TE: 80, Molex: 76 },
  { subject: "Certifications", ITT: 96, Amphenol: 90, TE: 88, Molex: 84 },
];

const RECOMMENDATIONS = [
  {
    icon: Target,
    color: "text-blue-600",
    bg: "bg-blue-50",
    title: "Price Competitiveness Gap",
    priority: "High",
    priorityColor: "bg-red-100 text-red-700",
    description: "ITT pricing is 8–12% above Amphenol and Molex in standard circular connector families. Consider targeted price adjustments for high-volume, price-sensitive segments.",
    action: "Review KPT and MS Series pricing vs. Amphenol equivalent SKUs",
  },
  {
    icon: Shield,
    color: "text-green-600",
    bg: "bg-green-50",
    title: "Certifications Advantage",
    priority: "Leverage",
    priorityColor: "bg-green-100 text-green-700",
    description: "ITT leads all competitors on certifications (MIL-SPEC, ARINC, DO-160). This is a strong differentiator in Aerospace & Defense — actively promote in proposals.",
    action: "Create certification comparison one-pager for sales team",
  },
  {
    icon: Zap,
    color: "text-purple-600",
    bg: "bg-purple-50",
    title: "Lead Time Opportunity",
    priority: "Medium",
    priorityColor: "bg-yellow-100 text-yellow-700",
    description: "Amphenol and Molex are winning 44% of competitive deals on lead time. Reducing CIR/FRCIR lead time by 2 weeks could recover ~$1.2M in annual revenue.",
    action: "Engage operations on CIR/FRCIR safety stock levels",
  },
  {
    icon: AlertTriangle,
    color: "text-orange-600",
    bg: "bg-orange-50",
    title: "Transportation Segment Pressure",
    priority: "Monitor",
    priorityColor: "bg-orange-100 text-orange-700",
    description: "Souriau has increased market share in Transportation by 3.2 points YoY, primarily in VBN/VS/VPT equivalents. Monitor pricing and product roadmap.",
    action: "Schedule competitive review for VBN/VS/VPT product line",
  },
];

export default function CompetitiveIntelligence() {
  const [segment, setSegment] = useState("All");
  const [period, setPeriod] = useState("Last 12 Months");
  const [, navigate] = useLocation();

  const { data: competitorRows = [], isLoading } = trpc.competitive.getData.useQuery({ segment, period });

  // Build market share pie data from DB rows or use defaults
  const marketShareData = COMPETITORS.map((c, i) => {
    const row = competitorRows.find((r) => r.name === c.name);
    return {
      name: c.name,
      value: row ? row.marketSharePct : [24, 28, 18, 12, 10][i] ?? 8,
      color: c.color,
    };
  });
  const ittShare = 100 - marketShareData.reduce((s, d) => s + d.value, 0);
  const allShareData = [{ name: "ITT", value: Math.max(ittShare, 8), color: "#f59e0b" }, ...marketShareData];

  // Price index comparison
  const priceIndexData = COMPETITORS.map((c, i) => {
    const row = competitorRows.find((r) => r.name === c.name);
    const fallbackPI = [92, 96, 88, 94, 90][i] ?? 95;
    const fallbackWR = [48, 52, 38, 44, 40][i] ?? 45;
    return {
      name: c.name,
      priceIndex: row ? (row.avgPrice ? parseFloat(row.avgPrice) : fallbackPI) : fallbackPI,
      winRate: row ? row.winRate : fallbackWR,
    };
  });
  priceIndexData.unshift({ name: "ITT", priceIndex: 100, winRate: 62 });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Competitive Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Market positioning and win/loss analysis vs. key competitors</p>
        </div>
        <div className="flex gap-3">
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "ITT Market Share", value: `${allShareData[0]?.value.toFixed(1)}%`, delta: "+0.8pp YoY", up: true },
          { label: "Win Rate vs. Competitors", value: "62.4%", delta: "+3.1pp YoY", up: true },
          { label: "Price Premium vs. Market", value: "+8.2%", delta: "-1.4pp YoY", up: false },
          { label: "Competitive Deals Tracked", value: "1,847", delta: "+214 YoY", up: true },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1">{kpi.value}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${kpi.up ? "text-emerald-600" : "text-red-500"}`}>
                {kpi.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpi.delta}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Market Share + Win/Loss */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Market Share by Competitor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allShareData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} ${value.toFixed(1)}%`} labelLine={false}>
                    {allShareData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Win/Loss by Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={WIN_LOSS_DATA} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend />
                  <Bar dataKey="wins" name="Win Rate" fill="#31c48d" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="losses" name="Loss Rate" fill="#f98080" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Positioning Radar + Price Index Table */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Competitive Positioning Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={POSITIONING_DATA}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="ITT" dataKey="ITT" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                  <Radar name="Amphenol" dataKey="Amphenol" stroke="#1a56db" fill="#1a56db" fillOpacity={0.1} />
                  <Radar name="TE Connectivity" dataKey="TE" stroke="#e74694" fill="#e74694" fillOpacity={0.1} />
                  <Radar name="Molex" dataKey="Molex" stroke="#16bdca" fill="#16bdca" fillOpacity={0.1} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Price Index vs. Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competitor</TableHead>
                  <TableHead className="text-right">Price Index</TableHead>
                  <TableHead className="text-right">Win Rate vs. ITT</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceIndexData.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={row.priceIndex < 100 ? "text-emerald-600" : row.priceIndex > 100 ? "text-red-500" : "text-blue-600 font-bold"}>
                        {row.priceIndex.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{row.winRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      {row.winRate > 55 ? <TrendingUp className="w-4 h-4 text-emerald-500 ml-auto" /> :
                        row.winRate < 45 ? <TrendingDown className="w-4 h-4 text-red-500 ml-auto" /> :
                          <Minus className="w-4 h-4 text-muted-foreground ml-auto" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Strategic Recommendations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Strategic Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {RECOMMENDATIONS.map((rec) => (
              <div key={rec.title} className={`rounded-lg p-4 ${rec.bg} border border-opacity-20`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${rec.color}`}>
                    <rec.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">{rec.title}</span>
                      <Badge className={`text-xs px-2 py-0 ${rec.priorityColor} border-0`}>{rec.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                    <p className="text-xs font-medium text-foreground mt-2">→ {rec.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
