import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useQuote } from "@/contexts/QuoteContext";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ShoppingCart, Trash2, Plus, Minus, X, ArrowRight, ArrowLeft,
  AlertTriangle, CheckCircle2, Package, Send, User, Mail, Building2,
  Phone, FileText, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function QuoteCart() {
  const { sessionToken, setCartCount } = useQuote();
  const [, navigate] = useLocation();
  const [showRfqForm, setShowRfqForm] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    contactName: "",
    contactEmail: "",
    company: "",
    phone: "",
    notes: "",
  });

  const { data: items = [], refetch } = trpc.quote.getItems.useQuery({ sessionToken });

  useEffect(() => {
    setCartCount(items.length);
  }, [items.length, setCartCount]);

  const removeItem = trpc.quote.removeItem.useMutation({
    onSuccess: (updated) => { setCartCount(updated?.length ?? 0); refetch(); },
    onError: () => toast.error("Failed to remove item"),
  });

  const updateQty = trpc.quote.updateQuantity.useMutation({
    onSuccess: () => refetch(),
  });

  const submitRfq = trpc.quote.submitRfq.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setCartCount(0);
      toast.success("Quote request submitted successfully!");
    },
    onError: () => toast.error("Failed to submit quote request. Please try again."),
  });

  const totalItems = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  const totalPrice = items.reduce((sum, item) => {
    const price = item.unitPrice ? parseFloat(item.unitPrice) : 0;
    return sum + price * (item.quantity ?? 1);
  }, 0);
  const hasRfqItems = items.some((item) => item.isCustom || !item.unitPrice);

  const toggleExpand = (id: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactName || !form.contactEmail) {
      toast.error("Name and email are required");
      return;
    }
    await submitRfq.mutateAsync({
      sessionToken,
      ...form,
      items: items.map((item) => ({
        partNumber: item.partNumber,
        isCustom: item.isCustom ?? false,
        family: item.family ?? "",
        description: item.description ?? item.partNumber,
        attributes: (item.attributes as Record<string, string>) ?? {},
        unitPrice: item.unitPrice ?? null,
        quantity: item.quantity ?? 1,
      })),
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Quote Request Submitted</h2>
              <p className="text-muted-foreground mt-2">
                Your request has been received. Our team will review your configuration and respond with a formal quote.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Link href="/configure">
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  Build Another Part
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Home
                </Button>
              </Link>
            </div>
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
          <Link href="/configure">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Part Builder
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Quote List
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review your quoted parts and submit a formal quote request.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <Package className="w-16 h-16 text-muted-foreground/20" />
            <div>
              <div className="text-lg font-semibold text-muted-foreground">Your quote list is empty</div>
              <div className="text-sm text-muted-foreground/70 mt-1">
                Build or look up a part and add it to start building your quote.
              </div>
            </div>
            <Link href="/configure">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                  Build a Part
                  <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            {/* Items list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">{items.length} line item{items.length !== 1 ? "s" : ""}</div>
              </div>

              {items.map((item, idx) => (
                <Card
                  key={item.id}
                  className={cn(
                    "border transition-all duration-150",
                    item.isCustom ? "border-amber-200" : "border-border/60"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Line number */}
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Part number + badges */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="font-mono text-sm font-bold tracking-wider text-foreground">
                            {item.partNumber}
                          </div>
                          <button
                            onClick={() => removeItem.mutate({ id: item.id, sessionToken })}
                            className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {item.isCustom ? (
                            <Badge className="badge-custom gap-1 text-[10px]">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Custom / Made-to-Order
                            </Badge>
                          ) : (
                            <Badge className="badge-standard gap-1 text-[10px]">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Standard Catalog
                            </Badge>
                          )}
                          {item.family && (
                            <Badge variant="outline" className="text-[10px] font-mono">{item.family}</Badge>
                          )}
                        </div>

                        {item.description && item.description !== item.partNumber && (
                          <div className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</div>
                        )}

                        {/* Attribute breakdown toggle */}
                        {item.attributes && Object.keys(item.attributes).length > 0 && (
                          <div className="mb-3">
                            <button
                              onClick={() => toggleExpand(item.id)}
                              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                            >
                              {expandedItems.has(item.id) ? (
                                <><ChevronUp className="w-3 h-3" />Hide attributes</>
                              ) : (
                                <><ChevronDown className="w-3 h-3" />Show attributes</>
                              )}
                            </button>
                            {expandedItems.has(item.id) && (
                              <div className="mt-2 bg-muted/40 rounded-lg p-3 space-y-1.5">
                                {Object.entries(item.attributes as Record<string, string>).map(([k, v]) => (
                                  <div key={k} className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground capitalize">{k}</span>
                                    <span className="font-mono font-medium text-foreground">{v}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Qty + price row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center border border-border/60 rounded-md overflow-hidden">
                            <button
                              onClick={() => updateQty.mutate({ id: item.id, sessionToken, quantity: Math.max(1, (item.quantity ?? 1) - 1) })}
                              className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-3 py-1.5 text-xs font-medium min-w-[36px] text-center">
                              {item.quantity ?? 1}
                            </span>
                            <button
                              onClick={() => updateQty.mutate({ id: item.id, sessionToken, quantity: (item.quantity ?? 1) + 1 })}
                              className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-right">
                            {item.unitPrice ? (
                              <>
                                <div className="text-sm font-semibold text-foreground">
                                  ${(parseFloat(item.unitPrice) * (item.quantity ?? 1)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  ${parseFloat(item.unitPrice).toFixed(2)} ea
                                </div>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">RFQ Required</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Link href="/configure">
                <Button variant="outline" size="sm" className="gap-2 mt-2 border-dashed border-border/60 text-muted-foreground hover:text-foreground w-full">
                  <Plus className="w-4 h-4" />
                  Add another part
                </Button>
              </Link>
            </div>

            {/* Summary + RFQ Form */}
            <div className="space-y-4">
              {/* Order Summary */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Line items</span>
                      <span>{items.length}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total units</span>
                      <span>{totalItems}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Standard parts</span>
                      <span>{items.filter((i) => !i.isCustom).length}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Custom / RFQ parts</span>
                      <span>{items.filter((i) => i.isCustom).length}</span>
                    </div>
                  </div>
                  <Separator />
                  {totalPrice > 0 && (
                    <div className="flex justify-between font-semibold">
                      <span>Est. Total</span>
                      <span>${totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {hasRfqItems && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-700">
                        Your list includes custom or RFQ items. A formal quote will be provided after review.
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={() => setShowRfqForm(true)}
                    className="w-full gap-2 bg-primary hover:bg-primary/90"
                  >
                    <Send className="w-4 h-4" />
                    Submit Quote Request
                  </Button>
                </CardContent>
              </Card>

              {/* RFQ Form */}
              {showRfqForm && (
                <Card className="border-primary/30 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3 h-3" /> Full Name *
                        </label>
                        <Input
                          required
                          value={form.contactName}
                          onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                          placeholder="Jane Smith"
                          className="border-border/60 focus-visible:ring-primary/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Mail className="w-3 h-3" /> Email Address *
                        </label>
                        <Input
                          required
                          type="email"
                          value={form.contactEmail}
                          onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                          placeholder="jane@company.com"
                          className="border-border/60 focus-visible:ring-primary/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> Company
                        </label>
                        <Input
                          value={form.company}
                          onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                          placeholder="Acme Corp"
                          className="border-border/60 focus-visible:ring-primary/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Phone className="w-3 h-3" /> Phone
                        </label>
                        <Input
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="+1 (555) 000-0000"
                          className="border-border/60 focus-visible:ring-primary/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Additional Notes
                        </label>
                        <Textarea
                          value={form.notes}
                          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                          placeholder="Delivery timeline, application details, special requirements…"
                          className="border-border/60 focus-visible:ring-primary/30 resize-none"
                          rows={3}
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={submitRfq.isPending}
                        className="w-full gap-2 bg-primary hover:bg-primary/90 mt-2"
                      >
                        {submitRfq.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {submitRfq.isPending ? "Submitting…" : "Submit Quote Request"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
