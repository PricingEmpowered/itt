import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ArrowUpCircle, UserCheck, Clock, ChevronRight,
  Building2, DollarSign, AlertTriangle, ShieldCheck, Users, TrendingUp,
  FileText, RefreshCw, ArrowLeft, Package, MapPin, Phone, Mail,
  Tag, Zap, BarChart3, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-blue-500",
  2: "bg-violet-500",
  3: "bg-amber-500",
  4: "bg-orange-500",
  5: "bg-red-500",
};

const LEVEL_ICONS = [ShieldCheck, Users, TrendingUp, AlertTriangle, FileText];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:   { label: "Pending",   className: "bg-amber-100 text-amber-800 border-amber-200" },
  approved:  { label: "Approved",  className: "bg-green-100 text-green-800 border-green-200" },
  rejected:  { label: "Rejected",  className: "bg-red-100 text-red-800 border-red-200" },
  escalated: { label: "Escalated", className: "bg-violet-100 text-violet-800 border-violet-200" },
  delegated: { label: "Delegated", className: "bg-blue-100 text-blue-800 border-blue-200" },
  skipped:   { label: "Skipped",   className: "bg-gray-100 text-gray-500 border-gray-200" },
};

type QueueItem = {
  approval: {
    id: number; workflowToken: string; level: number; role: string; title: string;
    status: string; assignedTo: string | null; actedBy: string | null; actedAt: Date | null;
    comments: string | null; discountPct: number | null;
  };
  workflow: {
    id: number; workflowToken: string; customerName: string; customerTier: string | null;
    customerRegion: string | null; customerChannel: string | null; customerIndustry: string | null;
    contactName: string | null; contactEmail: string | null; contactPhone: string | null;
    dealType: string | null; urgency: string | null; targetMarginPct: number | null;
    notes: string | null; status: string; createdAt: Date;
  };
};

type ChainItem = {
  id: number; workflowToken: string; level: number; role: string; title: string;
  status: string; assignedTo: string | null; actedBy: string | null; actedAt: Date | null;
  comments: string | null; discountPct: number | null;
};

type LineItem = {
  id: number; itemType: string; partNumber: string | null; description: string | null;
  family: string | null; series: string | null; isStandardCatalog: boolean | null;
  customDescription: string | null; customBaseFamily: string | null;
  listPrice: string | null; targetPrice: string | null; floorPrice: string | null;
  quotedPrice: string | null; quantity: number; priceConfidence: string | null;
};

type QuoteDetail = {
  workflow: QueueItem["workflow"] & { customerPriceIndex?: number | null };
  items: LineItem[];
  chain: ChainItem[];
  totals: { totalList: number; totalQuoted: number; avgDiscount: number };
};

const fmt = (n: string | number | null | undefined) =>
  n == null ? "—" : `$${parseFloat(String(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(1)}%`;

export default function ApprovalQueue() {
  const [, navigate] = useLocation();
  const [levelFilter, setLevelFilter] = useState<number | undefined>(undefined);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [actorName, setActorName] = useState("Sales Manager");
  const [actionComments, setActionComments] = useState("");
  const [delegateTo, setDelegateTo] = useState("");
  const [escalateTo, setEscalateTo] = useState<number>(5);
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | "escalate" | "delegate" | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "items" | "chain">("overview");

  const utils = trpc.useUtils();

  const { data: queue, isLoading: queueLoading } = trpc.approval.getQueue.useQuery(
    { level: levelFilter },
    { refetchInterval: 15000 }
  );

  const { data: quoteDetail, isLoading: detailLoading } = trpc.approval.getQuoteDetail.useQuery(
    { workflowToken: selectedToken! },
    { enabled: !!selectedToken }
  ) as { data: QuoteDetail | null | undefined; isLoading: boolean };

  const selectedItem = queue?.find((q) => q.workflow.workflowToken === selectedToken);
  const chain = quoteDetail?.chain;
  const currentLevel = chain?.find((c) => c.status === "pending")?.level ?? null;

  const approveMutation = trpc.approval.approve.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      utils.approval.getQueue.invalidate();
      utils.approval.getQuoteDetail.invalidate({ workflowToken: selectedToken! });
      setActiveAction(null); setActionComments("");
      if (res.fullyApproved) setSelectedToken(null);
    },
    onError: () => toast.error("Approval failed"),
  });

  const rejectMutation = trpc.approval.reject.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      utils.approval.getQueue.invalidate();
      utils.approval.getQuoteDetail.invalidate({ workflowToken: selectedToken! });
      setActiveAction(null); setActionComments(""); setSelectedToken(null);
    },
    onError: () => toast.error("Rejection failed"),
  });

  const escalateMutation = trpc.approval.escalate.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      utils.approval.getQueue.invalidate();
      utils.approval.getQuoteDetail.invalidate({ workflowToken: selectedToken! });
      setActiveAction(null); setActionComments("");
    },
    onError: () => toast.error("Escalation failed"),
  });

  const delegateMutation = trpc.approval.delegate.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      utils.approval.getQueue.invalidate();
      utils.approval.getQuoteDetail.invalidate({ workflowToken: selectedToken! });
      setActiveAction(null); setDelegateTo("");
    },
    onError: () => toast.error("Delegation failed"),
  });

  const handleAction = () => {
    if (!selectedToken || !currentLevel) return;
    if (activeAction === "approve") {
      approveMutation.mutate({ workflowToken: selectedToken, level: currentLevel, actedBy: actorName, comments: actionComments || undefined });
    } else if (activeAction === "reject") {
      if (!actionComments.trim()) { toast.error("Comments required for rejection"); return; }
      rejectMutation.mutate({ workflowToken: selectedToken, level: currentLevel, actedBy: actorName, comments: actionComments });
    } else if (activeAction === "escalate") {
      if (escalateTo <= currentLevel) { toast.error("Must escalate to a higher level"); return; }
      escalateMutation.mutate({ workflowToken: selectedToken, fromLevel: currentLevel, toLevel: escalateTo, actedBy: actorName, reason: actionComments || "Escalated by approver" });
    } else if (activeAction === "delegate") {
      if (!delegateTo.trim()) { toast.error("Delegate name required"); return; }
      delegateMutation.mutate({ workflowToken: selectedToken, level: currentLevel, actedBy: actorName, delegateTo, reason: actionComments || undefined });
    }
  };

  const isMutating = approveMutation.isPending || rejectMutation.isPending || escalateMutation.isPending || delegateMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <div className="container py-8 flex-1">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Approval Queue
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review and act on quotes pending approval across all 5 authorization levels.
          </p>
        </div>

        {/* Level filter tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setLevelFilter(undefined)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
              !levelFilter ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/40 text-muted-foreground")}
          >
            All Levels
          </button>
          {[1, 2, 3, 4, 5].map((l) => {
            const labels = ["Sales Rep", "Sales Mgr", "Regional Dir", "VP Sales", "CFO"];
            return (
              <button
                key={l}
                onClick={() => setLevelFilter(l === levelFilter ? undefined : l)}
                className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border flex items-center gap-1.5",
                  levelFilter === l ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/40 text-muted-foreground")}
              >
                <span className={cn("w-2 h-2 rounded-full", LEVEL_COLORS[l])} />
                L{l} {labels[l - 1]}
              </button>
            );
          })}
          <button
            onClick={() => utils.approval.getQueue.invalidate()}
            className="ml-auto p-1.5 rounded-lg border border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
          {/* Left: Queue list */}
          <div className="space-y-3">
            {queueLoading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : !queue?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-border/60 rounded-xl bg-muted/20">
                <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
                <div className="font-semibold text-sm">Queue is clear</div>
                <div className="text-xs text-muted-foreground mt-1">No quotes pending approval{levelFilter ? ` at Level ${levelFilter}` : ""}.</div>
              </div>
            ) : (
              queue.map((item: QueueItem) => {
                const isSelected = item.workflow.workflowToken === selectedToken;
                const LevelIcon = LEVEL_ICONS[item.approval.level - 1] ?? ShieldCheck;
                return (
                  <button
                    key={item.approval.id}
                    onClick={() => { setSelectedToken(item.workflow.workflowToken); setDetailTab("overview"); setActiveAction(null); }}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all duration-150",
                      isSelected ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" : "border-border/60 hover:border-primary/30 hover:shadow-sm bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0", LEVEL_COLORS[item.approval.level])}>
                          {item.approval.level}
                        </span>
                        <span className="font-semibold text-sm truncate">{item.workflow.customerName}</span>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] flex-shrink-0", STATUS_BADGE[item.approval.status]?.className)}>
                        {STATUS_BADGE[item.approval.status]?.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><LevelIcon className="w-3 h-3" />{item.approval.title}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{item.approval.discountPct?.toFixed(1) ?? "0.0"}% avg disc.</span>
                      {item.workflow.urgency && item.workflow.urgency !== "Standard" && (
                        <Badge variant="outline" className="text-[9px] border-orange-300 text-orange-700 bg-orange-50">{item.workflow.urgency}</Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-1.5 font-mono truncate">{item.workflow.workflowToken}</div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Detail panel */}
          {selectedToken && selectedItem ? (
            <div className="space-y-4">
              {/* Tab bar */}
              <div className="flex gap-1 p-1 bg-muted/40 rounded-lg border border-border/40 w-fit">
                {(["overview", "items", "chain"] as const).map((tab) => {
                  const icons = { overview: Building2, items: Package, chain: ShieldCheck };
                  const labels = { overview: "Quote Overview", items: `Line Items (${quoteDetail?.items?.length ?? 0})`, chain: "Approval Chain" };
                  const Icon = icons[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                        detailTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              {detailLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : quoteDetail ? (
                <>
                  {/* ── Overview Tab ── */}
                  {detailTab === "overview" && (
                    <div className="space-y-4">
                      {/* Customer & deal info */}
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-primary" />
                              {quoteDetail.workflow.customerName}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              {quoteDetail.workflow.customerTier && (
                                <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
                                  {quoteDetail.workflow.customerTier}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs capitalize">
                                {quoteDetail.workflow.status}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Customer attributes */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                            {quoteDetail.workflow.customerRegion && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-xs text-muted-foreground">Region</div>
                                  <div className="font-medium">{quoteDetail.workflow.customerRegion}</div>
                                </div>
                              </div>
                            )}
                            {quoteDetail.workflow.customerChannel && (
                              <div className="flex items-start gap-2">
                                <Tag className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-xs text-muted-foreground">Channel</div>
                                  <div className="font-medium">{quoteDetail.workflow.customerChannel}</div>
                                </div>
                              </div>
                            )}
                            {quoteDetail.workflow.customerIndustry && (
                              <div className="flex items-start gap-2">
                                <BarChart3 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-xs text-muted-foreground">Industry</div>
                                  <div className="font-medium">{quoteDetail.workflow.customerIndustry}</div>
                                </div>
                              </div>
                            )}
                          </div>

                          <Separator />

                          {/* Deal attributes */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-muted-foreground mb-0.5">Deal Type</div>
                              <div className="font-medium">{quoteDetail.workflow.dealType ?? "—"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-0.5">Urgency</div>
                              <div className={cn("font-medium", quoteDetail.workflow.urgency === "Emergency" ? "text-red-600" : quoteDetail.workflow.urgency === "Expedite" ? "text-amber-600" : "")}>
                                {quoteDetail.workflow.urgency ?? "Standard"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-0.5">Target Margin</div>
                              <div className="font-medium">{quoteDetail.workflow.targetMarginPct ?? 35}%</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-0.5">Submitted</div>
                              <div className="font-medium">{new Date(quoteDetail.workflow.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>

                          {/* Contact */}
                          {(quoteDetail.workflow.contactName || quoteDetail.workflow.contactEmail) && (
                            <>
                              <Separator />
                              <div className="flex items-center gap-4 text-sm flex-wrap">
                                {quoteDetail.workflow.contactName && (
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <Users className="w-3.5 h-3.5" />
                                    {quoteDetail.workflow.contactName}
                                  </span>
                                )}
                                {quoteDetail.workflow.contactEmail && (
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <Mail className="w-3.5 h-3.5" />
                                    {quoteDetail.workflow.contactEmail}
                                  </span>
                                )}
                                {quoteDetail.workflow.contactPhone && (
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <Phone className="w-3.5 h-3.5" />
                                    {quoteDetail.workflow.contactPhone}
                                  </span>
                                )}
                              </div>
                            </>
                          )}

                          {quoteDetail.workflow.notes && (
                            <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground border border-border/30">
                              {quoteDetail.workflow.notes}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Pricing summary */}
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-primary" />
                            Pricing Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-4">
                            <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/30">
                              <div className="text-xs text-muted-foreground mb-1">Total List Value</div>
                              <div className="text-lg font-bold text-foreground">{fmt(quoteDetail.totals.totalList)}</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                              <div className="text-xs text-muted-foreground mb-1">Total Quoted</div>
                              <div className="text-lg font-bold text-primary">{fmt(quoteDetail.totals.totalQuoted)}</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-200">
                              <div className="text-xs text-muted-foreground mb-1">Avg Discount</div>
                              <div className="text-lg font-bold text-amber-700">{pct(quoteDetail.totals.avgDiscount)}</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
                              <div className="text-xs text-muted-foreground mb-1">Target Margin</div>
                              <div className="text-lg font-bold text-green-700">{quoteDetail.workflow.targetMarginPct ?? 35}%</div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-muted-foreground text-center">
                            {quoteDetail.items.length} line item{quoteDetail.items.length !== 1 ? "s" : ""} across {new Set(quoteDetail.items.map(i => i.family).filter(Boolean)).size} product famil{new Set(quoteDetail.items.map(i => i.family).filter(Boolean)).size !== 1 ? "ies" : "y"}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* ── Line Items Tab ── */}
                  {detailTab === "items" && (
                    <Card className="border-border/60 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Package className="w-4 h-4 text-primary" />
                          Line Items — {quoteDetail.items.length} item{quoteDetail.items.length !== 1 ? "s" : ""}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {quoteDetail.items.length === 0 ? (
                          <div className="py-12 text-center text-sm text-muted-foreground">No line items found for this quote.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/40 bg-muted/30">
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Part / Description</th>
                                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Family</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">List Price</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quoted</th>
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disc %</th>
                                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {quoteDetail.items.map((item, idx) => {
                                  const list = parseFloat(String(item.listPrice ?? 0));
                                  const quoted = parseFloat(String(item.quotedPrice ?? 0));
                                  const qty = item.quantity ?? 1;
                                  const disc = list > 0 ? ((list - quoted) / list) * 100 : 0;
                                  const lineTotal = quoted * qty;
                                  const isCustom = item.itemType === "custom";
                                  const isConfigured = item.itemType === "configured";
                                  return (
                                    <tr key={item.id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", idx % 2 === 0 ? "" : "bg-muted/10")}>
                                      <td className="px-4 py-3">
                                        <div className="flex items-start gap-2">
                                          <div>
                                            <div className="font-mono text-xs font-semibold text-foreground flex items-center gap-1.5">
                                              {item.partNumber ?? item.customDescription?.slice(0, 30) ?? "—"}
                                              {isCustom && <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700 bg-amber-50 ml-1">Custom</Badge>}
                                              {isConfigured && <Badge variant="outline" className="text-[9px] border-violet-300 text-violet-700 bg-violet-50 ml-1">Configured</Badge>}
                                              {item.isStandardCatalog && <Badge variant="outline" className="text-[9px] border-green-300 text-green-700 bg-green-50 ml-1">Catalog</Badge>}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5 max-w-[220px] truncate">
                                              {item.description ?? item.customDescription ?? "—"}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-3">
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                                          {item.family ?? item.customBaseFamily ?? "—"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-right font-medium">{qty.toLocaleString()}</td>
                                      <td className="px-3 py-3 text-right text-muted-foreground font-mono text-xs">{fmt(item.listPrice)}</td>
                                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-primary">{fmt(item.quotedPrice)}</td>
                                      <td className="px-3 py-3 text-right">
                                        <span className={cn("text-xs font-semibold", disc > 20 ? "text-red-600" : disc > 10 ? "text-amber-600" : "text-green-600")}>
                                          {disc.toFixed(1)}%
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right font-mono text-xs font-bold">{fmt(lineTotal)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-border/60 bg-muted/30">
                                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-muted-foreground">TOTALS</td>
                                  <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground">{fmt(quoteDetail.totals.totalList)}</td>
                                  <td className="px-3 py-3 text-right font-mono text-xs font-bold text-primary">{fmt(quoteDetail.totals.totalQuoted)}</td>
                                  <td className="px-3 py-3 text-right">
                                    <span className="text-xs font-bold text-amber-700">{pct(quoteDetail.totals.avgDiscount)}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-xs font-bold">{fmt(quoteDetail.totals.totalQuoted)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* ── Approval Chain Tab ── */}
                  {detailTab === "chain" && (
                    <Card className="border-border/60 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                          Approval Chain
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {(chain as ChainItem[] | undefined)?.map((step, idx) => {
                            const LevelIcon = LEVEL_ICONS[step.level - 1] ?? ShieldCheck;
                            const isActive = step.status === "pending";
                            const isApproved = step.status === "approved";
                            const isRejected = step.status === "rejected";
                            const isSkipped = step.status === "skipped";
                            return (
                              <div key={step.id} className={cn(
                                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                                isActive ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/20"
                              )}>
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
                                  isApproved ? "bg-green-500" : isRejected ? "bg-red-500" : isSkipped ? "bg-gray-300" : isActive ? LEVEL_COLORS[step.level] : "bg-gray-200"
                                )}>
                                  {isApproved ? <CheckCircle2 className="w-4 h-4" /> : isRejected ? <XCircle className="w-4 h-4" /> : step.level}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-medium text-sm flex items-center gap-1.5">
                                      <LevelIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                      {step.title}
                                    </div>
                                    <Badge variant="outline" className={cn("text-[10px] flex-shrink-0", STATUS_BADGE[step.status]?.className)}>
                                      {STATUS_BADGE[step.status]?.label}
                                    </Badge>
                                  </div>
                                  {step.assignedTo && !step.actedBy && (
                                    <div className="text-xs text-muted-foreground mt-0.5">Assigned to: {step.assignedTo}</div>
                                  )}
                                  {step.actedBy && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {step.actedBy} · {step.actedAt ? new Date(step.actedAt).toLocaleDateString() : ""}
                                    </div>
                                  )}
                                  {step.comments && (
                                    <div className="text-xs text-muted-foreground/70 mt-1 italic">{step.comments}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : null}

              {/* Action panel — always visible when a token is selected */}
              {currentLevel && (
                <Card className="border-primary/30 shadow-sm bg-primary/[0.02]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Action Required — Level {currentLevel}: {chain?.find((c: ChainItem) => c.level === currentLevel)?.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Acting As</label>
                      <Input
                        value={actorName}
                        onChange={(e) => setActorName(e.target.value)}
                        placeholder="Your name / role"
                        className="border-border/60 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["approve", "reject", "escalate", "delegate"] as const).map((action) => {
                        const icons = { approve: CheckCircle2, reject: XCircle, escalate: ArrowUpCircle, delegate: UserCheck };
                        const colors = { approve: "border-green-300 text-green-700 hover:bg-green-50", reject: "border-red-300 text-red-700 hover:bg-red-50", escalate: "border-violet-300 text-violet-700 hover:bg-violet-50", delegate: "border-blue-300 text-blue-700 hover:bg-blue-50" };
                        const activeColors = { approve: "bg-green-500 text-white border-green-500", reject: "bg-red-500 text-white border-red-500", escalate: "bg-violet-500 text-white border-violet-500", delegate: "bg-blue-500 text-white border-blue-500" };
                        const Icon = icons[action];
                        return (
                          <button
                            key={action}
                            onClick={() => setActiveAction(activeAction === action ? null : action)}
                            className={cn(
                              "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all capitalize",
                              activeAction === action ? activeColors[action] : colors[action]
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {action}
                          </button>
                        );
                      })}
                    </div>
                    {activeAction && (
                      <div className="space-y-3 pt-1">
                        {activeAction === "escalate" && (
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Escalate To Level</label>
                            <Select value={String(escalateTo)} onValueChange={(v) => setEscalateTo(Number(v))}>
                              <SelectTrigger className="border-border/60 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[2, 3, 4, 5].filter((l) => l > currentLevel).map((l) => {
                                  const labels = ["", "Sales Rep", "Sales Manager", "Regional Director", "VP Sales", "CFO/Executive"];
                                  return <SelectItem key={l} value={String(l)}>Level {l} — {labels[l]}</SelectItem>;
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {activeAction === "delegate" && (
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Delegate To</label>
                            <Input
                              value={delegateTo}
                              onChange={(e) => setDelegateTo(e.target.value)}
                              placeholder="Name of delegate approver"
                              className="border-border/60 text-sm"
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                            Comments {activeAction === "reject" ? "(required)" : "(optional)"}
                          </label>
                          <Textarea
                            value={actionComments}
                            onChange={(e) => setActionComments(e.target.value)}
                            placeholder={
                              activeAction === "approve" ? "Optional approval notes…" :
                              activeAction === "reject" ? "Reason for rejection (required)…" :
                              activeAction === "escalate" ? "Reason for escalation…" :
                              "Reason for delegation…"
                            }
                            rows={3}
                            className="border-border/60 text-sm resize-none"
                          />
                        </div>
                        <Button
                          onClick={handleAction}
                          disabled={isMutating}
                          className={cn(
                            "w-full gap-2",
                            activeAction === "approve" ? "bg-green-600 hover:bg-green-700" :
                            activeAction === "reject" ? "bg-red-600 hover:bg-red-700" :
                            activeAction === "escalate" ? "bg-violet-600 hover:bg-violet-700" :
                            "bg-blue-600 hover:bg-blue-700"
                          )}
                        >
                          {isMutating ? "Processing…" : `Confirm ${activeAction.charAt(0).toUpperCase() + activeAction.slice(1)}`}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Fully approved state */}
              {!currentLevel && chain?.every((c: ChainItem) => c.status === "approved" || c.status === "skipped") && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-green-300 bg-green-50 text-green-800">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Fully Approved</div>
                    <div className="text-xs mt-0.5">This quote has passed all required approval levels and is ready to send to the customer.</div>
                  </div>
                </div>
              )}

              {/* Rejected state */}
              {chain?.some((c: ChainItem) => c.status === "rejected") && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-red-300 bg-red-50 text-red-800">
                  <XCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Quote Rejected</div>
                    <div className="text-xs mt-0.5">
                      Rejected at Level {chain.find((c: ChainItem) => c.status === "rejected")?.level} by {chain.find((c: ChainItem) => c.status === "rejected")?.actedBy}.
                      Quote has been returned to draft for revision.
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center border border-border/60 rounded-xl bg-muted/10">
              <ShieldCheck className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <div className="font-semibold text-sm text-muted-foreground">Select a quote from the queue</div>
              <div className="text-xs text-muted-foreground/60 mt-1">Click a pending quote on the left to view its full details and take action.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
