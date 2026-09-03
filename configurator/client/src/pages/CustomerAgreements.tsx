import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Search, FileText, Calendar, CheckCircle2,
  AlertCircle, Clock, XCircle, Edit2, Trash2, RefreshCw, Shield,
  ChevronDown, ChevronUp, Building2,
} from "lucide-react";

const FAMILIES = ["KJB", "KPT", "CIR", "FRCIR", "CA", "MS", "DPX", "DBM", "MKJ", "VBN", "VS", "VPT", "BKAD", "TKJ"];
const CHANNELS = ["OEM", "Distribution", "Intercompany"];
const TIERS = ["Enterprise", "Large", "Mid", "SMB"];

function statusConfig(status: string) {
  switch (status) {
    case "active": return { color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" />, label: "Active" };
    case "pending": return { color: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="w-3 h-3" />, label: "Pending" };
    case "expired": return { color: "bg-slate-100 text-slate-600 border-slate-200", icon: <AlertCircle className="w-3 h-3" />, label: "Expired" };
    case "cancelled": return { color: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" />, label: "Cancelled" };
    default: return { color: "bg-slate-100 text-slate-600 border-slate-200", icon: null, label: status };
  }
}

function daysUntilExpiry(expirationDate: string | Date | null): number | null {
  if (!expirationDate) return null;
  const exp = new Date(expirationDate);
  return Math.ceil((exp.getTime() - Date.now()) / 86400000);
}

const EMPTY_FORM = {
  customerName: "",
  customerTier: "Enterprise",
  channel: "OEM",
  productFamily: "",
  partNumber: "",
  description: "",
  floorPrice: "",
  targetPrice: "",
  ceilingPrice: "",
  maxDiscountPct: "",
  effectiveDate: new Date().toISOString().slice(0, 10),
  expirationDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  autoRenew: false,
  renewalNoticeDays: 30,
  status: "active" as "active" | "pending" | "expired" | "cancelled",
  approvedBy: "",
  notes: "",
};

export default function CustomerAgreements() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: agreements, refetch, isLoading } = trpc.agreements.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    family: familyFilter !== "all" ? familyFilter : undefined,
    search: search.length >= 2 ? search : undefined,
    limit: 100,
  });

  const upsertMutation = trpc.agreements.upsert.useMutation({
    onSuccess: () => { toast.success(editId ? "Agreement updated" : "Agreement created"); setModalOpen(false); refetch(); },
    onError: () => toast.error("Failed to save agreement"),
  });
  const deleteMutation = trpc.agreements.delete.useMutation({
    onSuccess: () => { toast.success("Agreement deleted"); refetch(); },
    onError: () => toast.error("Failed to delete agreement"),
  });

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({
      customerName: a.customerName ?? "",
      customerTier: a.customerTier ?? "Enterprise",
      channel: a.channel ?? "OEM",
      productFamily: a.productFamily ?? "",
      partNumber: a.partNumber ?? "",
      description: a.description ?? "",
      floorPrice: a.floorPrice ?? "",
      targetPrice: a.targetPrice ?? "",
      ceilingPrice: a.ceilingPrice ?? "",
      maxDiscountPct: a.maxDiscountPct != null ? String(a.maxDiscountPct) : "",
      effectiveDate: a.effectiveDate ? new Date(a.effectiveDate).toISOString().slice(0, 10) : EMPTY_FORM.effectiveDate,
      expirationDate: a.expirationDate ? new Date(a.expirationDate).toISOString().slice(0, 10) : EMPTY_FORM.expirationDate,
      autoRenew: a.autoRenew ?? false,
      renewalNoticeDays: a.renewalNoticeDays ?? 30,
      status: a.status ?? "active",
      approvedBy: a.approvedBy ?? "",
      notes: a.notes ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (!form.customerName.trim() || !form.effectiveDate || !form.expirationDate) {
      toast.error("Customer name and dates are required");
      return;
    }
    upsertMutation.mutate({
      id: editId ?? undefined,
      customerName: form.customerName,
      customerTier: form.customerTier || undefined,
      channel: form.channel || undefined,
      productFamily: form.productFamily || undefined,
      partNumber: form.partNumber || undefined,
      description: form.description || undefined,
      floorPrice: form.floorPrice ? parseFloat(form.floorPrice) : undefined,
      targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : undefined,
      ceilingPrice: form.ceilingPrice ? parseFloat(form.ceilingPrice) : undefined,
      maxDiscountPct: form.maxDiscountPct ? parseFloat(form.maxDiscountPct) : undefined,
      effectiveDate: form.effectiveDate,
      expirationDate: form.expirationDate,
      autoRenew: form.autoRenew,
      renewalNoticeDays: form.renewalNoticeDays,
      status: form.status,
      approvedBy: form.approvedBy || undefined,
      notes: form.notes || undefined,
    });
  };

  // KPI counts
  const active = agreements?.filter(a => a.status === "active").length ?? 0;
  const expiringSoon = agreements?.filter(a => {
    const d = daysUntilExpiry(a.expirationDate);
    return a.status === "active" && d !== null && d <= 30;
  }).length ?? 0;
  const pending = agreements?.filter(a => a.status === "pending").length ?? 0;

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
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Customer Pricing Agreements</h1>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> New Agreement
          </Button>
        </div>

        {/* KPI bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Active Agreements", value: active, color: "text-green-700", bg: "bg-green-50 border-green-200" },
            { label: "Expiring in 30 Days", value: expiringSoon, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
            { label: "Pending Approval", value: pending, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer name…" className="pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={familyFilter} onValueChange={setFamilyFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Families</SelectItem>
              {FAMILIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Agreements list */}
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />)}</div>
        ) : !agreements?.length ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <Shield className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No agreements found</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first customer pricing agreement to enforce negotiated price floors and ceilings.</p>
            <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="w-4 h-4" /> New Agreement</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {agreements.map((a) => {
              const sc = statusConfig(a.status ?? "pending");
              const days = daysUntilExpiry(a.expirationDate);
              const isExpanded = expandedId === a.id;
              const expiringSoon = days !== null && days <= 30 && a.status === "active";
              return (
                <div key={a.id} className={`rounded-xl border bg-card transition-all ${expiringSoon ? "border-amber-200" : "border-border/60"}`}>
                  {/* Row */}
                  <div
                    className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-muted/20"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{a.customerName}</span>
                        <Badge variant="outline" className="text-[10px]">{a.customerTier}</Badge>
                        {a.channel && <Badge variant="outline" className="text-[10px]">{a.channel}</Badge>}
                        {a.productFamily && <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">{a.productFamily}</Badge>}
                        {a.partNumber && <span className="font-mono text-xs text-muted-foreground">{a.partNumber}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
                          {a.effectiveDate ? new Date(a.effectiveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          {" → "}
                          {a.expirationDate ? new Date(a.expirationDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </span>
                        {days !== null && a.status === "active" && (
                          <span className={`font-medium ${days <= 7 ? "text-red-600" : days <= 30 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {days <= 0 ? "Expired" : `${days}d remaining`}
                          </span>
                        )}
                        {a.autoRenew && <span className="flex items-center gap-0.5 text-green-600"><RefreshCw className="w-2.5 h-2.5" /> Auto-renew</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {a.targetPrice && (
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Target</div>
                          <div className="font-mono text-sm font-semibold">${parseFloat(String(a.targetPrice)).toFixed(2)}</div>
                        </div>
                      )}
                      {a.maxDiscountPct != null && (
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Max Disc.</div>
                          <div className="font-mono text-sm font-semibold">{a.maxDiscountPct}%</div>
                        </div>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                      <button onClick={e => { e.stopPropagation(); openEdit(a); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); if (confirm("Delete this agreement?")) deleteMutation.mutate({ id: a.id }); }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border/40 px-5 py-4 bg-muted/20">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {[
                          { label: "Floor Price", value: a.floorPrice ? `$${parseFloat(String(a.floorPrice)).toFixed(2)}` : "—" },
                          { label: "Target Price", value: a.targetPrice ? `$${parseFloat(String(a.targetPrice)).toFixed(2)}` : "—" },
                          { label: "Ceiling Price", value: a.ceilingPrice ? `$${parseFloat(String(a.ceilingPrice)).toFixed(2)}` : "—" },
                          { label: "Max Discount", value: a.maxDiscountPct != null ? `${a.maxDiscountPct}%` : "—" },
                          { label: "Renewal Notice", value: `${a.renewalNoticeDays ?? 30} days` },
                          { label: "Approved By", value: a.approvedBy ?? "—" },
                        ].map(f => (
                          <div key={f.label}>
                            <div className="text-xs text-muted-foreground">{f.label}</div>
                            <div className="font-medium font-mono">{f.value}</div>
                          </div>
                        ))}
                      </div>
                      {a.description && <p className="text-xs text-muted-foreground mt-3 border-t border-border/30 pt-3">{a.description}</p>}
                      {a.notes && <p className="text-xs text-muted-foreground mt-1 italic">{a.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Agreement" : "New Customer Pricing Agreement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Customer Name *</Label>
                <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Lockheed Martin" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Customer Tier</Label>
                <Select value={form.customerTier} onValueChange={v => setForm(f => ({ ...f, customerTier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Channel</Label>
                <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Product Family</Label>
                <Select value={form.productFamily || "all"} onValueChange={v => setForm(f => ({ ...f, productFamily: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="All families" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All families</SelectItem>
                    {FAMILIES.map(fam => <SelectItem key={fam} value={fam}>{fam}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Part Number (optional)</Label>
                <Input value={form.partNumber} onChange={e => setForm(f => ({ ...f, partNumber: e.target.value }))} placeholder="Leave blank for family-level" className="font-mono" />
              </div>
            </div>

            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price Bounds</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "floorPrice", label: "Floor Price ($)" },
                { key: "targetPrice", label: "Target Price ($)" },
                { key: "ceilingPrice", label: "Ceiling Price ($)" },
                { key: "maxDiscountPct", label: "Max Discount %" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="font-mono"
                  />
                </div>
              ))}
            </div>

            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validity</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Effective Date *</Label>
                <Input type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Expiration Date *</Label>
                <Input type="date" value={form.expirationDate} onChange={e => setForm(f => ({ ...f, expirationDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Approved By</Label>
                <Input value={form.approvedBy} onChange={e => setForm(f => ({ ...f, approvedBy: e.target.value }))} placeholder="Name or role" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Description / Scope</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the scope and terms of this agreement…" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Internal Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any internal context…" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Saving…" : editId ? "Update Agreement" : "Create Agreement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
