import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLocation } from "wouter";
import { Search, Plus, Package, Layers, TrendingUp, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const FAMILIES = [
  "All", "38999/KJB", "KPT", "CIR/FRCIR", "CA Bayonet", "MS Series",
  "MKJ Trinity", "VBN/VS/VPT", "D-Sub/DPX", "Rack & Panel",
];
const STATUSES = ["All", "Active", "Inactive", "Discontinued"];

const AI_RECS: Record<string, { action: string; reason: string; color: string }> = {
  "Increase": { action: "Increase Price", reason: "Below market value", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  "Decrease": { action: "Decrease Price", reason: "Above competitive range", color: "text-red-600 bg-red-50 border-red-200" },
  "Hold": { action: "Hold Price", reason: "Optimal positioning", color: "text-blue-600 bg-blue-50 border-blue-200" },
  "Review": { action: "Review Required", reason: "Unusual margin pattern", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
};

export default function ProductManagement() {
  const [, navigate] = useLocation();
  const [family, setFamily] = useState("All");
  const [status, setStatus] = useState("All");
  const [isCustom, setIsCustom] = useState<boolean | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: products = [], isLoading } = trpc.productMgmt.list.useQuery({ family, status, isCustom, search });
  const deleteMutation = trpc.productMgmt.delete.useMutation({
    onSuccess: () => { utils.productMgmt.list.invalidate(); toast.success("Product removed."); },
  });

  const standardCount = products.filter((p) => !p.isCustom).length;
  const customCount = products.filter((p) => p.isCustom).length;
  const avgPrice = products.length ? products.reduce((s, p) => s + parseFloat(p.listPrice), 0) / products.length : 0;
  const activeCount = products.filter((p) => p.status === "Active").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Product Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage standard and custom connector products with AI pricing recommendations</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Add Product</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
            <AddProductForm onClose={() => { setAddOpen(false); utils.productMgmt.list.invalidate(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Standard Products", value: String(standardCount), icon: Package, color: "text-blue-600" },
          { label: "Custom Products", value: String(customCount), icon: Layers, color: "text-purple-600" },
          { label: "Active Products", value: String(activeCount), icon: TrendingUp, color: "text-emerald-600" },
          { label: "Avg List Price", value: `$${avgPrice.toFixed(2)}`, icon: AlertCircle, color: "text-amber-600" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</p>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search SKU or name..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={family} onValueChange={setFamily}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{FAMILIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm text-muted-foreground">Custom Only</span>
          <Switch checked={isCustom === true} onCheckedChange={(v) => setIsCustom(v ? true : undefined)} />
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">List Price</TableHead>
                <TableHead className="text-right">Complexity</TableHead>
                <TableHead className="text-right">MOQ</TableHead>
                <TableHead>AI Recommendation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No products found.</TableCell></TableRow>
              ) : products.map((p) => {
                const price = parseFloat(p.listPrice);
                // Derive AI recommendation from complexity and price
                const aiKey = p.isCustom ? "Review" : p.complexityMultiplier > 1.3 ? "Increase" : p.complexityMultiplier < 0.9 ? "Decrease" : "Hold";
                const rec = AI_RECS[aiKey]!;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-medium">{p.sku}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.basedOnSku && <p className="text-xs text-muted-foreground">Based on: {p.basedOnSku}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.family}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs border-0 ${p.isCustom ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {p.isCustom ? "Custom" : "Standard"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">${price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{p.complexityMultiplier.toFixed(2)}×</TableCell>
                    <TableCell className="text-right font-mono">{p.moq}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${rec.color}`}>{rec.action}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs border-0 ${
                        p.status === "Active" ? "bg-emerald-100 text-emerald-700" :
                        p.status === "Discontinued" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs"
                        onClick={() => deleteMutation.mutate({ id: p.id })}>
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
    </div>
  );
}

function AddProductForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    sku: "", name: "", family: "38999/KJB", category: "Circular", isCustom: false,
    listPrice: 0, complexityMultiplier: 1.0, moq: 1, status: "Active" as const,
  });
  const utils = trpc.useUtils();
  const upsert = trpc.productMgmt.upsert.useMutation({
    onSuccess: () => { utils.productMgmt.list.invalidate(); toast.success("Product added."); onClose(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>SKU</Label>
          <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. KJB6E14-35SN" />
        </div>
        <div className="space-y-1.5">
          <Label>Product Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. KJB Circular Connector" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Family</Label>
          <Select value={form.family} onValueChange={(v) => setForm({ ...form, family: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FAMILIES.filter(f => f !== "All").map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>List Price ($)</Label>
          <Input type="number" value={form.listPrice} onChange={(e) => setForm({ ...form, listPrice: Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Complexity Multiplier</Label>
          <Input type="number" step="0.1" value={form.complexityMultiplier} onChange={(e) => setForm({ ...form, complexityMultiplier: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>MOQ</Label>
          <Input type="number" value={form.moq} onChange={(e) => setForm({ ...form, moq: Number(e.target.value) })} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.isCustom} onCheckedChange={(v) => setForm({ ...form, isCustom: v })} />
        <Label>Custom / Made-to-Order Product</Label>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" disabled={!form.sku || !form.name} onClick={() => upsert.mutate(form)}>Add Product</Button>
      </div>
    </div>
  );
}
