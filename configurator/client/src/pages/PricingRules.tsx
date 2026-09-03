import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Plus, ChevronUp, ChevronDown, Pencil, Trash2,
  Shield, TrendingDown, Link2, Users, BarChart2, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle2, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ── Types ─────────────────────────────────────────────────────────────────────
type RuleType = "min_margin" | "min_markup" | "family_tether" | "competitor_tie" | "max_discount_segment";
type ScopeType = "global" | "family" | "channel" | "customerTier";

interface EngineRule {
  id: number;
  name: string;
  ruleType: RuleType;
  scope: ScopeType;
  scopeValue: string | null;
  paramValue: string;
  competitorName: string | null;
  priority: number;
  active: boolean;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: Date | string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const RULE_TYPE_META: Record<RuleType, { label: string; color: string; icon: React.ReactNode; paramLabel: string; paramHint: string; showCompetitor: boolean; showScope: boolean }> = {
  min_margin: {
    label: "Minimum Margin",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Shield className="w-4 h-4" />,
    paramLabel: "Minimum Margin %",
    paramHint: "e.g. 25 for 25% gross margin floor",
    showCompetitor: false,
    showScope: true,
  },
  min_markup: {
    label: "Minimum Markup",
    color: "bg-violet-100 text-violet-800 border-violet-200",
    icon: <TrendingDown className="w-4 h-4" />,
    paramLabel: "Minimum Markup %",
    paramHint: "e.g. 40 for 40% markup over cost",
    showCompetitor: false,
    showScope: true,
  },
  family_tether: {
    label: "Family Price Tether",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Link2 className="w-4 h-4" />,
    paramLabel: "Tether Ratio",
    paramHint: "e.g. 100 to anchor to 100% of family average list",
    showCompetitor: false,
    showScope: true,
  },
  competitor_tie: {
    label: "Competitor Price Tie",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <BarChart2 className="w-4 h-4" />,
    paramLabel: "Premium % over Competitor",
    paramHint: "e.g. 5 to allow up to 5% above competitor price",
    showCompetitor: true,
    showScope: true,
  },
  max_discount_segment: {
    label: "Max Discount (Segment)",
    color: "bg-rose-100 text-rose-800 border-rose-200",
    icon: <Users className="w-4 h-4" />,
    paramLabel: "Maximum Discount %",
    paramHint: "e.g. 25 for 25% max discount from list",
    showCompetitor: false,
    showScope: true,
  },
};

const SCOPE_META: Record<ScopeType, { label: string; placeholder: string }> = {
  global: { label: "Global (all products)", placeholder: "" },
  family: { label: "Product Family", placeholder: "e.g. MIL-38999" },
  channel: { label: "Sales Channel", placeholder: "e.g. OEM, Distribution" },
  customerTier: { label: "Customer Tier", placeholder: "e.g. Enterprise, Mid-Market, SMB" },
};

const COMPETITORS = ["Amphenol", "TE Connectivity", "Molex", "Souriau", "Glenair"];
const FAMILIES = ["MIL-38999", "MIL-26482", "MIL-5015", "Circular DIN", "Rectangular", "RF/Coax", "Fiber Optic", "Power", "MIL-SPEC"];
const CHANNELS = ["OEM", "Distribution", "Intercompany", "Government", "Direct"];
const TIERS = ["Enterprise", "Large", "Mid-Market", "SMB", "Government"];

// ── Empty form state ──────────────────────────────────────────────────────────
const emptyForm = {
  name: "",
  ruleType: "min_margin" as RuleType,
  scope: "global" as ScopeType,
  scopeValue: "",
  paramValue: "",
  competitorName: "",
  priority: 100,
  active: true,
  notes: "",
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function PricingRules() {
  const [, navigate] = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<EngineRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: rules = [], refetch } = trpc.engineRules.getAll.useQuery();
  const createMutation = trpc.engineRules.create.useMutation({ onSuccess: () => { refetch(); setShowDialog(false); toast.success("Rule created"); } });
  const updateMutation = trpc.engineRules.update.useMutation({ onSuccess: () => { refetch(); setShowDialog(false); toast.success("Rule updated"); } });
  const deleteMutation = trpc.engineRules.delete.useMutation({ onSuccess: () => { refetch(); setDeleteConfirm(null); toast.success("Rule deleted"); } });
  const reorderMutation = trpc.engineRules.reorder.useMutation({ onSuccess: () => refetch() });

  const openCreate = () => {
    setEditingRule(null);
    setForm({ ...emptyForm, priority: (rules.length > 0 ? Math.max(...rules.map(r => r.priority)) + 1 : 1) });
    setShowDialog(true);
  };

  const openEdit = (rule: EngineRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      ruleType: rule.ruleType,
      scope: rule.scope,
      scopeValue: rule.scopeValue ?? "",
      paramValue: (parseFloat(String(rule.paramValue)) * 100).toFixed(2), // stored as decimal, display as %
      competitorName: rule.competitorName ?? "",
      priority: rule.priority,
      active: rule.active,
      notes: rule.notes ?? "",
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    const paramNum = parseFloat(form.paramValue) / 100; // convert % to decimal for storage
    if (isNaN(paramNum)) { toast.error("Parameter value must be a number"); return; }
    if (!form.name.trim()) { toast.error("Rule name is required"); return; }
    const payload = {
      name: form.name,
      ruleType: form.ruleType,
      scope: form.scope,
      scopeValue: form.scope !== "global" ? form.scopeValue : undefined,
      paramValue: paramNum,
      competitorName: form.ruleType === "competitor_tie" ? form.competitorName : undefined,
      priority: form.priority,
      active: form.active,
      notes: form.notes || undefined,
    };
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const moveRule = (index: number, direction: "up" | "down") => {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sorted.length) return;
    [sorted[index], sorted[newIndex]] = [sorted[newIndex], sorted[index]];
    reorderMutation.mutate({ orderedIds: sorted.map(r => r.id) });
  };

  const toggleActive = (rule: EngineRule) => {
    updateMutation.mutate({ id: rule.id, active: !rule.active });
  };

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  const activeCount = rules.filter(r => r.active).length;
  const meta = RULE_TYPE_META;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Pricing Rules Engine</h1>
              <p className="text-sm text-slate-500">{activeCount} active rules · applied in priority order at quote time</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-navy-700 hover:bg-navy-800 bg-slate-800 hover:bg-slate-900">
            <Plus className="w-4 h-4 mr-2" /> Add Rule
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Rule type legend */}
        <div className="flex flex-wrap gap-2 mb-2">
          {(Object.entries(meta) as [RuleType, typeof meta[RuleType]][]).map(([type, m]) => (
            <span key={type} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${m.color}`}>
              {m.icon} {m.label}
            </span>
          ))}
        </div>

        {/* Priority explanation */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Rules are applied in priority order (1 = highest). Higher-priority rules override lower ones when they conflict. Use the arrows to reorder.</span>
        </div>

        {/* Rules list */}
        {sortedRules.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-slate-400">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No pricing rules configured</p>
              <p className="text-sm mt-1">Add rules to enforce margin floors, markup minimums, family tethering, competitor ties, and segment discount caps.</p>
              <Button onClick={openCreate} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" /> Add First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sortedRules.map((rule, idx) => {
              const m = meta[rule.ruleType];
              const pv = parseFloat(String(rule.paramValue)) * 100;
              return (
                <Card key={rule.id} className={`transition-all ${rule.active ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {/* Priority badge + reorder */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700"
                          onClick={() => moveRule(idx, "up")}
                          disabled={idx === 0}
                        >
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <span className="text-xs font-bold text-slate-500 w-5 text-center">{rule.priority}</span>
                        <Button
                          variant="ghost" size="sm"
                          className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700"
                          onClick={() => moveRule(idx, "down")}
                          disabled={idx === sortedRules.length - 1}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Rule type badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border shrink-0 ${m.color}`}>
                        {m.icon} {m.label}
                      </span>

                      {/* Rule details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{rule.name}</span>
                          {/* Scope badge */}
                          <Badge variant="outline" className="text-xs">
                            {rule.scope === "global" ? "Global" : `${SCOPE_META[rule.scope].label}: ${rule.scopeValue}`}
                          </Badge>
                          {/* Param value */}
                          <span className="text-xs text-slate-600 font-mono">
                            {rule.ruleType === "family_tether"
                              ? `Tether: ${pv.toFixed(0)}%`
                              : rule.ruleType === "competitor_tie"
                              ? `${rule.competitorName} +${pv.toFixed(0)}%`
                              : `${pv.toFixed(0)}%`}
                          </span>
                        </div>
                        {rule.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{rule.notes}</p>}
                      </div>

                      {/* Active toggle */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-slate-400">{rule.active ? "Active" : "Off"}</span>
                        <Switch
                          checked={rule.active}
                          onCheckedChange={() => toggleActive(rule)}
                          className="scale-75"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700" onClick={() => openEdit(rule)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" onClick={() => setDeleteConfirm(rule.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Pricing Rule" : "Add Pricing Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Rule Name */}
            <div className="space-y-1">
              <Label>Rule Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Global Minimum Margin Floor" />
            </div>

            {/* Rule Type */}
            <div className="space-y-1">
              <Label>Rule Type</Label>
              <Select value={form.ruleType} onValueChange={v => setForm(f => ({ ...f, ruleType: v as RuleType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(meta) as [RuleType, typeof meta[RuleType]][]).map(([type, m]) => (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">{m.icon} {m.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">{meta[form.ruleType].paramHint}</p>
            </div>

            {/* Scope */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Scope</Label>
                <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v as ScopeType, scopeValue: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SCOPE_META) as [ScopeType, typeof SCOPE_META[ScopeType]][]).map(([s, sm]) => (
                      <SelectItem key={s} value={s}>{sm.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.scope !== "global" && (
                <div className="space-y-1">
                  <Label>{SCOPE_META[form.scope].label}</Label>
                  {form.scope === "family" ? (
                    <Select value={form.scopeValue} onValueChange={v => setForm(f => ({ ...f, scopeValue: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select family" /></SelectTrigger>
                      <SelectContent>{FAMILIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : form.scope === "channel" ? (
                    <Select value={form.scopeValue} onValueChange={v => setForm(f => ({ ...f, scopeValue: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                      <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Select value={form.scopeValue} onValueChange={v => setForm(f => ({ ...f, scopeValue: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                      <SelectContent>{TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Param value */}
            <div className="space-y-1">
              <Label>{meta[form.ruleType].paramLabel}</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={form.paramValue}
                  onChange={e => setForm(f => ({ ...f, paramValue: e.target.value }))}
                  placeholder="0"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>

            {/* Competitor name (only for competitor_tie) */}
            {form.ruleType === "competitor_tie" && (
              <div className="space-y-1">
                <Label>Competitor</Label>
                <Select value={form.competitorName} onValueChange={v => setForm(f => ({ ...f, competitorName: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select competitor" /></SelectTrigger>
                  <SelectContent>{COMPETITORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* Priority + Active */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Priority (1 = highest)</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 100 }))}
                  min={1}
                />
              </div>
              <div className="space-y-1">
                <Label>Active</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
                  <span className="text-sm text-slate-600">{form.active ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Explain the business rationale for this rule..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-slate-800 hover:bg-slate-900"
            >
              {editingRule ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to delete this pricing rule? This cannot be undone and will immediately stop enforcement at quote time.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm !== null && deleteMutation.mutate({ id: deleteConfirm })}
              disabled={deleteMutation.isPending}
            >
              Delete Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
