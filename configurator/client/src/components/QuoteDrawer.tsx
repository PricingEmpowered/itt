import { useQuote } from "@/contexts/QuoteContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  X, ShoppingCart, Trash2, Plus, Minus, ArrowRight,
  AlertTriangle, CheckCircle2, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export default function QuoteDrawer() {
  const { sessionToken, isCartOpen, closeCart, setCartCount } = useQuote();

  const { data: items = [], refetch } = trpc.quote.getItems.useQuery(
    { sessionToken },
    { enabled: isCartOpen }
  );

  useEffect(() => {
    setCartCount(items.length);
  }, [items.length, setCartCount]);

  const removeItem = trpc.quote.removeItem.useMutation({
    onSuccess: (updated) => { setCartCount(updated?.length ?? 0); refetch(); },
    onError: () => toast.error("Failed to remove item"),
  });

  const updateQty = trpc.quote.updateQuantity.useMutation({
    onSuccess: () => refetch(),
    onError: () => toast.error("Failed to update quantity"),
  });

  const clearAll = trpc.quote.clear.useMutation({
    onSuccess: () => { setCartCount(0); refetch(); toast.success("Quote list cleared"); },
  });

  const totalItems = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  const totalPrice = items.reduce((sum, item) => {
    const price = item.unitPrice ? parseFloat(item.unitPrice) : 0;
    return sum + price * (item.quantity ?? 1);
  }, 0);

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent className="w-full sm:max-w-[480px] flex flex-col p-0" side="right">
        <SheetHeader className="px-6 py-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Quote List
              {items.length > 0 && (
                <Badge variant="secondary" className="text-xs">{items.length} items</Badge>
              )}
            </SheetTitle>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearAll.mutate({ sessionToken })}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear all
              </Button>
            )}
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <Package className="w-12 h-12 text-muted-foreground/20" />
            <div>
              <div className="font-medium text-muted-foreground">Your quote list is empty</div>
              <div className="text-sm text-muted-foreground/70 mt-1">
                Configure a connector and add it to your quote list.
              </div>
            </div>
            <Button onClick={closeCart} variant="outline" size="sm" className="gap-2">
              <ArrowRight className="w-4 h-4" />
              Start Configuring
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-xl border p-4 transition-all duration-150",
                      item.isCustom
                        ? "border-amber-200 bg-amber-50/40"
                        : "border-border/60 bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-semibold text-foreground tracking-wider truncate">
                          {item.partNumber}
                        </div>
                        {item.description && item.description !== item.partNumber && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem.mutate({ id: item.id, sessionToken })}
                        className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {item.isCustom ? (
                        <Badge className="badge-custom gap-1 text-[10px]">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Custom
                        </Badge>
                      ) : (
                        <Badge className="badge-standard gap-1 text-[10px]">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Standard
                        </Badge>
                      )}
                      {item.family && (
                        <Badge variant="outline" className="text-[10px] font-mono">{item.family}</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Qty controls */}
                      <div className="flex items-center border border-border/60 rounded-md overflow-hidden">
                        <button
                          onClick={() => updateQty.mutate({ id: item.id, sessionToken, quantity: Math.max(1, (item.quantity ?? 1) - 1) })}
                          className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 py-1.5 text-xs font-medium min-w-[32px] text-center">
                          {item.quantity ?? 1}
                        </span>
                        <button
                          onClick={() => updateQty.mutate({ id: item.id, sessionToken, quantity: (item.quantity ?? 1) + 1 })}
                          className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Price */}
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
                          <div className="text-xs text-muted-foreground italic">RFQ</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t border-border/60 px-6 py-4 space-y-4 bg-muted/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{totalItems} unit{totalItems !== 1 ? "s" : ""}</span>
                {totalPrice > 0 ? (
                  <span className="font-semibold text-foreground">
                    Est. ${totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Price includes RFQ items</span>
                )}
              </div>
              <Link href="/quote" onClick={closeCart}>
                <Button className="w-full gap-2 bg-primary hover:bg-primary/90">
                  Review & Submit Quote
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
