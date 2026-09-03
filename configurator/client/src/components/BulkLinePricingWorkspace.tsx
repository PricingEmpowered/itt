import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Crosshair,
  Info,
  Loader2,
  Percent,
  Shield,
  Target,
  TrendingDown,
  Trophy,
  X,
} from "lucide-react";

type Props = {
  opportunityToken: string;
  itemId: number | null;
  userName: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const money = (value: unknown) => `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: unknown) => `${Number(value ?? 0).toFixed(1)}%`;

const TIER_STYLE = {
  Aggressive: { icon: Trophy, label: "Max win rate", color: "border-emerald-200 bg-emerald-50", active: "border-emerald-500 ring-2 ring-emerald-300", ink: "text-emerald-700", bar: "bg-emerald-500" },
  Target: { icon: Crosshair, label: "Balanced", color: "border-primary/20 bg-primary/[0.045]", active: "border-primary ring-2 ring-primary/30", ink: "text-primary", bar: "bg-primary" },
  Conservative: { icon: Shield, label: "Max margin", color: "border-amber-200 bg-amber-50", active: "border-amber-500 ring-2 ring-amber-300", ink: "text-amber-700", bar: "bg-amber-500" },
} as const;

function BulkLineIntelligenceChart({ intel }: { intel: any }) {
  if (!intel) return null;
  const historicalPoints = (intel.scatterPoints ?? []).map((point: any) => ({ ...point, type: "historical" }));
  const currentPoint = intel.currentQuotePoint ? [{ ...intel.currentQuotePoint, type: "current" }] : [];
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Discount vs. volume</CardTitle><CardDescription>Historical deals for this customer segment and product family.</CardDescription></CardHeader><CardContent><div className="mb-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Won</span><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-rose-400" />Lost</span><span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full border-2 border-white bg-primary shadow" />This line</span></div><ResponsiveContainer width="100%" height={230}><ScatterChart margin={{ top: 6, right: 8, left: -14, bottom: 16 }}><CartesianGrid strokeDasharray="3 3" opacity={0.35} /><XAxis dataKey="discountPct" name="Discount" type="number" tick={{ fontSize: 10 }} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} label={{ value: "Discount from list", position: "insideBottom", offset: -9, fontSize: 10 }} /><YAxis dataKey="volume" name="Volume" type="number" tick={{ fontSize: 10 }} tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}K`} /><Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(value: number, name: string) => [name === "discountPct" ? `${value.toFixed(1)}%` : money(value), name === "discountPct" ? "Discount" : "Volume"]} /><ReferenceLine x={intel.benchmarkAvgDiscount} stroke="hsl(var(--primary))" strokeDasharray="4 2" label={{ value: "Segment avg", position: "top", fontSize: 9, fill: "hsl(var(--primary))" }} /><Scatter name="Won" data={historicalPoints.filter((point: any) => point.won)} fill="#22c55e" fillOpacity={0.65} r={4} /><Scatter name="Lost" data={historicalPoints.filter((point: any) => !point.won)} fill="#f87171" fillOpacity={0.55} r={4} /><Scatter name="This line" data={currentPoint} fill="hsl(var(--primary))" r={7} /></ScatterChart></ResponsiveContainer></CardContent></Card>;
}

export default function BulkLinePricingWorkspace({ opportunityToken, itemId, userName, onClose, onSaved }: Props) {
  const [proposedPrice, setProposedPrice] = useState("");
  const [reason, setReason] = useState("");
  const [owner, setOwner] = useState(userName);
  const [selectedLabel, setSelectedLabel] = useState("Target");
  const detailQuery = trpc.bulkOpportunities.getLineDetail.useQuery(
    { opportunityToken, itemId: itemId ?? 0 },
    { enabled: itemId !== null },
  );
  const detail = detailQuery.data;
  const item = detail?.item as any | undefined;
  const recommendation = detail?.recommendation;
  const listPrice = Number(item?.listPrice ?? recommendation?.listPrice ?? 0);
  const floorPrice = Number(item?.floorPrice ?? recommendation?.floorPrice ?? 0);
  const engineTarget = Number(item?.targetPrice ?? recommendation?.targetPrice ?? 0);
  const price = Number(proposedPrice || item?.proposedPrice || engineTarget || 0);
  const discount = listPrice > 0 ? ((listPrice - price) / listPrice) * 100 : 0;
  const belowFloor = floorPrice > 0 && price < floorPrice;
  const cost = Number(detail?.cost ?? 0);
  const liveMargin = cost > 0 && price > 0 ? ((price - cost) / price) * 100 : Number(item?.grossMarginPct ?? 0);
  const opportunity = detail?.opportunity;
  const intelligenceQuery = trpc.quoteWorkflow.getQuoteIntelligence.useQuery({
    customerTier: opportunity?.customerTier ?? "Mid",
    channel: opportunity?.quoteChannel === "Distribution" ? "Distribution" : "OEM",
    family: item?.family ?? item?.productLine ?? "All",
    avgDiscount: discount,
    totalValue: Math.max(1, price * Number(item?.quantity ?? 1)),
    dealType: "New Business",
    urgency: "Standard",
    lineCount: 1,
  }, { enabled: Boolean(detail) && price > 0 });

  const overrideMutation = trpc.bulkOpportunities.overrideTarget.useMutation({
    onSuccess: async (result) => {
      await onSaved();
      toast.success(result.belowFloor ? "Override saved and routed as an approval exception." : "Target override saved to the bulk review.");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!item) return;
    setProposedPrice(String(item.targetOverridePrice ?? item.proposedPrice ?? item.targetPrice ?? ""));
    setReason(item.targetOverrideReason ?? "");
    setOwner(item.targetOverrideOwner ?? userName);
    setSelectedLabel(item.selectedTier ? `${item.selectedTier.charAt(0).toUpperCase()}${item.selectedTier.slice(1)}` : item.targetOverridePrice ? "Custom" : "Target");
  }, [item?.id, item?.targetOverridePrice, item?.proposedPrice, item?.targetPrice, item?.targetOverrideReason, item?.targetOverrideOwner, item?.selectedTier, userName]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const pricingDelta = useMemo(() => engineTarget > 0 ? ((price - engineTarget) / engineTarget) * 100 : 0, [engineTarget, price]);

  if (itemId === null || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex min-h-0 flex-col bg-slate-50 text-foreground" role="dialog" aria-modal="true" aria-label="Bulk line pricing detail">
      <header className="flex shrink-0 items-center justify-between border-b bg-white px-5 py-4 shadow-sm md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Return to bulk review"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Bulk opportunity · line detail</p><h2 className="truncate font-mono text-lg font-bold md:text-xl">{item?.ittPartNumber || item?.requestedPartNumber || item?.sourcePartNumber || "Loading part…"}</h2></div>
          {item?.reviewStatus && <Badge variant="outline" className="hidden capitalize sm:inline-flex">{item.reviewStatus.replaceAll("_", " ")}</Badge>}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close detail workspace"><X className="h-5 w-5" /></Button>
      </header>

      {detailQuery.isLoading || !detail ? <main className="flex flex-1 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Loading one-line pricing workspace…</main> : <main className="grid min-h-0 flex-1 overflow-y-auto xl:grid-cols-[minmax(0,1.6fr)_390px] xl:overflow-hidden">
        <section className="space-y-5 p-5 md:p-8 xl:overflow-y-auto">
          <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.055] via-background to-background"><CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Description</p><p className="mt-1 text-sm font-semibold">{item?.description || "No description mapped"}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Volume</p><p className="mt-1 font-mono text-sm font-semibold">{Number(item?.quantity ?? 0).toLocaleString()} <span className="font-sans text-xs font-normal text-muted-foreground">units</span></p></div><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Cost validation</p><p className="mt-1 font-mono text-sm font-semibold">{cost > 0 ? money(cost) : "Cost needed"}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Customer context</p><p className="mt-1 text-sm font-semibold">{opportunity?.customerName} · {opportunity?.quoteChannel}</p></div></CardContent></Card>

          <Card><CardHeader className="border-b pb-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="flex items-center gap-2 text-lg"><Target className="h-5 w-5 text-primary" /> Price recommendations</CardTitle><CardDescription className="mt-1">The same three-tier decision model as a one-line quote. Select a tier to stage an override, then document and save it.</CardDescription></div><div className="text-right text-xs text-muted-foreground">List <strong className="font-mono text-foreground">{money(listPrice)}</strong><br />Floor <strong className="font-mono text-foreground">{money(floorPrice)}</strong></div></div></CardHeader><CardContent className="p-5"><div className="grid gap-3 md:grid-cols-3">{recommendation?.tiers?.map((tier: any) => { const cfg = TIER_STYLE[tier.label as keyof typeof TIER_STYLE] ?? TIER_STYLE.Target; const Icon = cfg.icon; const isSelected = selectedLabel === tier.label; return <button type="button" key={tier.label} onClick={() => { setSelectedLabel(tier.label); setProposedPrice(String(tier.price)); }} className={`rounded-xl border-2 p-4 text-left transition-all ${cfg.color} ${isSelected ? cfg.active : "hover:shadow-sm"}`}><div className={`flex items-center gap-2 text-sm font-bold ${cfg.ink}`}><Icon className="h-4 w-4" />{tier.label}</div><p className="mt-1 text-xs text-muted-foreground">{cfg.label}</p><p className="mt-4 font-mono text-2xl font-bold">{money(tier.price)}</p><div className="mt-3 flex gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" />{percent(tier.discountFromList)} off</span><span className="flex items-center gap-1"><Percent className="h-3 w-3" />{percent(tier.marginPct)} GM</span></div><div className="mt-4"><div className="mb-1 flex justify-between text-[11px]"><span className="text-muted-foreground">Win probability</span><strong className={cfg.ink}>{percent(tier.winProbability)}</strong></div><Progress value={tier.winProbability} className="h-1.5" /></div>{isSelected && <p className={`mt-3 flex items-center gap-1 text-xs font-semibold ${cfg.ink}`}><CheckCircle2 className="h-3.5 w-3.5" /> Staged for review</p>}</button>; })}</div></CardContent></Card>

          <Card className={belowFloor ? "border-rose-300" : "border-violet-200"}><CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><CircleDollarSign className="h-5 w-5 text-violet-700" /> Override the engine target</CardTitle><CardDescription>Use this for a commercial adjustment not represented by the recommended tiers. The original engine target remains visible in the audit trail.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-[190px_minmax(0,1fr)_200px]"><div><Label>Proposed price</Label><Input inputMode="decimal" className="mt-1.5 font-mono font-bold" value={proposedPrice} onChange={(event) => { setSelectedLabel("Custom"); setProposedPrice(event.target.value); }} /></div><div><Label>Commercial rationale <span className="text-rose-600">*</span></Label><Textarea className="mt-1.5 min-h-[72px]" placeholder="Why should this line differ from the calculated target?" value={reason} onChange={(event) => setReason(event.target.value)} /></div><div><Label>Override owner <span className="text-rose-600">*</span></Label><Input className="mt-1.5" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Accountable owner" /></div></div><div className="grid gap-3 rounded-lg bg-muted/55 p-3 text-xs sm:grid-cols-4"><p><span className="block text-muted-foreground">Engine target</span><strong className="font-mono text-sm">{money(engineTarget)}</strong></p><p><span className="block text-muted-foreground">Override variance</span><strong className={`font-mono text-sm ${pricingDelta < 0 ? "text-amber-700" : "text-emerald-700"}`}>{pricingDelta >= 0 ? "+" : ""}{percent(pricingDelta)}</strong></p><p><span className="block text-muted-foreground">Live gross margin</span><strong className={`font-mono text-sm ${liveMargin >= 35 ? "text-emerald-700" : "text-amber-700"}`}>{percent(liveMargin)}</strong></p><p><span className="block text-muted-foreground">Discount from list</span><strong className="font-mono text-sm">{percent(discount)}</strong></p></div>{belowFloor && <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Below the authorized floor.</strong> Saving is allowed, but the line will be marked as a documented approval exception and remains visible to every approval level.</p></div>}<div className="flex justify-end"><Button onClick={() => overrideMutation.mutate({ opportunityToken, itemId: item.id, proposedPrice: price, reason, owner })} disabled={!price || reason.trim().length < 3 || owner.trim().length < 2 || overrideMutation.isPending} className="gap-2">{overrideMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{belowFloor ? "Save as exception" : "Save target override"}</Button></div></CardContent></Card>

          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Rules and pricing rationale</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 md:grid-cols-2">{recommendation?.appliedRules?.map((rule: any) => <div key={rule.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="flex items-center gap-1.5 font-semibold"><Shield className="h-3.5 w-3.5" />{rule.name}</p><p className="mt-1 leading-5 text-amber-800">{rule.description}</p></div>)}</div>{recommendation?.rationale && <div className="rounded-lg border-l-2 border-primary bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground"><Info className="h-3.5 w-3.5" /> Engine rationale</p>{recommendation.rationale}</div>}</CardContent></Card>
        </section>

        <aside className="border-l bg-white p-5 md:p-8 xl:overflow-y-auto"><div className="sticky top-0 space-y-5"><Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-background"><CardHeader className="pb-3"><CardTitle className="text-base">Quote intelligence</CardTitle><CardDescription>Comparable evidence for this customer segment and product family.</CardDescription></CardHeader><CardContent>{intelligenceQuery.isLoading ? <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Refreshing intelligence…</div> : intelligenceQuery.data ? <><div className="flex items-end justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Win probability</p><p className="mt-1 text-3xl font-bold text-primary">{intelligenceQuery.data.overallWinProbability}%</p><Badge variant="outline" className="mt-2">{intelligenceQuery.data.winLabel}</Badge></div><div className="h-16 w-16 rounded-full border-[6px] border-primary/25 p-1"><div className="flex h-full items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{percent(discount)}</div></div></div><p className="mt-4 text-xs leading-5 text-muted-foreground">{intelligenceQuery.data.winRationale}</p></> : null}</CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Closest historical price points</CardTitle><CardDescription>Same customer segment and product family.</CardDescription></CardHeader><CardContent className="space-y-3">{intelligenceQuery.data?.peerComps.map((peer: any) => <div key={peer.label} className="border-b pb-3 last:border-0 last:pb-0"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold leading-4">{peer.label}</p><Badge variant="outline" className={peer.won ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}>{peer.won ? "Won" : "Lost"}</Badge></div><div className="mt-2 flex justify-between font-mono text-xs"><span>{percent(peer.discountPct)} off</span><span>{money(peer.volume)} volume</span><span className="text-muted-foreground">{peer.delta >= 0 ? "+" : ""}{percent(peer.delta)}</span></div></div>) ?? <p className="text-xs text-muted-foreground">Peer comparisons will appear when pricing data is loaded.</p>}</CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Bulk review context</CardTitle></CardHeader><CardContent className="space-y-2.5 text-xs"><p className="flex justify-between gap-3"><span className="text-muted-foreground">Customer</span><strong className="text-right">{opportunity?.customerName}</strong></p><p className="flex justify-between gap-3"><span className="text-muted-foreground">Channel</span><strong>{opportunity?.quoteChannel}</strong></p><p className="flex justify-between gap-3"><span className="text-muted-foreground">Target margin</span><strong>{percent(opportunity?.targetMarginPct)}</strong></p><p className="flex justify-between gap-3"><span className="text-muted-foreground">Sourcing</span><strong className="capitalize">{opportunity?.sourcingPosition?.replaceAll("_", " ")}</strong></p></CardContent></Card>
          <BulkLineIntelligenceChart intel={intelligenceQuery.data} />
        </div></aside>
      </main>}
    </div>, document.body,
  );
}
