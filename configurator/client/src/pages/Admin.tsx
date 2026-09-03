import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Shield, Settings, FileText, DollarSign, Edit3, Check, X as XIcon,
  AlertTriangle, CheckCircle2, Clock, Package, ChevronDown, ChevronUp,
  Loader2, ArrowLeft, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";

type RfqStatus = "pending" | "reviewing" | "quoted" | "closed";

const STATUS_CONFIG: Record<RfqStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700 border-amber-200",  icon: Clock },
  reviewing: { label: "Reviewing", color: "bg-blue-100 text-blue-700 border-blue-200",     icon: RefreshCw },
  quoted:    { label: "Quoted",    color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle2 },
  closed:    { label: "Closed",    color: "bg-gray-100 text-gray-600 border-gray-200",     icon: XIcon },
};

function PricingRulesTab() {
  const [selectedFamily, setSelectedFamily] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ basePrice: "", customUpchargePct: "", notes: "" });

  const { data: rules = [], refetch } = trpc.admin.getPricingRules.useQuery(
    { family: selectedFamily || undefined }
  );

  const updateRule = trpc.admin.updatePricingRule.useMutation({
    onSuccess: () => {
      toast.success("Pricing rule updated");
      setEditingId(null);
      refetch();
    },
    onError: () => toast.error("Failed to update rule"),
  });

  const startEdit = (rule: typeof rules[0]) => {
    setEditingId(rule.id);
    setEditForm({
      basePrice: rule.basePrice ?? "",
      customUpchargePct: rule.customUpchargePct ?? "",
      notes: rule.notes ?? "",
    });
  };

  const handleSave = async (id: number) => {
    await updateRule.mutateAsync({ id, ...editForm });
  };

  const FAMILIES = [
    "38999", "KPT", "CIR", "FRCIR", "CA", "MS", "DPX", "DBM", "MKJ", "VBN", "VS", "VPT", "BKAD", "TKJ",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedFamily} onValueChange={setSelectedFamily}>
          <SelectTrigger className="w-48 border-border/60">
            <SelectValue placeholder="All families" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All families</SelectItem>
            {FAMILIES.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">{rules.length} rules</div>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Family</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shell Size</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base Price</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom %</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, idx) => (
              <tr key={rule.id} className={cn("border-b border-border/40 hover:bg-muted/20 transition-colors", idx % 2 === 0 ? "" : "bg-muted/10")}>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="font-mono text-xs">{rule.family}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{rule.shellSize ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{rule.contactType ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {editingId === rule.id ? (
                    <Input
                      value={editForm.basePrice}
                      onChange={(e) => setEditForm((f) => ({ ...f, basePrice: e.target.value }))}
                      className="w-24 text-right text-xs h-7 ml-auto"
                    />
                  ) : (
                    <span className="font-semibold">${parseFloat(rule.basePrice ?? "0").toFixed(2)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === rule.id ? (
                    <Input
                      value={editForm.customUpchargePct}
                      onChange={(e) => setEditForm((f) => ({ ...f, customUpchargePct: e.target.value }))}
                      className="w-20 text-right text-xs h-7 ml-auto"
                    />
                  ) : (
                    <span className="text-muted-foreground">{rule.customUpchargePct ?? "0"}%</span>
                  )}
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  {editingId === rule.id ? (
                    <Input
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      className="text-xs h-7"
                      placeholder="Notes…"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground truncate block">{rule.notes ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === rule.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleSave(rule.id)} className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                        {updateRule.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                        <XIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(rule)} className="h-7 w-7 p-0 text-muted-foreground hover:text-primary">
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">No pricing rules found.</div>
        )}
      </div>
    </div>
  );
}

function RfqSubmissionsTab() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

  const { data: submissions = [], refetch } = trpc.admin.getRfqSubmissions.useQuery();

  const updateStatus = trpc.admin.updateRfqStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: () => toast.error("Failed to update status"),
  });

  const handleStatusChange = async (id: number, status: RfqStatus, adminNotes?: string) => {
    await updateStatus.mutateAsync({ id, status, adminNotes });
  };

  const statusCounts = {
    pending: submissions.filter((s) => s.status === "pending").length,
    reviewing: submissions.filter((s) => s.status === "reviewing").length,
    quoted: submissions.filter((s) => s.status === "quoted").length,
    closed: submissions.filter((s) => s.status === "closed").length,
  };

  return (
    <div className="space-y-4">
      {/* Status summary */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.entries(statusCounts) as [RfqStatus, number][]).map(([status, count]) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={status} className={cn("rounded-lg border px-4 py-3", cfg.color)}>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs font-medium mt-0.5">{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Submissions list */}
      <div className="space-y-3">
        {submissions.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">No quote requests yet.</div>
        )}
        {submissions.map((sub) => {
          const cfg = STATUS_CONFIG[sub.status as RfqStatus] ?? STATUS_CONFIG.pending;
          const StatusIcon = cfg.icon;
          const isExpanded = expandedId === sub.id;
          const items = (sub.items as Array<{
            partNumber: string;
            isCustom: boolean;
            family: string;
            description: string;
            attributes: Record<string, string>;
            unitPrice: string | null;
            quantity: number;
          }>) ?? [];

          return (
            <Card key={sub.id} className="border-border/60 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-semibold text-sm">{sub.contactName}</div>
                    <div className="text-xs text-muted-foreground">{sub.contactEmail}</div>
                    {sub.company && <div className="text-xs text-muted-foreground">{sub.company}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={cn("gap-1 text-[10px] border", cfg.color)}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-xs text-muted-foreground">{items.length} line item{items.length !== 1 ? "s" : ""}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">
                    {items.filter((i) => i.isCustom).length} custom, {items.filter((i) => !i.isCustom).length} standard
                  </span>
                </div>

                {/* Status controls */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {(["pending", "reviewing", "quoted", "closed"] as RfqStatus[]).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={sub.status === s ? "default" : "outline"}
                      onClick={() => handleStatusChange(sub.id, s, editingNotes[sub.id])}
                      disabled={updateStatus.isPending}
                      className={cn(
                        "h-7 text-xs gap-1",
                        sub.status === s ? "bg-primary" : "border-border/60 text-muted-foreground"
                      )}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Button>
                  ))}
                </div>

                {/* Admin notes */}
                <div className="mb-3">
                  <Textarea
                    value={editingNotes[sub.id] ?? sub.adminNotes ?? ""}
                    onChange={(e) => setEditingNotes((n) => ({ ...n, [sub.id]: e.target.value }))}
                    placeholder="Admin notes…"
                    className="text-xs border-border/60 resize-none h-16"
                    rows={2}
                  />
                </div>

                {/* Toggle items */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isExpanded ? "Hide" : "Show"} line items
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className={cn(
                        "rounded-lg border p-3",
                        item.isCustom ? "border-amber-200 bg-amber-50/40" : "border-border/40 bg-muted/20"
                      )}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="font-mono text-xs font-bold tracking-wider">{item.partNumber}</div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.isCustom ? (
                              <Badge className="badge-custom gap-1 text-[10px]">
                                <AlertTriangle className="w-2.5 h-2.5" />Custom
                              </Badge>
                            ) : (
                              <Badge className="badge-standard gap-1 text-[10px]">
                                <CheckCircle2 className="w-2.5 h-2.5" />Standard
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">{item.description}</div>
                        {Object.keys(item.attributes).length > 0 && (
                          <div className="grid grid-cols-2 gap-1">
                            {Object.entries(item.attributes).map(([k, v]) => (
                              <div key={k} className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground capitalize">{k}</span>
                                <span className="font-mono font-medium">{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 text-xs font-semibold text-right">
                          {item.unitPrice
                            ? `$${(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}`
                            : <span className="text-muted-foreground italic">RFQ</span>
                          }
                        </div>
                      </div>
                    ))}
                    {sub.notes && (
                      <div className="bg-muted/40 rounded-lg p-3">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Customer Notes</div>
                        <div className="text-xs text-foreground">{sub.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Sign In Required</h2>
              <p className="text-muted-foreground text-sm mt-2">You must be signed in as an admin to access this area.</p>
            </div>
            <a href={getLoginUrl()}>
              <Button className="gap-2 bg-primary hover:bg-primary/90">Sign In</Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Access Denied</h2>
              <p className="text-muted-foreground text-sm mt-2">This area is restricted to administrators only.</p>
            </div>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Go Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />

      <div className="container py-8 flex-1">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
              <p className="text-muted-foreground text-sm">Manage pricing rules and review quote requests</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="rfq" className="space-y-6">
          <TabsList className="border border-border/60 bg-muted/30">
            <TabsTrigger value="rfq" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileText className="w-4 h-4" />
              Quote Requests
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <DollarSign className="w-4 h-4" />
              Pricing Rules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rfq">
            <RfqSubmissionsTab />
          </TabsContent>

          <TabsContent value="pricing">
            <PricingRulesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
