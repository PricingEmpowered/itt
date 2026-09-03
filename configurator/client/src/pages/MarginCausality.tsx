import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, TrendingDown, TrendingUp, AlertTriangle, Activity, BarChart3,
  ArrowDownRight, ArrowUpRight, Minus, Info, Zap, Star, DollarSign,
} from "lucide-react";

// ─── Signal configuration ─────────────────────────────────────────────────────
const SIGNAL_CONFIG = {
  // ── Risk signals ──
  repeat_volume_drop: {
    direction: "risk",
    label: "Repeat Volume Drop",
    icon: TrendingDown,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    cardBg: "bg-amber-50/60 border-amber-200",
    description: "Revenue from repeat customers has declined significantly. May indicate price-driven churn or competitive displacement.",
  },
  lost_business_spike: {
    direction: "risk",
    label: "Lost Business Spike",
    icon: ArrowDownRight,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700 border-red-200",
    cardBg: "bg-red-50/60 border-red-200",
    description: "Win rate has dropped sharply — quotes are being lost at a higher rate. Leading indicator of price sensitivity.",
  },
  margin_erosion: {
    direction: "risk",
    label: "Margin Erosion",
    icon: Minus,
    color: "text-slate-600",
    bg: "bg-slate-50 border-slate-200",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    cardBg: "bg-slate-50/60 border-slate-200",
    description: "Price index significantly below target — systematic under-pricing eroding gross margin.",
  },
  // ── Opportunity signals ──
  win_rate_surge: {
    direction: "opportunity",
    label: "Win Rate Surge",
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cardBg: "bg-emerald-50/60 border-emerald-200",
    description: "Win rate has surged — strong demand signal. Customers are choosing ITT at the current price; test a selective price increase.",
  },
  volume_growth: {
    direction: "opportunity",
    label: "Volume Growth",
    icon: ArrowUpRight,
    color: "text-teal-600",
    bg: "bg-teal-50 border-teal-200",
    badge: "bg-teal-100 text-teal-700 border-teal-200",
    cardBg: "bg-teal-50/60 border-teal-200",
    description: "Revenue is growing strongly. High demand momentum — evaluate whether list price can be raised to capture more value.",
  },
  price_power: {
    direction: "opportunity",
    label: "Pricing Power",
    icon: DollarSign,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    cardBg: "bg-blue-50/60 border-blue-200",
    description: "Price index above target with strong win rate — customers are paying above list. List price may be set too low; room to increase.",
  },
} as const;

const SEVERITY_CONFIG = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
};

const OPP_SEVERITY_CONFIG = {
  High: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Medium: "bg-teal-100 text-teal-700 border-teal-200",
  Low: "bg-blue-100 text-blue-600 border-blue-200",
};

type FlagData = {
  family: string;
  channel?: string;
  signal: keyof typeof SIGNAL_CONFIG;
  direction: "risk" | "opportunity";
  severity: "High" | "Medium" | "Low";
  currentValue: number;
  previousValue: number;
  changePct: number;
  description: string;
  period: string;
};

function FlagCard({ flag }: { flag: FlagData }) {
  const cfg = SIGNAL_CONFIG[flag.signal];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const isOpp = flag.direction === "opportunity";
  const sevStyle = isOpp ? OPP_SEVERITY_CONFIG[flag.severity] : SEVERITY_CONFIG[flag.severity];

  const valueDisplay = () => {
    if (flag.signal === "repeat_volume_drop" || flag.signal === "volume_growth") {
      return {
        prev: `$${(flag.previousValue / 1000).toFixed(0)}K`,
        curr: `$${(flag.currentValue / 1000).toFixed(0)}K`,
        unit: "revenue",
      };
    }
    if (flag.signal === "lost_business_spike" || flag.signal === "win_rate_surge") {
      return { prev: `${flag.previousValue.toFixed(0)}%`, curr: `${flag.currentValue.toFixed(0)}%`, unit: "win rate" };
    }
    return { prev: `${flag.previousValue.toFixed(1)}`, curr: `${flag.currentValue.toFixed(1)}`, unit: "price index" };
  };
  const vals = valueDisplay();

  return (
    <div className={`rounded-xl border p-4 ${cfg.cardBg}`}>
      <div className="flex items-start gap-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isOpp ? "bg-emerald-100" : flag.severity === "High" ? "bg-red-100" : flag.severity === "Medium" ? "bg-amber-100" : "bg-slate-100"
        }`}>
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm text-foreground">{flag.family}</span>
            {flag.channel && <Badge variant="outline" className="text-[10px]">{flag.channel}</Badge>}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${sevStyle}`}>
              {isOpp ? <Star className="w-2.5 h-2.5 mr-0.5" /> : null}
              {flag.severity} {isOpp ? "Opportunity" : "Severity"}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-foreground leading-snug">{flag.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Period: <strong className="text-foreground">{flag.period}</strong></span>
            <span>{vals.unit}: {vals.prev} → {vals.curr}</span>
            <span className={`font-semibold ${
              isOpp ? "text-emerald-600" : flag.changePct < 0 ? "text-red-600" : "text-muted-foreground"
            }`}>
              {flag.changePct > 0 ? "+" : ""}{flag.changePct.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-2xl font-bold ${
            isOpp ? "text-emerald-600" :
            flag.changePct < -20 ? "text-red-600" : flag.changePct < 0 ? "text-amber-600" : "text-muted-foreground"
          }`}>
            {flag.changePct > 0 ? "+" : ""}{flag.changePct.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">period change</div>
        </div>
      </div>
    </div>
  );
}

export default function MarginCausality() {
  const [, navigate] = useLocation();
  const { data: rawFlags = [], isLoading } = trpc.marginCausality.getFlags.useQuery();
  const flags = rawFlags as FlagData[];

  const riskFlags = flags.filter(f => f.direction === "risk");
  const oppFlags = flags.filter(f => f.direction === "opportunity");
  const highRisk = riskFlags.filter(f => f.severity === "High").length;
  const highOpp = oppFlags.filter(f => f.severity === "High").length;

  const riskSignalTypes = Array.from(new Set(riskFlags.map(f => f.signal)));
  const oppSignalTypes = Array.from(new Set(oppFlags.map(f => f.signal)));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <div className="container py-8 flex-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 flex-1">
            <Activity className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Margin Causality</h1>
          </div>
        </div>

        {/* Explainer */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 mb-6 flex gap-3">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How this works</p>
            <p className="text-xs leading-relaxed">
              Without enough historical transaction data for true price sensitivity modelling, this view uses <strong>margin causality signals</strong> as a proxy.
              It detects both <strong>risk signals</strong> (win rate drops, revenue declines, under-pricing) and <strong>growth opportunities</strong> (win rate surges, volume growth, pricing power above target index).
              Flags are generated by comparing the most recent period to the prior period for each product family and channel combination.
            </p>
          </div>
        </div>

        {/* KPI bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Flags</span>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{flags.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4 border-red-200 bg-red-50/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Risk Flags</span>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{riskFlags.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{highRisk} high severity</div>
          </div>
          <div className="rounded-xl border bg-card p-4 border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Opportunities</span>
              <Zap className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">{oppFlags.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{highOpp} high priority</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Families Flagged</span>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{Array.from(new Set(flags.map(f => f.family))).length}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />)}</div>
        ) : flags.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No margin causality flags detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Flags appear when analytics data shows win rate changes &gt;8 pts, revenue changes &gt;15%, or price index outside the 95–108 target band.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* ── Risk Flags ── */}
            {riskFlags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <h2 className="font-semibold text-foreground">Risk Signals</h2>
                  <Badge variant="outline" className="text-[10px] border-red-200 text-red-600">{riskFlags.length} flags</Badge>
                </div>
                {/* Risk signal legend */}
                {riskSignalTypes.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {riskSignalTypes.map(s => {
                      const cfg = SIGNAL_CONFIG[s as keyof typeof SIGNAL_CONFIG];
                      if (!cfg) return null;
                      const Icon = cfg.icon;
                      return (
                        <div key={s} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${cfg.bg}`}>
                          <Icon className={`w-3 h-3 ${cfg.color}`} />
                          <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-3">
                  {riskFlags.map((flag, idx) => <FlagCard key={`risk-${idx}`} flag={flag} />)}
                </div>
              </div>
            )}

            {riskFlags.length > 0 && oppFlags.length > 0 && <Separator />}

            {/* ── Opportunity Flags ── */}
            {oppFlags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <h2 className="font-semibold text-foreground">Growth Opportunities</h2>
                  <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-600">{oppFlags.length} signals</Badge>
                  <span className="text-xs text-muted-foreground ml-1">— where ITT has pricing power to increase</span>
                </div>
                {/* Opportunity signal legend */}
                {oppSignalTypes.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {oppSignalTypes.map(s => {
                      const cfg = SIGNAL_CONFIG[s as keyof typeof SIGNAL_CONFIG];
                      if (!cfg) return null;
                      const Icon = cfg.icon;
                      return (
                        <div key={s} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${cfg.bg}`}>
                          <Icon className={`w-3 h-3 ${cfg.color}`} />
                          <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-3">
                  {oppFlags.map((flag, idx) => <FlagCard key={`opp-${idx}`} flag={flag} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
