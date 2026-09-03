import { useState, useEffect, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useQuote } from "@/contexts/QuoteContext";
import TopNav from "@/components/TopNav";
import QuoteDrawer from "@/components/QuoteDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ShoppingCart, CheckCircle2, AlertTriangle, Loader2,
  ChevronRight, Info, Copy, RotateCcw, Zap, Package, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FAMILIES, assemblePartNumber } from "@shared/connectorData";

type SelectionState = {
  family: string;
  style: string;
  material: string;
  size: string;
  insert: string;
  contact: string;
  suffix: string;
};

const EMPTY_SELECTION: SelectionState = {
  family: "", style: "", material: "", size: "", insert: "", contact: "", suffix: "",
};

export default function Configurator() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialFamily = params.get("family") || "";

  const [sel, setSel] = useState<SelectionState>({ ...EMPTY_SELECTION, family: initialFamily });
  const [livePartNumber, setLivePartNumber] = useState("");
  const [lookupResult, setLookupResult] = useState<null | {
    partNumber: string;
    isCustom: boolean;
    product: Record<string, unknown> | null;
    unitPrice: string | null;
    decoded: Record<string, string>;
    family: string;
    attributes: Record<string, string | undefined>;
  }>(null);
  const [quantity, setQuantity] = useState(1);

  const { sessionToken, setCartCount, openCart } = useQuote();

  // Fetch families
  const { data: families } = trpc.configurator.getFamilies.useQuery();

  // Fetch attributes for selected family
  const { data: attrs, isLoading: attrsLoading } = trpc.configurator.getAttributes.useQuery(
    { family: sel.family },
    { enabled: !!sel.family }
  );

  // Build & lookup mutation
  const buildMutation = trpc.configurator.buildAndLookup.useMutation();

  // Add to quote mutation
  const addItemMutation = trpc.quote.addItem.useMutation({
    onSuccess: (items) => {
      setCartCount(items?.length ?? 0);
      toast.success("Added to quote list", {
        description: livePartNumber,
        action: { label: "View", onClick: openCart },
      });
    },
    onError: () => toast.error("Failed to add item"),
  });

  // Fetch cart count on mount
  const { data: cartItems } = trpc.quote.getItems.useQuery({ sessionToken });
  useEffect(() => {
    if (cartItems) setCartCount(cartItems.length);
  }, [cartItems, setCartCount]);

  // Update live part number as selections change
  useEffect(() => {
    if (!sel.family) { setLivePartNumber(""); return; }
    const pn = assemblePartNumber(sel);
    setLivePartNumber(pn);
  }, [sel]);

  const handleFamilyChange = useCallback((family: string) => {
    setSel({ ...EMPTY_SELECTION, family });
    setLookupResult(null);
  }, []);

  const handleAttrChange = useCallback((key: keyof SelectionState, value: string) => {
    setSel((prev) => ({ ...prev, [key]: value }));
    setLookupResult(null);
  }, []);

  const handleLookup = useCallback(async () => {
    if (!sel.family) return;
    try {
      const result = await buildMutation.mutateAsync(sel);
      setLookupResult(result as typeof lookupResult);
    } catch {
      toast.error("Lookup failed");
    }
  }, [sel, buildMutation]);

  const handleReset = useCallback(() => {
    setSel(EMPTY_SELECTION);
    setLookupResult(null);
    setLivePartNumber("");
  }, []);

  const handleCopyPN = useCallback(() => {
    if (!livePartNumber) return;
    navigator.clipboard.writeText(livePartNumber);
    toast.success("Part number copied");
  }, [livePartNumber]);

  const handleAddToQuote = useCallback(async () => {
    if (!lookupResult) return;
    await addItemMutation.mutateAsync({
      sessionToken,
      partNumber: lookupResult.partNumber,
      isCustom: lookupResult.isCustom,
      family: lookupResult.family,
      series: (lookupResult.product as Record<string, string> | null)?.series,
      line: (lookupResult.product as Record<string, string> | null)?.line,
      description: (lookupResult.product as Record<string, string> | null)?.description ?? lookupResult.partNumber,
      attributes: Object.fromEntries(
        Object.entries(lookupResult.attributes).filter(([, v]) => v).map(([k, v]) => [k, v as string])
      ),
      unitPrice: lookupResult.unitPrice ?? undefined,
      quantity,
    });
  }, [lookupResult, sessionToken, addItemMutation, quantity]);

  const selectedFamily = families?.find((f) => f.id === sel.family);
  const hasMinSelection = !!sel.family && (!!sel.style || !!sel.size || !!sel.contact);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <QuoteDrawer />

      <div className="container py-8 flex-1">
        {/* Page header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span>Home</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Part Builder</span>
            {sel.family && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-primary font-medium">{sel.family}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Part Builder</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Select a connector family, configure attributes, and get instant part number assembly with catalog lookup and pricing.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Configuration Panel */}
          <div className="space-y-5">
            {/* Step 1: Family */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
                  <CardTitle className="text-base">Select Connector Family</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {(families ?? FAMILIES).map((fam) => (
                    <button
                      key={fam.id}
                      onClick={() => handleFamilyChange(fam.id)}
                      className={cn(
                        "relative flex flex-col items-start p-3 rounded-lg border text-left transition-all duration-150",
                        sel.family === fam.id
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                          : "border-border/60 hover:border-primary/40 hover:bg-accent/50"
                      )}
                    >
                      <div className="font-semibold text-sm">{fam.id}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                        {fam.label.replace(fam.id + " — ", "").replace(fam.id + " / ", "").split("—")[1]?.trim() || fam.standard}
                      </div>
                      {sel.family === fam.id && (
                        <CheckCircle2 className="absolute top-2 right-2 w-3.5 h-3.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Attributes */}
            {sel.family && (
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                    <CardTitle className="text-base">Configure Attributes</CardTitle>
                    {selectedFamily && (
                      <Badge variant="outline" className="ml-auto text-[10px] font-mono border-primary/30 text-primary">
                        {selectedFamily.standard}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {attrsLoading ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : attrs ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Shell Style */}
                      {attrs.styles.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shell Style</label>
                          <Select value={sel.style} onValueChange={(v) => handleAttrChange("style", v)}>
                            <SelectTrigger className="border-border/60 focus:ring-primary/30">
                              <SelectValue placeholder="Select style…" />
                            </SelectTrigger>
                            <SelectContent>
                              {attrs.styles.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className="font-mono text-xs text-primary mr-2">{opt.value}</span>
                                  <span className="text-xs">{opt.label.split("—")[1]?.trim() || opt.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Shell Material */}
                      {attrs.materials.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Material / Finish</label>
                          <Select value={sel.material} onValueChange={(v) => handleAttrChange("material", v)}>
                            <SelectTrigger className="border-border/60 focus:ring-primary/30">
                              <SelectValue placeholder="Select material…" />
                            </SelectTrigger>
                            <SelectContent>
                              {attrs.materials.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className="font-mono text-xs text-primary mr-2">{opt.value}</span>
                                  <span className="text-xs">{opt.label.split("—")[1]?.trim() || opt.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Shell Size */}
                      {attrs.sizes.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shell Size</label>
                          <Select value={sel.size} onValueChange={(v) => handleAttrChange("size", v)}>
                            <SelectTrigger className="border-border/60 focus:ring-primary/30">
                              <SelectValue placeholder="Select size…" />
                            </SelectTrigger>
                            <SelectContent>
                              {attrs.sizes.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className="font-mono text-xs text-primary mr-2">{opt.value}</span>
                                  <span className="text-xs">{opt.label.split("—")[1]?.trim() || opt.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Contact Type */}
                      {attrs.contacts.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Type</label>
                          <Select value={sel.contact} onValueChange={(v) => handleAttrChange("contact", v)}>
                            <SelectTrigger className="border-border/60 focus:ring-primary/30">
                              <SelectValue placeholder="Select contact…" />
                            </SelectTrigger>
                            <SelectContent>
                              {attrs.contacts.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className="font-mono text-xs text-primary mr-2">{opt.value}</span>
                                  <span className="text-xs">{opt.label.split("—")[1]?.trim() || opt.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Insert Arrangement (free text) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Insert Arrangement
                          <span className="ml-1 text-muted-foreground/60 normal-case font-normal">(optional)</span>
                        </label>
                        <Input
                          value={sel.insert}
                          onChange={(e) => handleAttrChange("insert", e.target.value.toUpperCase())}
                          placeholder="e.g. 35, 19, 11…"
                          className="font-mono text-sm border-border/60 focus-visible:ring-primary/30"
                        />
                      </div>

                      {/* Suffix */}
                      {attrs.suffixes && attrs.suffixes.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Service Class / Suffix
                            <span className="ml-1 text-muted-foreground/60 normal-case font-normal">(optional)</span>
                          </label>
                          <Select value={sel.suffix} onValueChange={(v) => handleAttrChange("suffix", v)}>
                            <SelectTrigger className="border-border/60 focus:ring-primary/30">
                              <SelectValue placeholder="Select suffix…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {attrs.suffixes.map((opt) => (
                                <SelectItem key={opt.value || "none-opt"} value={opt.value || "none"}>
                                  {opt.value ? (
                                    <>
                                      <span className="font-mono text-xs text-primary mr-2">{opt.value}</span>
                                      <span className="text-xs">{opt.label.split("—")[1]?.trim() || opt.label}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">None</span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Lookup */}
            {sel.family && (
              <div className="flex gap-3">
                <Button
                  onClick={handleLookup}
                  disabled={!hasMinSelection || buildMutation.isPending}
                  className="flex-1 gap-2 bg-primary hover:bg-primary/90"
                >
                  {buildMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {buildMutation.isPending ? "Looking up…" : "Build & Lookup Part Number"}
                </Button>
                <Button variant="outline" onClick={handleReset} className="gap-2 border-border/60">
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
              </div>
            )}
          </div>

          {/* Right: Part Number Display + Result */}
          <div className="space-y-4">
            {/* Live Part Number */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Part Number</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className={cn(
                    "min-h-[60px] flex items-center px-4 py-3 rounded-lg border-2 font-mono text-lg tracking-widest transition-all duration-200",
                    livePartNumber
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-dashed border-border/60 bg-muted/30 text-muted-foreground/40"
                  )}>
                    {livePartNumber || "—"}
                  </div>
                  {livePartNumber && (
                    <button
                      onClick={handleCopyPN}
                      className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="Copy part number"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {!sel.family && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Select a family to begin assembling a part number
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Lookup Result */}
            {lookupResult && (
              <Card className={cn(
                "border-2 shadow-sm transition-all duration-300",
                lookupResult.isCustom
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-green-200 bg-green-50/50"
              )}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Result</CardTitle>
                    {lookupResult.isCustom ? (
                      <Badge className="badge-custom gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Custom / Made-to-Order
                      </Badge>
                    ) : (
                      <Badge className="badge-standard gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Standard Catalog Part
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Part number */}
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Part Number</div>
                    <div className="font-mono text-base font-semibold text-foreground tracking-wider">
                      {lookupResult.partNumber}
                    </div>
                  </div>

                  {/* Product info */}
                  {lookupResult.product && (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Description</div>
                      <div className="text-sm font-medium text-foreground">
                        {(lookupResult.product as Record<string, string>).description}
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {(lookupResult.product as Record<string, string>).series && (
                          <Badge variant="outline" className="text-[10px]">
                            {(lookupResult.product as Record<string, string>).series}
                          </Badge>
                        )}
                        {(lookupResult.product as Record<string, string>).line && (
                          <Badge variant="outline" className="text-[10px]">
                            {(lookupResult.product as Record<string, string>).line}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {lookupResult.isCustom && (
                    <div className="bg-amber-100/60 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-amber-800">Custom Configuration</div>
                          <div className="text-xs text-amber-700 mt-0.5">
                            This combination is not in the standard catalog. It will be submitted as a made-to-order request with full attribute detail.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attribute breakdown */}
                  {Object.keys(lookupResult.decoded).length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Attribute Breakdown</div>
                      <div className="space-y-1.5">
                        {Object.entries(lookupResult.decoded).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="font-mono font-medium text-foreground">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Price */}
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {lookupResult.isCustom ? "Estimated Price (incl. custom upcharge)" : "Base Price"}
                    </div>
                    {lookupResult.unitPrice ? (
                      <div className="text-2xl font-bold text-foreground">
                        ${parseFloat(lookupResult.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/ ea</span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">Price on request — RFQ required</div>
                    )}
                  </div>

                  {/* Quantity + Add to Quote */}
                  <div className="flex gap-2 items-center">
                    <div className="flex items-center border border-border/60 rounded-md overflow-hidden">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm"
                      >−</button>
                      <span className="px-3 py-2 text-sm font-medium min-w-[40px] text-center">{quantity}</span>
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm"
                      >+</button>
                    </div>
                    <Button
                      onClick={handleAddToQuote}
                      disabled={addItemMutation.isPending}
                      className="flex-1 gap-2 bg-primary hover:bg-primary/90"
                    >
                      {addItemMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                      Add to Quote
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hint when no lookup yet */}
            {!lookupResult && sel.family && (
              <Card className="border-dashed border-border/60 bg-muted/20">
                <CardContent className="py-8 flex flex-col items-center text-center gap-3">
                  <Package className="w-10 h-10 text-muted-foreground/30" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Configure & Lookup</div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Select attributes and click "Build & Lookup" to identify the part and get pricing.
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Family info card */}
            {sel.family && selectedFamily && (
              <Card className="border-border/60 bg-muted/20">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">{selectedFamily.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Standard: {selectedFamily.standard}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
