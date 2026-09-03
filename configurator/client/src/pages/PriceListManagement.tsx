import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import {
  TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, List, BarChart3,
  Users, Percent, ArrowLeft, History, ArrowUpRight, ArrowDownRight, Minus as MinusIcon,
} from "lucide-react";
import { toast } from "sonner";

const REC_STYLES: Record<string, { icon: React.ElementType; color: string; badge: string }> = {
  Increase: { icon: TrendingUp, color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700 border-0" },
  Decrease: { icon: TrendingDown, color: "text-red-500", badge: "bg-red-100 text-red-700 border-0" },
  Hold: { icon: Minus, color: "text-blue-600", badge: "bg-blue-100 text-blue-700 border-0" },
};

const STATUS_STYLES: Record<string, string> = {
  "Pending Review": "bg-yellow-100 text-yellow-700 border-0",
  "Approved": "bg-emerald-100 text-emerald-700 border-0",
  "Rejected": "bg-red-100 text-red-700 border-0",
};

const ENTITY_LABELS: Record<string, string> = {
  price_list_item: "Price List Item",
  product: "Product",
  agreement: "Agreement",
  quote: "Quote",
};

export default function PriceListManagement() {
  const [, navigate] = useLocation();
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState("price-lists");
  const [auditEntityType, setAuditEntityType] = useState("all");

  const utils = trpc.useUtils();
  const { data: lists = [] } = trpc.priceLists.getLists.useQuery();
  const { data: items = [], isLoading } = trpc.priceLists.getItems.useQuery(
    { priceListId: selectedListId ?? 0 },
    { enabled: selectedListId !== null }
  );
  const { data: auditLog = [], isLoading: auditLoading } = trpc.priceAudit.getLog.useQuery(
    { entityType: auditEntityType !== "all" ? auditEntityType : undefined, limit: 100 },
    { enabled: activeTab === "audit-log" }
  );

  const approveMutation = trpc.priceLists.approveItem.useMutation({
    onSuccess: () => { utils.priceLists.getItems.invalidate(); toast.success("Items approved."); setSelected(new Set()); },
  });
  const rejectMutation = trpc.priceLists.rejectItem.useMutation({
    onSuccess: () => { utils.priceLists.getItems.invalidate(); toast.success("Items rejected."); setSelected(new Set()); },
  });

  const activeList = lists.find((l) => l.id === selectedListId);
  const pendingCount = items.filter((i) => i.status === "Pending Review").length;
  const approvedCount = items.filter((i) => i.status === "Approved").length;
  const avgMargin = items.length ? items.reduce((s, i) => s + i.marginPct, 0) / items.length : 0;
  const avgAttainment = items.length ? items.reduce((s, i) => s + i.priceAttainment, 0) / items.length : 0;

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));
  };
  const handleBulkApprove = () => {
    if (!selected.size) return toast.error("Select items first.");
    Array.from(selected).forEach((id) => approveMutation.mutate({ id }));
  };
  const handleBulkReject = () => {
    if (!selected.size) return toast.error("Select items first.");
    Array.from(selected).forEach((id) => rejectMutation.mutate({ id }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Price List Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Review AI-recommended price changes, approve or override, publish price lists, and view the full price change audit log</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="price-lists" className="gap-1.5"><List className="w-3.5 h-3.5" /> Price Lists</TabsTrigger>
          <TabsTrigger value="audit-log" className="gap-1.5"><History className="w-3.5 h-3.5" /> Audit Log</TabsTrigger>
        </TabsList>

        {/* ── Price Lists Tab ── */}
        <TabsContent value="price-lists" className="space-y-6 mt-0">
          {/* Price List Selector */}
          <div className="flex gap-3 flex-wrap">
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedListId(l.id)}
                className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  selectedListId === l.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                {l.name}
                {l.isDefault && <span className="ml-1.5 text-xs opacity-70">(Default)</span>}
              </button>
            ))}
          </div>

          {selectedListId === null ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <List className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Select a price list above to begin review</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Items", value: String(items.length), icon: List },
                  { label: "Pending Review", value: String(pendingCount), icon: BarChart3 },
                  { label: "Avg Margin %", value: `${avgMargin.toFixed(1)}%`, icon: Percent },
                  { label: "Avg Price Attainment", value: `${avgAttainment.toFixed(1)}%`, icon: Users },
                ].map((kpi) => (
                  <Card key={kpi.label}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</p>
                        <kpi.icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Bulk Actions */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{selected.size} item{selected.size !== 1 ? "s" : ""} selected</span>
                <Separator orientation="vertical" className="h-4" />
                <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleBulkApprove} disabled={!selected.size}>
                  <CheckCircle className="w-3.5 h-3.5" />Bulk Approve
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={handleBulkReject} disabled={!selected.size}>
                  <XCircle className="w-3.5 h-3.5" />Bulk Reject
                </Button>
              </div>

              {/* Items Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox checked={items.length > 0 && selected.size === items.length} onCheckedChange={toggleAll} />
                        </TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="text-right">Current Price</TableHead>
                        <TableHead className="text-right">Margin %</TableHead>
                        <TableHead className="text-right">Customers</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Exception %</TableHead>
                        <TableHead>AI Rec.</TableHead>
                        <TableHead className="text-right">AI Price</TableHead>
                        <TableHead>Override Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                      ) : items.length === 0 ? (
                        <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">No items in this price list.</TableCell></TableRow>
                      ) : items.map((item) => {
                        const rec = REC_STYLES[item.aiRecommendation] ?? REC_STYLES.Hold;
                        const RecIcon = rec.icon;
                        const aiPrice = item.aiSuggestedPrice ? parseFloat(item.aiSuggestedPrice) : null;
                        const currentPrice = parseFloat(item.currentPrice);
                        const priceDiff = aiPrice ? ((aiPrice - currentPrice) / currentPrice) * 100 : 0;
                        return (
                          <TableRow key={item.id} className={selected.has(item.id) ? "bg-primary/5" : ""}>
                            <TableCell>
                              <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                            </TableCell>
                            <TableCell className="font-mono text-xs font-medium">{item.sku}</TableCell>
                            <TableCell className="text-sm max-w-[180px] truncate">{item.productName}</TableCell>
                            <TableCell className="text-right font-mono">${currentPrice.toFixed(2)}</TableCell>
                            <TableCell className={`text-right font-mono font-semibold ${item.marginPct >= 40 ? "text-emerald-600" : item.marginPct <= 25 ? "text-red-500" : "text-foreground"}`}>
                              {item.marginPct.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">{item.customers}</TableCell>
                            <TableCell className="text-right">{item.winRate.toFixed(1)}%</TableCell>
                            <TableCell className="text-right">{item.exceptionPct.toFixed(1)}%</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <RecIcon className={`w-3.5 h-3.5 ${rec.color}`} />
                                <Badge className={`text-xs ${rec.badge}`}>{item.aiRecommendation}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {aiPrice ? (
                                <div>
                                  <span className="font-mono font-semibold">${aiPrice.toFixed(2)}</span>
                                  <span className={`text-xs ml-1 ${priceDiff > 0 ? "text-emerald-600" : priceDiff < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                    {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}%
                                  </span>
                                </div>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                            <TableCell>
                              <Input
                                className="w-24 h-7 text-xs font-mono"
                                placeholder={aiPrice ? `$${aiPrice.toFixed(2)}` : "Override"}
                                value={overrides[item.id] ?? ""}
                                onChange={(e) => setOverrides({ ...overrides, [item.id]: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${STATUS_STYLES[item.status] ?? "bg-gray-100 text-gray-600 border-0"}`}>{item.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => approveMutation.mutate({ id: item.id })}>✓</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                                  onClick={() => rejectMutation.mutate({ id: item.id })}>✗</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Audit Log Tab ── */}
        <TabsContent value="audit-log" className="space-y-4 mt-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Price Change Audit Log</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Complete history of all price modifications — who changed what, when, and by how much</p>
            </div>
            <Select value={auditEntityType} onValueChange={setAuditEntityType}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entity Types</SelectItem>
                <SelectItem value="price_list_item">Price List Items</SelectItem>
                <SelectItem value="product">Products</SelectItem>
                <SelectItem value="agreement">Agreements</SelectItem>
                <SelectItem value="quote">Quotes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead className="text-right">Old Value</TableHead>
                    <TableHead className="text-right">New Value</TableHead>
                    <TableHead className="text-right">Change %</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading audit log…</TableCell></TableRow>
                  ) : auditLog.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <History className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-muted-foreground font-medium text-sm">No price changes recorded yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Price changes made through the system will appear here automatically</p>
                      </TableCell>
                    </TableRow>
                  ) : auditLog.map((entry) => {
                    const changePct = entry.changePct;
                    const isIncrease = changePct != null && changePct > 0;
                    const isDecrease = changePct != null && changePct < 0;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(entry.changedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[140px] truncate" title={entry.entityLabel ?? undefined}>
                          {entry.entityLabel ?? `ID ${entry.entityId}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{entry.field}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{entry.oldValue ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">{entry.newValue ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {changePct != null ? (
                            <span className={`flex items-center justify-end gap-0.5 text-xs font-semibold ${
                              isIncrease ? "text-emerald-600" : isDecrease ? "text-red-600" : "text-muted-foreground"
                            }`}>
                              {isIncrease ? <ArrowUpRight className="w-3 h-3" /> : isDecrease ? <ArrowDownRight className="w-3 h-3" /> : <MinusIcon className="w-3 h-3" />}
                              {isIncrease ? "+" : ""}{changePct.toFixed(1)}%
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">{entry.changedBy}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={entry.reason ?? undefined}>
                          {entry.reason ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
