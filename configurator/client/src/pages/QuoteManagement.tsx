import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { Search, CheckCircle, XCircle, Eye, FileText, Clock, TrendingUp, DollarSign, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["All", "Draft", "Pending Approval", "Auto-Approved", "Approved", "Rejected", "Expired", "Converted"];

const STATUS_STYLES: Record<string, string> = {
  "Draft": "bg-gray-100 text-gray-600 border-0",
  "Pending Approval": "bg-yellow-100 text-yellow-700 border-0",
  "Auto-Approved": "bg-blue-100 text-blue-700 border-0",
  "Approved": "bg-emerald-100 text-emerald-700 border-0",
  "Rejected": "bg-red-100 text-red-700 border-0",
  "Expired": "bg-orange-100 text-orange-700 border-0",
  "Converted": "bg-purple-100 text-purple-700 border-0",
};

export default function QuoteManagement() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: quotes = [], isLoading } = trpc.quoteMgmt.list.useQuery({ status, search });
  const updateStatusMutation = trpc.quoteMgmt.updateStatus.useMutation({
    onSuccess: (_, vars) => {
      utils.quoteMgmt.list.invalidate();
      toast.success(`Quote ${vars.status === "Approved" ? "approved" : "rejected"}.`);
      setSelected(new Set());
    },
  });
  const approveMutation = { mutate: (v: { id: number }) => updateStatusMutation.mutate({ id: v.id, status: "Approved" }) };
  const rejectMutation = { mutate: (v: { id: number }) => updateStatusMutation.mutate({ id: v.id, status: "Rejected" }) };

  const detailQuote = quotes.find((q) => q.id === detailId);

  // KPIs
  const totalValue = quotes.reduce((s, q) => s + parseFloat(q.totalValue), 0);
  const pendingCount = quotes.filter((q) => q.status === "Pending Approval").length;
  const approvedCount = quotes.filter((q) => q.status === "Approved" || q.status === "Auto-Approved").length;
  const convertedCount = quotes.filter((q) => q.status === "Converted").length;

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    setSelected(selected.size === quotes.length ? new Set() : new Set(quotes.map((q) => q.id)));
  };

  const handleBulkApprove = () => {
    if (!selected.size) return toast.error("Select quotes first.");
    Array.from(selected).forEach((id) => approveMutation.mutate({ id }));
  };
  const handleBulkReject = () => {
    if (!selected.size) return toast.error("Select quotes first.");
    Array.from(selected).forEach((id) => rejectMutation.mutate({ id }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Quote Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Review, approve, and track all customer quotes through the approval workflow</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Quotes", value: String(quotes.length), icon: FileText },
          { label: "Pending Approval", value: String(pendingCount), icon: Clock },
          { label: "Approved / Auto", value: String(approvedCount), icon: CheckCircle },
          { label: "Total Value", value: `$${(totalValue / 1e3).toFixed(0)}K`, icon: DollarSign },
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

      {/* Filters + Bulk Actions */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search quote ID or customer..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Separator orientation="vertical" className="h-6" />
        <span className="text-sm text-muted-foreground">{selected.size} selected</span>
        <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleBulkApprove} disabled={!selected.size}>
          <CheckCircle className="w-3.5 h-3.5" />Bulk Approve
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={handleBulkReject} disabled={!selected.size}>
          <XCircle className="w-3.5 h-3.5" />Bulk Reject
        </Button>
      </div>

      {/* Quotes Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={quotes.length > 0 && selected.size === quotes.length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Quote ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : quotes.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No quotes found.</TableCell></TableRow>
              ) : quotes.map((q) => {
                const itemCount = Array.isArray(q.items) ? q.items.length : 0;
                const value = parseFloat(q.totalValue);
                return (
                  <TableRow key={q.id} className={selected.has(q.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{q.quoteId}</TableCell>
                    <TableCell className="font-medium text-sm">{q.customerName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.contactName ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">${value.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{itemCount}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_STYLES[q.status] ?? "bg-gray-100 text-gray-600 border-0"}`}>{q.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {q.expiryDate ? new Date(q.expiryDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDetailId(q.id)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {q.status === "Pending Approval" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => approveMutation.mutate({ id: q.id })}>✓</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 hover:bg-red-50"
                              onClick={() => rejectMutation.mutate({ id: q.id })}>✗</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quote Detail Dialog */}
      <Dialog open={detailId !== null} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quote {detailQuote?.quoteId}</DialogTitle>
          </DialogHeader>
          {detailQuote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium ml-1">{detailQuote.customerName}</span></div>
                <div><span className="text-muted-foreground">Contact:</span> <span className="font-medium ml-1">{detailQuote.contactName ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Status:</span>
                  <Badge className={`ml-2 text-xs ${STATUS_STYLES[detailQuote.status] ?? ""}`}>{detailQuote.status}</Badge>
                </div>
                <div><span className="text-muted-foreground">Total Value:</span> <span className="font-bold ml-1">${parseFloat(detailQuote.totalValue).toFixed(2)}</span></div>
              </div>
              <Separator />
              {Array.isArray(detailQuote.items) && detailQuote.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailQuote.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell className="text-sm">{item.description}</TableCell>
                        <TableCell className="text-right">{item.qty}</TableCell>
                        <TableCell className="text-right font-mono">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.discount}%</TableCell>
                        <TableCell className="text-right font-mono font-semibold">${item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No line items.</p>
              )}
              {detailQuote.notes && (
                <div className="text-sm bg-muted/50 rounded-lg p-3">
                  <span className="font-medium">Notes: </span>{detailQuote.notes}
                </div>
              )}
              {detailQuote.status === "Pending Approval" && (
                <div className="flex gap-3 pt-2">
                  <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => { approveMutation.mutate({ id: detailQuote.id }); setDetailId(null); }}>
                    <CheckCircle className="w-4 h-4" />Approve Quote
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => { rejectMutation.mutate({ id: detailQuote.id }); setDetailId(null); }}>
                    <XCircle className="w-4 h-4" />Reject Quote
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
