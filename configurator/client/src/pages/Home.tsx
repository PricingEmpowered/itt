import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, ShieldCheck, BarChart3, LayoutDashboard,
  ArrowRight, Plus, Clock, CheckCircle2, AlertTriangle,
  TrendingUp, Users, Package, ChevronRight, LogIn, Bolt, Calendar, AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Workflow card definitions ────────────────────────────────────────────────
type WorkflowCard = {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeKey?: "pendingApprovals" | "openQuotes" | "pendingApprovalQuotes";
  badgeLabel?: string;
  badgeVariant?: "urgent" | "info" | "success" | "neutral";
  secondaryPath?: string;
  secondaryLabel?: string;
};

const WORKFLOW_CARDS: WorkflowCard[] = [
  {
    id: "quote",
    icon: FileText,
    title: "Create a Quote",
    description: "Start a new pricing quote — select a customer, add line items (existing catalog, configured, or custom), and receive three-tier price recommendations with win probabilities.",
    ctaLabel: "New Quote",
    ctaPath: "/quote-workflow",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    badgeKey: "openQuotes",
    badgeLabel: "open drafts",
    badgeVariant: "info",
    secondaryPath: "/quote-management",
    secondaryLabel: "View all quotes",
  },
  {
    id: "bulk-opportunity",
    icon: FileText,
    title: "Bulk Opportunity",
    description: "Import a multi-line SPA or product opportunity, apply governed target prices in bulk, and isolate only the lines that need a commercial exception.",
    ctaLabel: "Import SPA",
    ctaPath: "/bulk-opportunities",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    badgeVariant: "neutral",
    secondaryPath: "/quote-management",
    secondaryLabel: "Quote management",
  },
  {
    id: "approve",
    icon: ShieldCheck,
    title: "Approve Quotes",
    description: "Review quotes pending your authorization. The 5-level approval chain routes each quote to the right approver based on discount depth — from Sales Rep to CFO.",
    ctaLabel: "Open Approval Queue",
    ctaPath: "/approval-queue",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    badgeKey: "pendingApprovals",
    badgeLabel: "pending your action",
    badgeVariant: "urgent",
    secondaryPath: "/quote-management",
    secondaryLabel: "Quote management",
  },
  {
    id: "analyze",
    icon: BarChart3,
    title: "Pricing Analytics",
    description: "Explore revenue performance, margin bridge analysis, list price effectiveness, quote funnel conversion, and price waterfall breakdowns across families, regions, and channels.",
    ctaLabel: "Open Analytics",
    ctaPath: "/analytics",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    badgeVariant: "neutral",
    secondaryPath: "/competitive-intelligence",
    secondaryLabel: "Competitive intelligence",
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Business Dashboard",
    description: "Monitor overall pricing health — KPIs, win rates, average discounts, margin trends, and competitive positioning — all in one place.",
    ctaLabel: "View Dashboard",
    ctaPath: "/analytics",
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    badgeVariant: "neutral",
    secondaryPath: "/price-list-management",
    secondaryLabel: "Price list management",
  },

];

// ─── Badge variant styles ─────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
  success: "bg-green-100 text-green-700 border-green-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

// ─── Sign-in screen ───────────────────────────────────────────────────────────
function SignInScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <Bolt className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-xl leading-tight">ITT Connectors</div>
            <div className="text-slate-400 text-xs tracking-widest uppercase">Smart Pricing Engine</div>
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-2 text-center">Welcome back</h1>
          <p className="text-slate-400 text-sm text-center mb-8">
            Sign in to access pricing workflows, approval routing, and commercial performance insights.
          </p>

          <Button
            className="w-full h-12 text-base font-semibold gap-2 bg-primary hover:bg-primary/90"
            onClick={() => (window.location.href = getLoginUrl())}
          >
            <LogIn className="w-5 h-5" />
            Sign in with Manus
          </Button>

          <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-white/10">
            {[
              { icon: FileText, label: "Quote Workflow" },
              { icon: ShieldCheck, label: "5-Level Approval" },
              { icon: BarChart3, label: "Pricing Analytics" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-slate-300" />
                </div>
                <span className="text-[11px] text-slate-400 leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-500 text-xs mt-6">
          ITT Connectors · Smart Target Pricing Engine · Internal Tool
        </p>
      </div>
    </div>
  );
}

// ─── Main landing dashboard ───────────────────────────────────────────────────
export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: counts, isLoading: countsLoading } = trpc.dashboard.getCounts.useQuery(undefined, {
    refetchInterval: 30000,
    enabled: !!user,
  });

  const { data: expiringQuotes } = trpc.quoteExpiry.getExpiring.useQuery(
    { withinDays: 10 },
    { enabled: !!user, refetchInterval: 60000 }
  );

  // Show sign-in screen for unauthenticated users
  if (!authLoading && !user) {
    return <SignInScreen />;
  }

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  function getCount(key?: WorkflowCard["badgeKey"]): number | null {
    if (!key || !counts) return null;
    return counts[key] as number;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />

      <div className="container py-8 flex-1">
        {/* Greeting header */}
        <div className="mb-8">
          {authLoading ? (
            <Skeleton className="h-8 w-64 mb-2" />
          ) : (
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">{dateStr} · What would you like to do today?</p>
              </div>
              {/* Quick action strip */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  onClick={() => navigate("/quote-workflow")}
                >
                  <Plus className="w-4 h-4" /> New Quote
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50"
                  onClick={() => navigate("/approval-queue")}
                >
                  <ShieldCheck className="w-4 h-4" />
                  My Approvals
                  {counts && counts.pendingApprovals > 0 && (
                    <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-red-500 text-white border-0">
                      {counts.pendingApprovals}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        {!countsLoading && counts && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {[
              { label: "Open Quotes", value: counts.openQuotes, icon: FileText, color: "text-blue-600" },
              { label: "Pending Approval", value: counts.pendingApprovals, icon: AlertTriangle, color: counts.pendingApprovals > 0 ? "text-red-600" : "text-slate-400" },
              { label: "Approved Quotes", value: counts.approvedQuotes, icon: CheckCircle2, color: "text-emerald-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card shadow-sm">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-muted/60", color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className={cn("text-lg font-bold leading-tight", color)}>{value}</div>
                  <div className="text-[11px] text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {countsLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        )}

        {/* Workflow cards */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Choose your workflow</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WORKFLOW_CARDS.map((card) => {
            const Icon = card.icon;
            const count = getCount(card.badgeKey);
            const showBadge = count !== null;

            return (
              <div
                key={card.id}
                className={cn(
                  "group relative flex flex-col rounded-2xl border p-5 bg-card shadow-sm transition-all duration-200",
                  "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
                  card.borderColor
                )}
                onClick={() => navigate(card.ctaPath)}
              >
                {/* Icon + badge row */}
                <div className="flex items-start justify-between mb-4">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", card.bgColor)}>
                    <Icon className={cn("w-5 h-5", card.color)} />
                  </div>
                  {showBadge && (
                    countsLoading ? (
                      <Skeleton className="h-5 w-16 rounded-full" />
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold border px-2 py-0.5",
                          count && count > 0 && card.badgeVariant === "urgent"
                            ? BADGE_STYLES.urgent
                            : BADGE_STYLES[card.badgeVariant ?? "neutral"]
                        )}
                      >
                        {count} {card.badgeLabel}
                      </Badge>
                    )
                  )}
                </div>

                {/* Title + description */}
                <h3 className="font-semibold text-foreground mb-1.5">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-4">
                  {card.description}
                </p>

                {/* CTA */}
                <div className="flex items-center justify-between mt-auto">
                  <Button
                    size="sm"
                    className={cn(
                      "gap-1.5 font-medium transition-all",
                      card.id === "quote"
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-transparent border border-current hover:bg-current/10",
                      card.id !== "quote" && card.color
                    )}
                    onClick={(e) => { e.stopPropagation(); navigate(card.ctaPath); }}
                  >
                    {card.id === "quote" && <Plus className="w-3.5 h-3.5" />}
                    {card.ctaLabel}
                    <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                  {card.secondaryPath && (
                    <button
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
                      onClick={(e) => { e.stopPropagation(); navigate(card.secondaryPath!); }}
                    >
                      {card.secondaryLabel}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expiring Quotes Queue */}
        {expiringQuotes && expiringQuotes.length > 0 && (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertOctagon className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Expiring Quotes</h3>
                  <p className="text-xs text-muted-foreground">{expiringQuotes.length} quote{expiringQuotes.length !== 1 ? 's' : ''} expiring within 10 days</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/quote-management")}
                className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 font-medium"
              >
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {expiringQuotes.slice(0, 5).map((q) => {
                const expDate = q.expirationDate ? new Date(q.expirationDate) : null;
                const daysLeft = expDate ? Math.ceil((expDate.getTime() - Date.now()) / 86400000) : null;
                const isUrgent = daysLeft !== null && daysLeft <= 3;
                return (
                  <div
                    key={q.workflowToken}
                    className={`flex items-center justify-between rounded-lg border px-4 py-2.5 bg-white cursor-pointer hover:border-amber-300 transition-colors ${
                      isUrgent ? "border-red-200" : "border-amber-100"
                    }`}
                    onClick={() => navigate("/quote-management")}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className={`w-4 h-4 shrink-0 ${isUrgent ? "text-red-500" : "text-amber-500"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{q.customerName}</p>
                        <p className="text-xs text-muted-foreground">{q.dealType} · {q.customerChannel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className={`text-xs font-semibold ${isUrgent ? "text-red-600" : "text-amber-700"}`}>
                          {daysLeft === 0 ? "Expires today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {expDate?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        isUrgent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {q.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom nav shortcuts */}
        <div className="mt-8 pt-6 border-t border-border/40">
          <p className="text-xs text-muted-foreground mb-3 font-medium">Management tools</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Customer Management", path: "/customer-management", icon: Users },
              { label: "Product Management", path: "/product-management", icon: Package },
              { label: "Price Lists", path: "/price-list-management", icon: TrendingUp },
              { label: "Quote Management", path: "/quote-management", icon: FileText },
              { label: "Competitive Intelligence", path: "/competitive-intelligence", icon: BarChart3 },
            ].map(({ label, path, icon: Icon }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent/40 transition-all"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
