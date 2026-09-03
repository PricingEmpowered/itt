import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import { TrendingUp, TrendingDown, Minus, Search, Plus, Building2, Users, DollarSign, BarChart3, MapPin, Tag, UserCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { ANALYTICS_INDUSTRIES as INDUSTRY_OPTIONS } from "@/lib/analyticsConstants";

// ── Filter constants derived from real customer data ──────────────────────────
const TIERS = ["All", "Enterprise", "Large", "Mid", "SMB"];
const REGIONS = ["All", "Americas", "Europe", "Asia"];
const CHANNELS = ["All", "OEM", "Distribution"];
// Derived from shared analytics constants — single source of truth
const INDUSTRIES = ["All", ...INDUSTRY_OPTIONS.filter(i => i.value !== "All Industries").map(i => i.value)];

const TIER_COLORS: Record<string, string> = {
  Enterprise: "bg-purple-100 text-purple-700",
  Large: "bg-blue-100 text-blue-700",
  Mid: "bg-teal-100 text-teal-700",
  SMB: "bg-gray-100 text-gray-600",
};

const CHANNEL_COLORS: Record<string, string> = {
  OEM: "bg-sky-100 text-sky-700",
  Distribution: "bg-amber-100 text-amber-700",
  Intercompany: "bg-gray-100 text-gray-600",
};

const TREND_ICONS: Record<string, React.ElementType> = {
  High: TrendingUp,
  Good: TrendingUp,
  Stable: Minus,
  Low: TrendingDown,
  Declining: TrendingDown,
};

const TREND_COLORS: Record<string, string> = {
  High: "text-emerald-600",
  Good: "text-emerald-500",
  Stable: "text-muted-foreground",
  Low: "text-yellow-600",
  Declining: "text-red-500",
};

export default function CustomerManagement() {
  const [, navigate] = useLocation();
  const [tier, setTier] = useState("All");
  const [region, setRegion] = useState("All");
  const [industry, setIndustry] = useState("All");
  const [channel, setChannel] = useState("All");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: customerRows = [], isLoading } = trpc.customers.list.useQuery({ tier, region, industry, search, channel });

  const filtered = customerRows;

  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("Customer removed."); },
  });

  // KPI aggregates
  const totalVolume = filtered.reduce((s, c) => s + parseFloat(c.annualVolume), 0);
  const avgPI = filtered.length ? filtered.reduce((s, c) => s + c.priceIndex, 0) / filtered.length : 0;
  const avgMI = filtered.length ? filtered.reduce((s, c) => s + c.marginIndex, 0) / filtered.length : 0;
  const oemCount = filtered.filter((c) => (c as any).channel === "OEM").length;
  const distCount = filtered.filter((c) => (c as any).channel === "Distribution").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Customer Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise accounts, pricing performance, and segment analysis
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Add Customer</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
            <AddCustomerForm onClose={() => { setAddOpen(false); utils.customers.list.invalidate(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: String(filtered.length), sub: `${oemCount} OEM · ${distCount} Distribution`, icon: Users },
          { label: "Total Annual Volume", value: `$${(totalVolume / 1e6).toFixed(1)}M`, sub: "Across all accounts", icon: DollarSign },
          { label: "Avg Price Index", value: avgPI.toFixed(2), sub: avgPI >= 1.05 ? "Above target" : avgPI >= 1.00 ? "On target" : "Below target", icon: BarChart3 },
          { label: "Avg Margin Index", value: avgMI.toFixed(2), sub: avgMI >= 0.70 ? "Healthy" : avgMI >= 0.65 ? "Acceptable" : "Needs attention", icon: TrendingUp },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</p>
                <kpi.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customers..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-36">
            <Tag className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-36">
            <MapPin className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>{REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>{TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Region / Location</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead className="text-right">Annual Volume</TableHead>
                <TableHead className="text-right">Price Index</TableHead>
                <TableHead className="text-right">Margin Index</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Preferred Family</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading customers...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No customers match the selected filters.</TableCell>
                </TableRow>
              ) : filtered.map((c) => {
                const TrendIcon = TREND_ICONS[c.trend] ?? Minus;
                const piColor = c.priceIndex >= 1.08 ? "text-emerald-600" : c.priceIndex <= 0.99 ? "text-red-500" : "text-foreground";
                const miColor = c.marginIndex >= 0.72 ? "text-emerald-600" : c.marginIndex <= 0.64 ? "text-red-500" : "text-foreground";
                const perfScore = ((c.priceIndex - 0.9) / 0.3) * 100;
                const cAny = c as any;
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailCustomer(c.id)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm leading-tight">{c.name}</p>
                          <Badge className={`text-[10px] border-0 px-1.5 py-0 mt-0.5 ${TIER_COLORS[c.tier] ?? "bg-gray-100 text-gray-600"}`}>{c.tier}</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs border-0 ${CHANNEL_COLORS[cAny.channel] ?? "bg-gray-100 text-gray-600"}`}>
                        {cAny.channel ?? "OEM"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-foreground leading-tight">{c.industry}</p>
                        {cAny.industryCode && <p className="text-[10px] text-muted-foreground font-mono">{cAny.industryCode}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{cAny.state ? `${cAny.state}, ` : ""}{cAny.country ?? c.region}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <UserCheck className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[130px]">{cAny.salesRep ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      ${(parseFloat(c.annualVolume) / 1e6).toFixed(2)}M
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${piColor}`}>
                      {c.priceIndex.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${miColor}`}>
                      {c.marginIndex.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(100, Math.max(0, perfScore))} className="w-20 h-1.5" />
                            <div className={`flex items-center gap-0.5 ${TREND_COLORS[c.trend] ?? "text-muted-foreground"}`}>
                              <TrendIcon className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">Trend: {c.trend}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{cAny.preferredFamily ?? "—"}</p>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs"
                        onClick={() => deleteMutation.mutate({ id: c.id })}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {detailCustomer !== null && (
        <CustomerDetailDialog
          customerId={detailCustomer}
          onClose={() => setDetailCustomer(null)}
          onRefresh={() => utils.customers.list.invalidate()}
        />
      )}
    </div>
  );
}

function CustomerDetailDialog({ customerId, onClose, onRefresh }: { customerId: number; onClose: () => void; onRefresh: () => void }) {
  const { data: c, isLoading } = trpc.customers.get.useQuery({ id: customerId });
  const utils = trpc.useUtils();
  const upsert = trpc.customers.upsert.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); utils.customers.get.invalidate({ id: customerId }); toast.success("Customer updated."); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !c) return null;
  const cAny = c as any;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {c.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Account Details</p>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Channel</span><Badge className={`text-xs border-0 ${CHANNEL_COLORS[cAny.channel] ?? ""}`}>{cAny.channel ?? "OEM"}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Industry</span><span className="font-medium text-right max-w-[180px]">{c.industry}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Industry Code</span><span className="font-mono text-xs">{cAny.industryCode ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Region</span><span>{c.region}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{cAny.state ? `${cAny.state}, ` : ""}{cAny.country ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sales Rep</span><span className="text-right max-w-[180px]">{cAny.salesRep ?? "—"}</span></div>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Contract</p>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className="text-xs border-0 bg-emerald-100 text-emerald-700">{cAny.contractStatus ?? "Active"}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span className="font-mono text-xs">{cAny.contractExpiry ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Preferred Family</span><span className="text-right max-w-[180px] text-xs">{cAny.preferredFamily ?? "—"}</span></div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Pricing Performance</p>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Annual Volume</span><span className="font-mono font-semibold">${(parseFloat(c.annualVolume) / 1e6).toFixed(2)}M</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price Index</span><span className={`font-mono font-semibold ${c.priceIndex >= 1.08 ? "text-emerald-600" : c.priceIndex <= 0.99 ? "text-red-500" : ""}`}>{c.priceIndex.toFixed(3)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margin Index</span><span className={`font-mono font-semibold ${c.marginIndex >= 0.72 ? "text-emerald-600" : c.marginIndex <= 0.64 ? "text-red-500" : ""}`}>{c.marginIndex.toFixed(3)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tier</span><Badge className={`text-xs border-0 ${TIER_COLORS[c.tier] ?? ""}`}>{c.tier}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Trend</span><span className={`font-medium ${TREND_COLORS[c.trend] ?? ""}`}>{c.trend}</span></div>
              </div>
            </div>
            {c.notes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Notes</p>
                <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 rounded p-2">{c.notes}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddCustomerForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: "",
    tier: "Mid" as const,
    industry: "Military Avionics",
    region: "Americas",
    annualVolume: 0,
    priceIndex: 1.05,
    marginIndex: 0.68,
    trend: "Stable" as const,
    channel: "OEM",
    country: "",
    state: "",
    salesRep: "",
    industryCode: "",
    contractStatus: "Active",
    contractExpiry: "",
    preferredFamily: "",
    notes: "",
  });
  const utils = trpc.useUtils();
  const upsert = trpc.customers.upsert.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("Customer added."); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-1.5">
        <Label>Company Name *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Lockheed Martin Corp" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CHANNELS.filter(c => c !== "All").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tier</Label>
          <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v as typeof form.tier })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["Enterprise", "Large", "Mid", "SMB"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Industry</Label>
          <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{INDUSTRIES.filter(i => i !== "All").map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Industry Code</Label>
          <Input value={form.industryCode} onChange={(e) => setForm({ ...form, industryCode: e.target.value })} placeholder="e.g. 5240" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Region</Label>
          <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{REGIONS.filter(r => r !== "All").map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="USA" />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="CA" maxLength={4} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Sales Rep</Label>
          <Input value={form.salesRep} onChange={(e) => setForm({ ...form, salesRep: e.target.value })} placeholder="e.g. HOUSE SOUTHEAST" />
        </div>
        <div className="space-y-1.5">
          <Label>Annual Volume ($)</Label>
          <Input type="number" value={form.annualVolume} onChange={(e) => setForm({ ...form, annualVolume: Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Contract Status</Label>
          <Select value={form.contractStatus} onValueChange={(v) => setForm({ ...form, contractStatus: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["Active", "Pending", "Expired", "Negotiating"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Contract Expiry</Label>
          <Input value={form.contractExpiry} onChange={(e) => setForm({ ...form, contractExpiry: e.target.value })} placeholder="2027-12-31" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Preferred Connector Family</Label>
        <Input value={form.preferredFamily} onChange={(e) => setForm({ ...form, preferredFamily: e.target.value })} placeholder="e.g. 38999/KJB" />
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Account notes..." />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" disabled={!form.name} onClick={() => upsert.mutate({
          name: form.name, tier: form.tier, industry: form.industry, region: form.region,
          annualVolume: form.annualVolume, priceIndex: form.priceIndex, marginIndex: form.marginIndex,
          trend: form.trend, notes: form.notes,
        })}>Add Customer</Button>
      </div>
    </div>
  );
}
