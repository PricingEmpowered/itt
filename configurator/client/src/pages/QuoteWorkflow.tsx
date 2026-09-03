import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Building2, User, ChevronRight, ChevronDown, Search, Plus, Trash2,
  CheckCircle2, AlertCircle, Clock, Zap, Settings2, Wrench,
  ArrowLeft, ArrowRight, Send, TrendingUp, TrendingDown, Minus,
  Info, Package, FileText, DollarSign, Target, ShieldCheck, Layers, Percent, Trophy, Crosshair, Shield
} from "lucide-react";
import { X as XIcon, Swords } from "lucide-react";
import { ANALYTICS_INDUSTRIES } from "@/lib/analyticsConstants";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Cell,
} from "recharts";
import ConfiguratorModal, { type ConfiguratorResult } from "@/components/ConfiguratorModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type ItemType = "existing" | "configured" | "custom";
type Complexity = "Low" | "Medium" | "High" | "Very High";

interface LineItem {
  id?: number;
  tempId: string;
  itemType: ItemType;
  // Existing / Configured
  partNumber?: string;
  description?: string;
  family?: string;
  series?: string;
  isStandardCatalog?: boolean;
  configuredAttributes?: Record<string, string>;
  // Custom
  customDescription?: string;
  customBaseFamily?: string;
  customComplexity?: Complexity;
  customMoq?: number;
  customLeadTimeDays?: number;
  customCost?: number;
  // Pricing
  listPrice?: number;
  targetPrice?: number;
  floorPrice?: number;
  quotedPrice?: number;
  quantity: number;
  pricingRationale?: string;
  priceConfidence?: "High" | "Medium" | "Low";
  selectedTier?: "Aggressive" | "Target" | "Conservative";
  tiers?: Array<{ label: "Aggressive" | "Target" | "Conservative"; price: number; discountFromList: number; marginPct: number; winProbability: number; winLabel: string; rationale: string }>;
  appliedRules?: Array<{ id: number; name: string; ruleType: string; description: string }>;
  // UI state
  pricingLoaded?: boolean;
  lookupLoading?: boolean;
  lookupResult?: { found: boolean; description?: string; series?: string; family?: string } | null;
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {[1, 2].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
            s === step ? "bg-primary text-primary-foreground shadow-md" :
            s < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
          </div>
          <span className={`text-sm font-medium ${s === step ? "text-foreground" : "text-muted-foreground"}`}>
            {s === 1 ? "Customer & Deal" : "Line Items & Pricing"}
          </span>
          {s < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ level }: { level?: "High" | "Medium" | "Low" }) {
  if (!level) return null;
  const cfg = {
    High: { color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: <ShieldCheck className="w-3 h-3" /> },
    Medium: { color: "bg-amber-100 text-amber-800 border-amber-200", icon: <AlertCircle className="w-3 h-3" /> },
    Low: { color: "bg-red-100 text-red-800 border-red-200", icon: <Info className="w-3 h-3" /> },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon} {level} Confidence
    </span>
  );
}

// ─── Item type icon ───────────────────────────────────────────────────────────
function ItemTypeIcon({ type }: { type: ItemType }) {
  if (type === "existing") return <Package className="w-4 h-4 text-blue-500" />;
  if (type === "configured") return <Settings2 className="w-4 h-4 text-violet-500" />;
  return <Wrench className="w-4 h-4 text-orange-500" />;
}

// ─── Pricing tiers panel (shared by Existing, Configured, Custom) ────────────
function PricingTiersPanel({
  item, priceQuery, quotedPrice, setQuotedPrice, lineTotal, discountPct, onUpdate,
}: {
  item: LineItem;
  priceQuery: { isLoading: boolean };
  quotedPrice: string;
  setQuotedPrice: (v: string) => void;
  lineTotal: number;
  discountPct: number;
  onUpdate: (tempId: string, patch: Partial<LineItem>) => void;
}) {
  const tierConfig = {
    Aggressive: {
      icon: <Trophy className="w-4 h-4" />,
      color: "border-emerald-300 bg-emerald-50 hover:bg-emerald-100",
      selectedColor: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-400 ring-offset-1",
      labelColor: "text-emerald-700",
      barColor: "bg-emerald-500",
      desc: "Max win rate",
    },
    Target: {
      icon: <Crosshair className="w-4 h-4" />,
      color: "border-primary/30 bg-primary/5 hover:bg-primary/10",
      selectedColor: "border-primary bg-primary/10 ring-2 ring-primary ring-offset-1",
      labelColor: "text-primary",
      barColor: "bg-primary",
      desc: "Balanced",
    },
    Conservative: {
      icon: <Shield className="w-4 h-4" />,
      color: "border-amber-300 bg-amber-50 hover:bg-amber-100",
      selectedColor: "border-amber-500 bg-amber-100 ring-2 ring-amber-400 ring-offset-1",
      labelColor: "text-amber-700",
      barColor: "bg-amber-500",
      desc: "Max margin",
    },
  } as const;

  const handleTierSelect = (tier: "Aggressive" | "Target" | "Conservative") => {
    const t = item.tiers?.find(t => t.label === tier);
    if (!t) return;
    const priceStr = String(t.price);
    setQuotedPrice(priceStr);
    onUpdate(item.tempId, { selectedTier: tier, quotedPrice: t.price });
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Price Recommendations</span>
          {item.listPrice != null && (
            <span className="text-xs text-muted-foreground ml-1">List: <span className="font-mono font-semibold text-foreground">${item.listPrice.toFixed(2)}</span></span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge level={item.priceConfidence} />
          {item.floorPrice != null && (
            <span className="text-xs text-muted-foreground">Floor: <span className="font-mono">${item.floorPrice.toFixed(2)}</span></span>
          )}
        </div>
      </div>

      {/* Three tier cards */}
      {priceQuery.isLoading ? (
        <div className="text-sm text-muted-foreground animate-pulse py-2">Computing price recommendations…</div>
      ) : item.tiers && item.tiers.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {item.tiers.map((tier) => {
            const cfg = tierConfig[tier.label];
            const isSelected = (item.selectedTier ?? "Target") === tier.label;
            return (
              <button
                key={tier.label}
                type="button"
                onClick={() => handleTierSelect(tier.label)}
                className={`rounded-xl border-2 p-3 text-left transition-all duration-150 cursor-pointer ${
                  isSelected ? cfg.selectedColor : cfg.color
                }`}
              >
                {/* Tier label + icon */}
                <div className={`flex items-center gap-1.5 font-semibold text-sm mb-0.5 ${cfg.labelColor}`}>
                  {cfg.icon} {tier.label}
                </div>
                <div className="text-xs text-muted-foreground mb-2">{cfg.desc}</div>

                {/* Price */}
                <div className="font-mono text-xl font-bold text-foreground mb-1">
                  ${tier.price.toFixed(2)}
                </div>

                {/* Discount & margin row */}
                <div className="flex gap-2 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" />
                    {tier.discountFromList > 0 ? `${tier.discountFromList.toFixed(1)}% off list` : "At list"}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Percent className="w-3 h-3" />
                    {tier.marginPct.toFixed(1)}% margin
                  </span>
                </div>

                {/* Win probability bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Win probability</span>
                    <span className={`font-semibold ${cfg.labelColor}`}>{tier.winProbability}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${cfg.barColor}`}
                      style={{ width: `${tier.winProbability}%` }}
                    />
                  </div>
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div className={`mt-2 text-xs font-semibold flex items-center gap-1 ${cfg.labelColor}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Quoted price + line total */}
      <div className="flex items-end gap-3 pt-1 border-t border-border/40">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">Quoted Price <span className="text-muted-foreground/70">(override)</span></Label>
          <Input
            type="number"
            step="0.01"
            value={quotedPrice}
            onChange={e => {
              setQuotedPrice(e.target.value);
              onUpdate(item.tempId, { quotedPrice: parseFloat(e.target.value) || undefined, selectedTier: undefined });
            }}
            className={`font-mono font-semibold ${
              item.floorPrice && parseFloat(quotedPrice) < item.floorPrice ? "border-red-400 text-red-600" : ""
            }`}
            placeholder={item.targetPrice?.toFixed(2)}
          />
          {item.floorPrice && parseFloat(quotedPrice) < item.floorPrice && (
            <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Below margin floor</p>
          )}
        </div>
        <div className="text-right pb-1">
          <div className="text-xs text-muted-foreground">Line Total</div>
          <div className="text-xl font-bold text-foreground">${lineTotal.toFixed(2)}</div>
          {discountPct > 0 && (
            <div className="text-xs text-muted-foreground">{discountPct.toFixed(1)}% from list</div>
          )}
        </div>
      </div>

      {/* Rules Applied */}
      {item.appliedRules && item.appliedRules.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-amber-700 hover:text-amber-900 flex items-center gap-1 font-medium">
            <Shield className="w-3 h-3" /> {item.appliedRules.length} pricing rule{item.appliedRules.length > 1 ? "s" : ""} applied
          </summary>
          <div className="mt-2 space-y-1">
            {item.appliedRules.map((rule) => (
              <div key={rule.id} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                <Shield className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-amber-800">{rule.name}</span>
                  <span className="text-amber-700 ml-1">— {rule.description}</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Rationale */}
      {item.pricingRationale && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground flex items-center gap-1"><Info className="w-3 h-3" /> Pricing rationale</summary>
          <p className="mt-1 pl-4 border-l-2 border-muted">{item.pricingRationale}</p>
        </details>
      )}
    </div>
  );
}

// ─── Part number lookup panel ─────────────────────────────────────────────────
function PartLookupPanel({
  item, token, workflow, onUpdate, openConfigurator,
}: {
  item: LineItem;
  token: string;
  workflow: { customerTier?: string; customerChannel?: string; customerPriceIndex?: number; customerMarginIndex?: number; dealType?: string; urgency?: string; targetMarginPct?: number } | null;
  onUpdate: (tempId: string, patch: Partial<LineItem>) => void;
  openConfigurator: () => void;
}) {
  const [pn, setPn] = useState(item.partNumber ?? "");
  const [qty, setQty] = useState(String(item.quantity ?? 1));
  const [quotedPrice, setQuotedPrice] = useState(item.quotedPrice != null ? String(item.quotedPrice) : "");
  // Typeahead state (only for existing items)
  const [typeaheadInput, setTypeaheadInput] = useState(""); // raw input, updates immediately
  const [typeaheadQuery, setTypeaheadQuery] = useState(""); // debounced, drives the query
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce: update query 250ms after input stops
  useEffect(() => {
    const timer = setTimeout(() => setTypeaheadQuery(typeaheadInput), 250);
    return () => clearTimeout(timer);
  }, [typeaheadInput]);

  // Debounced typeahead search
  const typeaheadResults = trpc.configurator.searchPartNumbers.useQuery(
    { query: typeaheadQuery, limit: 12 },
    { enabled: item.itemType === "existing" && typeaheadQuery.trim().length >= 2 }
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const lookupQuery = trpc.configurator.lookupPart.useQuery(
    { partNumber: pn.trim() },
    { enabled: false }
  );

  const priceQuery = trpc.quoteWorkflow.computeTargetPrice.useQuery(
    {
      partNumber: pn.trim() || undefined,
      family: item.family,
      isStandardCatalog: item.isStandardCatalog,
      itemType: item.itemType,
      customerTier: workflow?.customerTier ?? undefined,
      customerChannel: workflow?.customerChannel ?? undefined,
      customerPriceIndex: workflow?.customerPriceIndex ?? undefined,
      customerMarginIndex: workflow?.customerMarginIndex ?? undefined,
      dealType: workflow?.dealType ?? undefined,
      urgency: workflow?.urgency ?? undefined,
      targetMarginPct: workflow?.targetMarginPct ?? undefined,
      quantity: parseInt(qty) || 1,
    },
    { enabled: item.pricingLoaded === true }
  );

  const handleLookup = async () => {
    if (!pn.trim()) return;
    onUpdate(item.tempId, { lookupLoading: true });
    const res = await lookupQuery.refetch();
    const data = res.data;
    if (data) {
      onUpdate(item.tempId, {
        lookupLoading: false,
        lookupResult: { found: true, description: data.description ?? undefined, series: data.series ?? undefined, family: data.family ?? undefined },
        partNumber: pn.trim(),
        description: data.description ?? undefined,
        family: data.family ?? undefined,
        series: data.series ?? undefined,
        isStandardCatalog: true,
        pricingLoaded: true,
      });
    } else {
      onUpdate(item.tempId, { lookupLoading: false, lookupResult: { found: false }, isStandardCatalog: false, pricingLoaded: true });
    }
  };

    useEffect(() => {
    if (priceQuery.data && item.pricingLoaded) {
      const p = priceQuery.data;
      // Default selected tier is "Target"
      const defaultTier = p.tiers?.find(t => t.label === "Target");
      onUpdate(item.tempId, {
        listPrice: p.listPrice,
        targetPrice: p.targetPrice,
        floorPrice: p.floorPrice,
        pricingRationale: p.rationale,
        priceConfidence: p.confidence,
        tiers: p.tiers,
        appliedRules: (p as any).appliedRules ?? [],
        selectedTier: item.selectedTier ?? "Target",
        quotedPrice: item.quotedPrice ?? defaultTier?.price ?? p.targetPrice,
      });
      if (!quotedPrice) setQuotedPrice(String(defaultTier?.price ?? p.targetPrice));
    }
  }, [priceQuery.data]);
  const qtyNum = parseInt(qty) || 1;
  const qp = parseFloat(quotedPrice) || item.quotedPrice || 0;
  const lineTotal = qp * qtyNum;
  const discountPct = item.listPrice ? ((item.listPrice - qp) / item.listPrice * 100) : 0;
  // Handle result from ConfiguratorModal
  const handleConfiguratorConfirm = (result: ConfiguratorResult) => {
    const newPn = result.partNumber;
    setPn(newPn);
    onUpdate(item.tempId, {
      partNumber: newPn,
      description: result.description,
      family: result.family,
      isStandardCatalog: !result.isCustom,
      configuredAttributes: result.attributes,
      lookupResult: {
        found: !result.isCustom,
        description: result.description,
        series: result.series,
        family: result.family,
      },
      pricingLoaded: true,
    });
  };

  return (
    <div className="space-y-4">
      {/* Part number field — for configured items, clicking opens the modal */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">
            {item.itemType === "configured" ? "Configured Part Number" : "Part Number"}
          </Label>
          {item.itemType === "configured" ? (
            <button
              type="button"
              onClick={() => openConfigurator()}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border text-left transition-all duration-150 font-mono text-sm ${
                pn
                  ? "border-violet-300 bg-violet-50 text-foreground hover:bg-violet-100"
                  : "border-dashed border-violet-300 bg-violet-50/50 text-violet-500 hover:bg-violet-100"
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              <span className={pn ? "font-semibold tracking-wider" : "font-normal"}>
                {pn || "Click to open configurator…"}
              </span>
              {pn && <span className="ml-auto text-xs text-violet-500 font-sans font-normal">Edit</span>}
            </button>
          ) : (
            // Typeahead autocomplete for existing items
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={pn}
                  onChange={e => {
                    const val = e.target.value;
                    setPn(val);
                    setTypeaheadInput(val); // drives debounced query
                    setDropdownOpen(val.trim().length >= 2);
                    setHighlightedIdx(-1);
                    // Clear pricing when part number changes
                    if (item.pricingLoaded) onUpdate(item.tempId, { pricingLoaded: false, lookupResult: null });
                  }}
                  onKeyDown={e => {
                    const results = typeaheadResults.data ?? [];
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedIdx(i => Math.min(i + 1, results.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedIdx(i => Math.max(i - 1, 0));
                    } else if (e.key === "Enter") {
                      if (highlightedIdx >= 0 && results[highlightedIdx]) {
                        const hit = results[highlightedIdx];
                        const selected = hit.globalPn ?? hit.description;
                        setPn(selected);
                        setTypeaheadQuery("");
                        setDropdownOpen(false);
                        setHighlightedIdx(-1);
                        // Trigger lookup immediately
                        onUpdate(item.tempId, {
                          partNumber: selected,
                          description: hit.description ?? undefined,
                          family: hit.family ?? undefined,
                          series: hit.series ?? undefined,
                          isStandardCatalog: true,
                          lookupResult: { found: true, description: hit.description ?? undefined, series: hit.series ?? undefined, family: hit.family ?? undefined },
                          pricingLoaded: true,
                        });
                      } else {
                        handleLookup();
                      }
                    } else if (e.key === "Escape") {
                      setDropdownOpen(false);
                    }
                  }}
                  onFocus={() => {
                    if (pn.trim().length >= 2) setDropdownOpen(true);
                  }}
                  placeholder="Type part number to search…"
                  className="font-mono text-sm pr-8"
                  autoComplete="off"
                />
                {typeaheadResults.isFetching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {/* Dropdown */}
              {dropdownOpen && pn.trim().length >= 2 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                  {typeaheadResults.isFetching ? (
                    <div className="px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Searching catalog…
                    </div>
                  ) : (typeaheadResults.data?.length ?? 0) === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-muted-foreground">
                      No catalog matches — press Enter or Look Up to proceed as custom
                    </div>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {(typeaheadResults.data ?? []).map((hit, idx) => (
                        <li
                          key={hit.id}
                          onMouseDown={e => {
                            e.preventDefault();
                            const selected = hit.globalPn ?? hit.description;
                            setPn(selected);
                            setTypeaheadQuery("");
                            setDropdownOpen(false);
                            setHighlightedIdx(-1);
                            onUpdate(item.tempId, {
                              partNumber: selected,
                              description: hit.description ?? undefined,
                              family: hit.family ?? undefined,
                              series: hit.series ?? undefined,
                              isStandardCatalog: true,
                              lookupResult: { found: true, description: hit.description ?? undefined, series: hit.series ?? undefined, family: hit.family ?? undefined },
                              pricingLoaded: true,
                            });
                          }}
                          onMouseEnter={() => setHighlightedIdx(idx)}
                          className={`px-3 py-2 cursor-pointer flex items-start gap-3 transition-colors ${
                            highlightedIdx === idx ? "bg-accent" : "hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm font-semibold text-foreground truncate">
                              {hit.globalPn ?? "—"}
                            </div>
                            {hit.description && (
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {hit.description}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {hit.family && (
                              <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {hit.family}
                              </span>
                            )}
                            {hit.series && (
                              <span className="text-[10px] text-muted-foreground">{hit.series}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="w-24">
          <Label className="text-xs text-muted-foreground mb-1 block">Qty</Label>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={e => { setQty(e.target.value); onUpdate(item.tempId, { quantity: parseInt(e.target.value) || 1, pricingLoaded: false }); }}
            className="text-center"
          />
        </div>
        {item.itemType !== "configured" && (
          <div className="flex items-end">
            <Button onClick={handleLookup} disabled={!pn.trim() || item.lookupLoading} size="sm" className="gap-1">
              <Search className="w-3.5 h-3.5" />
              {item.lookupLoading ? "..." : "Look Up"}
            </Button>
          </div>
        )}
      </div>

      {/* Lookup result */}
      {item.lookupResult && (
        <div className={`rounded-lg border p-3 text-sm ${item.lookupResult.found ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-2 font-medium mb-1">
            {item.lookupResult.found
              ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-emerald-800">Standard Catalog Part</span></>
              : <><AlertCircle className="w-4 h-4 text-amber-600" /><span className="text-amber-800">Non-Catalog / Custom Configuration</span></>
            }
          </div>
          {item.lookupResult.description && <p className="text-muted-foreground">{item.lookupResult.description}</p>}
          {item.lookupResult.series && <p className="text-xs text-muted-foreground mt-0.5">Series: {item.lookupResult.series} · Family: {item.lookupResult.family}</p>}
        </div>
      )}

            {/* Pricing panel */}
      {item.pricingLoaded && (
        <PricingTiersPanel
          item={item}
          priceQuery={priceQuery}
          quotedPrice={quotedPrice}
          setQuotedPrice={setQuotedPrice}
          lineTotal={lineTotal}
          discountPct={discountPct}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

// ─── Custom item panel ────────────────────────────────────────────────────────
function CustomItemPanel({
  item, workflow, onUpdate,
}: {
  item: LineItem;
  workflow: { customerTier?: string; customerChannel?: string; customerPriceIndex?: number; dealType?: string; urgency?: string; targetMarginPct?: number } | null;
  onUpdate: (tempId: string, patch: Partial<LineItem>) => void;
}) {
  const [qty, setQty] = useState(String(item.quantity ?? 1));
  const [quotedPrice, setQuotedPrice] = useState(item.quotedPrice != null ? String(item.quotedPrice) : "");

  const FAMILIES = ["KJB", "KPT", "CIR", "FRCIR", "CA", "MS", "DPX", "DBM", "MKJ", "VBN", "VS", "VPT", "BKAD", "TKJ"];
  const COMPLEXITIES: Complexity[] = ["Low", "Medium", "High", "Very High"];

  const priceQuery = trpc.quoteWorkflow.computeTargetPrice.useQuery(
    {
      family: item.customBaseFamily ?? "CIR",
      itemType: "custom",
      customComplexity: item.customComplexity ?? "Medium",
      customMoq: item.customMoq ?? 1,
      customCost: item.customCost && item.customCost > 0 ? item.customCost : undefined,
      customerTier: workflow?.customerTier ?? undefined,
      customerChannel: workflow?.customerChannel ?? undefined,
      customerPriceIndex: workflow?.customerPriceIndex ?? undefined,
      dealType: workflow?.dealType ?? undefined,
      urgency: workflow?.urgency ?? undefined,
      targetMarginPct: workflow?.targetMarginPct ?? undefined,
      quantity: parseInt(qty) || 1,
    },
    { enabled: !!(item.customBaseFamily) }
  );

    useEffect(() => {
    if (priceQuery.data) {
      const p = priceQuery.data;
      const defaultTier = p.tiers?.find(t => t.label === "Target");
      onUpdate(item.tempId, {
        listPrice: p.listPrice,
        targetPrice: p.targetPrice,
        floorPrice: p.floorPrice,
        pricingRationale: p.rationale,
        priceConfidence: p.confidence,
        tiers: p.tiers,
        appliedRules: (p as any).appliedRules ?? [],
        selectedTier: item.selectedTier ?? "Target",
        quotedPrice: item.quotedPrice ?? defaultTier?.price ?? p.targetPrice,
      });
      if (!quotedPrice) setQuotedPrice(String(defaultTier?.price ?? p.targetPrice));
    }
  }, [priceQuery.data]);
  const qp = parseFloat(quotedPrice) || item.quotedPrice || 0;
  const qtyNum = parseInt(qty) || 1;
  const lineTotal = qp * qtyNum;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Base Connector Family</Label>
          <Select value={item.customBaseFamily ?? ""} onValueChange={v => onUpdate(item.tempId, { customBaseFamily: v })}>
            <SelectTrigger><SelectValue placeholder="Select family…" /></SelectTrigger>
            <SelectContent>
              {FAMILIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Complexity</Label>
          <Select value={item.customComplexity ?? "Medium"} onValueChange={v => onUpdate(item.tempId, { customComplexity: v as Complexity })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPLEXITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">MOQ</Label>
          <Input type="number" min={1} value={item.customMoq ?? 1}
            onChange={e => onUpdate(item.tempId, { customMoq: parseInt(e.target.value) || 1 })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Lead Time (days)</Label>
          <Input type="number" min={1} value={item.customLeadTimeDays ?? 90}
            onChange={e => onUpdate(item.tempId, { customLeadTimeDays: parseInt(e.target.value) || 90 })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Estimated Cost <span className="text-orange-600 font-semibold">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              type="number" min={0} step="0.01"
              className="pl-6 font-mono"
              value={item.customCost != null ? String(item.customCost) : ""}
              onChange={e => onUpdate(item.tempId, { customCost: parseFloat(e.target.value) || undefined })}
              placeholder="0.00"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Used to compute real gross margin on each price tier</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Quantity</Label>
          <Input type="number" min={1} value={qty}
            onChange={e => { setQty(e.target.value); onUpdate(item.tempId, { quantity: parseInt(e.target.value) || 1 }); }} />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Custom Description / Modification Notes</Label>
        <Textarea value={item.customDescription ?? ""} rows={2}
          onChange={e => onUpdate(item.tempId, { customDescription: e.target.value })}
          placeholder="Describe the custom modification, special plating, non-standard insert, etc." />
      </div>

      {/* Complexity guide */}
      <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
        <p className="font-medium text-foreground mb-1.5">Complexity Guide</p>
        {[
          { level: "Low", note: "Minor modification (special plating, non-standard color) — +15%" },
          { level: "Medium", note: "Modified insert or shell geometry — +35%" },
          { level: "High", note: "Non-standard materials + modified tooling — +65%" },
          { level: "Very High", note: "Full custom design, new tooling required — +110%" },
        ].map(r => (
          <div key={r.level} className={`flex gap-2 ${r.level === (item.customComplexity ?? "Medium") ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            <span className="w-16 shrink-0">{r.level}</span><span>{r.note}</span>
          </div>
        ))}
      </div>

      {/* Pricing */}
      {item.customBaseFamily && (
        <PricingTiersPanel
          item={item}
          priceQuery={priceQuery}
          quotedPrice={quotedPrice}
          setQuotedPrice={setQuotedPrice}
          lineTotal={lineTotal}
          discountPct={item.listPrice ? ((item.listPrice - (parseFloat(quotedPrice) || 0)) / item.listPrice * 100) : 0}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

// ─── Quote Intelligence Panel ───────────────────────────────────────────────
function QuoteIntelligencePanel({
  workflow, lineItems, totalQuoted, totalDiscount,
}: {
  workflow: { customerTier?: string | null; customerChannel?: string | null; dealType?: string | null; urgency?: string | null } | null;
  lineItems: LineItem[];
  totalQuoted: number;
  totalDiscount: number;
}) {
  // Derive dominant family from line items
  const familyCounts: Record<string, number> = {};
  lineItems.forEach(it => { const f = it.family ?? it.customBaseFamily; if (f) familyCounts[f] = (familyCounts[f] ?? 0) + 1; });
  const dominantFamily = Object.entries(familyCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const { data: intel, isLoading } = trpc.quoteWorkflow.getQuoteIntelligence.useQuery(
    {
      customerTier: workflow?.customerTier ?? undefined,
      channel: workflow?.customerChannel ?? undefined,
      family: dominantFamily,
      avgDiscount: totalDiscount,
      totalValue: totalQuoted,
      dealType: workflow?.dealType ?? undefined,
      urgency: workflow?.urgency ?? undefined,
      lineCount: lineItems.length,
    },
    { enabled: lineItems.length > 0 && totalQuoted > 0 }
  );

  if (!lineItems.length || totalQuoted === 0) return null;

  const winColor = intel?.winLabel === "High" ? "text-green-700" : intel?.winLabel === "Moderate" ? "text-amber-700" : "text-red-700";
  const winBg = intel?.winLabel === "High" ? "bg-green-50 border-green-200" : intel?.winLabel === "Moderate" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const winBarColor = intel?.winLabel === "High" ? "bg-green-500" : intel?.winLabel === "Moderate" ? "bg-amber-500" : "bg-red-500";

  // Scatter: combine historical cloud + current quote point
  const historicalPoints = (intel?.scatterPoints ?? []).map(p => ({ ...p, type: "historical" }));
  const currentPoint = intel?.currentQuotePoint ? [{ ...intel.currentQuotePoint, type: "current" }] : [];

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Quote Intelligence</h3>
        <span className="text-xs text-muted-foreground ml-1">
          {dominantFamily ? `${dominantFamily} · ` : ""}{workflow?.customerTier ?? ""} {workflow?.customerChannel ?? ""}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-16 bg-muted/40 rounded-lg animate-pulse" />
          <div className="h-32 bg-muted/40 rounded-lg animate-pulse" />
          <div className="h-48 bg-muted/40 rounded-lg animate-pulse" />
        </div>
      ) : intel ? (
        <>
          {/* Win Probability Gauge */}
          <div className={`rounded-lg border p-4 ${winBg}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${winColor}`} />
                <span className={`font-semibold text-sm ${winColor}`}>Win Probability — {intel.winLabel}</span>
              </div>
              <span className={`text-2xl font-bold ${winColor}`}>{intel.overallWinProbability}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/60 overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${winBarColor}`}
                style={{ width: `${intel.overallWinProbability}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{intel.winRationale}</span>
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-muted-foreground">Segment avg disc: <span className="font-semibold text-foreground">{intel.benchmarkAvgDiscount}%</span></span>
              <span className="text-muted-foreground">Segment win rate: <span className="font-semibold text-foreground">{intel.benchmarkWinRate}%</span></span>
            </div>
          </div>

          {/* Peer Comps */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">3 Closest Peer Deals</span>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/40">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Deal</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Discount</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Volume</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">vs. This</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.peerComps.map((peer, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[160px]">{peer.label}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{peer.discountPct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right text-xs">${(peer.volume / 1000).toFixed(0)}K</td>
                      <td className="px-3 py-2 text-right text-xs">
                        <span className={peer.delta > 0 ? "text-red-600" : peer.delta < 0 ? "text-green-600" : "text-muted-foreground"}>
                          {peer.delta > 0 ? "+" : ""}{peer.delta.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className={`text-[10px] ${peer.won ? "border-green-300 text-green-700 bg-green-50" : "border-red-300 text-red-700 bg-red-50"}`}>
                          {peer.won ? "Won" : "Lost"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scatter Plot */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Discount vs. Volume — Historical Deals</span>
              <span className="text-[10px] text-muted-foreground ml-1">({workflow?.customerTier ?? "All"} · {dominantFamily ?? "All families"})</span>
            </div>
            <div className="flex items-center gap-4 mb-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Won</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Lost</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary border-2 border-white shadow inline-block" /> This Quote</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 5, right: 15, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="discountPct" name="Discount %" type="number"
                  tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`}
                  label={{ value: "Discount from List %", position: "insideBottom", offset: -10, fontSize: 10 }}
                />
                <YAxis
                  dataKey="volume" name="Volume" type="number"
                  tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
                  label={{ value: "Deal Volume ($)", angle: -90, position: "insideLeft", fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(val: number, name: string) => [
                    name === "discountPct" ? `${val.toFixed(1)}%` : `$${(val as number / 1000).toFixed(0)}K`,
                    name === "discountPct" ? "Discount" : "Volume",
                  ]}
                />
                {/* Benchmark avg discount reference line */}
                <ReferenceLine x={intel.benchmarkAvgDiscount} stroke="hsl(var(--primary))" strokeDasharray="4 2" label={{ value: "Avg", position: "top", fontSize: 9, fill: "hsl(var(--primary))" }} />
                {/* Historical won deals */}
                <Scatter
                  name="Won" data={historicalPoints.filter(p => p.won)}
                  fill="#22c55e" fillOpacity={0.65} r={4}
                />
                {/* Historical lost deals */}
                <Scatter
                  name="Lost" data={historicalPoints.filter(p => !p.won)}
                  fill="#f87171" fillOpacity={0.55} r={4}
                />
                {/* Current quote */}
                <Scatter
                  name="This Quote" data={currentPoint}
                  fill="hsl(var(--primary))" fillOpacity={1} r={7}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─── Line item row ────────────────────────────────────────────────────────────
function LineItemRow({
  item, index, token, workflow, onUpdate, onDelete, openConfigurator,
}: {
  item: LineItem; index: number; token: string;
  workflow: any; onUpdate: (tempId: string, patch: Partial<LineItem>) => void; onDelete: (tempId: string) => void;
  openConfigurator: (tempId: string, family?: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const ITEM_TYPES: { value: ItemType; label: string; desc: string; color: string }[] = [
    { value: "existing", label: "Existing", desc: "Standard catalog part — enter part number", color: "text-blue-600 bg-blue-50 border-blue-200" },
    { value: "configured", label: "Configured", desc: "Build via connector configurator", color: "text-violet-600 bg-violet-50 border-violet-200" },
    { value: "custom", label: "Custom", desc: "Non-standard / made-to-order", color: "text-orange-600 bg-orange-50 border-orange-200" },
  ];

  const lineTotal = (item.quotedPrice ?? item.targetPrice ?? 0) * item.quantity;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
          {index + 1}
        </div>
        <ItemTypeIcon type={item.itemType} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium truncate">
              {item.partNumber || item.customDescription?.slice(0, 40) || "New item"}
            </span>
            {item.isStandardCatalog && <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-xs">Catalog</Badge>}
            {item.itemType === "custom" && <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 text-xs">Custom</Badge>}
          </div>
          {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
        </div>
        <div className="text-right shrink-0">
          {lineTotal > 0 && <div className="text-sm font-bold">${lineTotal.toFixed(2)}</div>}
          <div className="text-xs text-muted-foreground">Qty {item.quantity}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500 shrink-0"
          onClick={e => { e.stopPropagation(); onDelete(item.tempId); }}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t bg-background/50">
          {/* Item type selector */}
          <div className="grid grid-cols-3 gap-2 mb-4 mt-3">
            {ITEM_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => onUpdate(item.tempId, { itemType: t.value, pricingLoaded: false, lookupResult: null })}
                className={`rounded-lg border p-2.5 text-left transition-all ${item.itemType === t.value ? t.color + " ring-1 ring-current" : "border-border hover:border-muted-foreground/30"}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ItemTypeIcon type={t.value} />
                  <span className="text-xs font-semibold">{t.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-tight">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Content by type */}
          {(item.itemType === "existing" || item.itemType === "configured") && (
            <PartLookupPanel item={item} token={token} workflow={workflow} onUpdate={onUpdate} openConfigurator={() => openConfigurator(item.tempId, item.family)} />
          )}
          {item.itemType === "custom" && (
            <CustomItemPanel item={item} workflow={workflow} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function QuoteWorkflow() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [workflowToken, setWorkflowToken] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Page-level configurator modal state (lifted from PartLookupPanel to avoid nested portal issues)
  const [configuratorModalOpen, setConfiguratorModalOpen] = useState(false);
  const [configuratorTargetTempId, setConfiguratorTargetTempId] = useState<string | null>(null);
  const [configuratorInitialFamily, setConfiguratorInitialFamily] = useState<string | undefined>(undefined);

  // Customer form state
  const [form, setForm] = useState({
    customerName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    customerTier: "Mid" as "Enterprise" | "Large" | "Mid" | "SMB",
    customerRegion: "",
    customerChannel: "OEM" as "OEM" | "Distribution" | "Intercompany",
    customerIndustry: "",
    dealType: "New Business" as "New Business" | "Repeat Business" | "Renewal" | "Expansion",
    urgency: "Standard" as "Standard" | "Expedite" | "Emergency",
    targetMarginPct: 35,
    notes: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    expirationDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    validityDays: 30,
    // Master data from existing customer
    competitors: [] as string[],
    customCompetitor: "",
    customerPriceIndex: undefined as number | undefined,
    customerMarginIndex: undefined as number | undefined,
  });

  // Queries
  const customersQuery = trpc.customers.list.useQuery({ search: customerSearch });
  const competitorNamesQuery = trpc.quoteWorkflow.getCompetitorNames.useQuery();
  const workflowQuery = trpc.quoteWorkflow.get.useQuery(
    { token: workflowToken! },
    { enabled: !!workflowToken }
  );

  const createWorkflow = trpc.quoteWorkflow.create.useMutation();
  const updateWorkflow = trpc.quoteWorkflow.update.useMutation();
  const upsertItem = trpc.quoteWorkflow.upsertItem.useMutation();
  const deleteItem = trpc.quoteWorkflow.deleteItem.useMutation();
  const submitForApproval = trpc.approval.submit.useMutation();
  const updateQuoteDates = trpc.quoteExpiry.updateDates.useMutation();

  // Select existing customer → prefill form with full master data
  const handleSelectCustomer = (c: any) => {
    setSelectedCustomerId(c.id);
    setIsNewCustomer(false);
    setForm(f => ({
      ...f,
      customerName: c.name,
      customerTier: c.tier ?? "Mid",
      customerRegion: c.region ?? "",
      customerChannel: c.channel ?? c.channels?.[0] ?? "OEM",
      customerIndustry: c.industry ?? "",
      contactName: c.contactName ?? f.contactName,
      contactEmail: c.contactEmail ?? f.contactEmail,
      // Pull price/margin index for pricing engine
      customerPriceIndex: c.priceIndex != null ? c.priceIndex / 100 : undefined,
      customerMarginIndex: c.marginIndex != null ? c.marginIndex / 100 : undefined,
    }));
    setCustomerSearch(c.name);
  };

  // Step 1 → Step 2
  const handleProceedToItems = async () => {
    if (!form.customerName.trim()) { toast.error("Customer name is required"); return; }
    try {
      const wf = await createWorkflow.mutateAsync({
        customerName: form.customerName,
        customerId: selectedCustomerId ?? undefined,
        customerTier: form.customerTier,
        customerRegion: form.customerRegion || undefined,
        customerChannel: form.customerChannel,
        customerIndustry: form.customerIndustry || undefined,
        customerPriceIndex: form.customerPriceIndex,
        customerMarginIndex: form.customerMarginIndex,
        contactName: form.contactName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        dealType: form.dealType,
        urgency: form.urgency,
        targetMarginPct: form.targetMarginPct,
        notes: form.notes || undefined,
        competitors: form.competitors.length > 0 ? form.competitors : undefined,
        effectiveDate: form.effectiveDate || undefined,
        expirationDate: form.expirationDate || undefined,
      });
      if (wf?.workflowToken) {
        setWorkflowToken(wf.workflowToken);
        // Persist effective/expiration dates
        setStep(2);
        // Add a first blank item
        addLineItem();
      }
    } catch (e) {
      toast.error("Failed to create quote session");
    }
  };

  // Add new line item
  const addLineItem = () => {
    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    setLineItems(prev => [...prev, {
      tempId,
      itemType: "existing",
      quantity: 1,
    }]);
  };

  // Update line item
  const handleUpdateItem = useCallback((tempId: string, patch: Partial<LineItem>) => {
    setLineItems(prev => prev.map(it => it.tempId === tempId ? { ...it, ...patch } : it));
  }, []);

  // Delete line item
  const handleDeleteItem = useCallback((tempId: string) => {
    setLineItems(prev => prev.filter(it => it.tempId !== tempId));
  }, []);

  // Submit quote
  const handleSubmit = async () => {
    if (!workflowToken) return;
    if (lineItems.length === 0) { toast.error("Add at least one line item"); return; }
    setSubmitting(true);
    try {
      // Persist all line items
      for (let i = 0; i < lineItems.length; i++) {
        const it = lineItems[i];
        await upsertItem.mutateAsync({
          workflowToken,
          itemType: it.itemType,
          partNumber: it.partNumber,
          description: it.description,
          family: it.family,
          series: it.series,
          isStandardCatalog: it.isStandardCatalog,
          configuredAttributes: it.configuredAttributes,
          customDescription: it.customDescription,
          customBaseFamily: it.customBaseFamily,
          customComplexity: it.customComplexity,
          customMoq: it.customMoq,
          customLeadTimeDays: it.customLeadTimeDays,
          customCost: it.customCost,
          listPrice: it.listPrice,
          targetPrice: it.targetPrice,
          floorPrice: it.floorPrice,
          quotedPrice: it.quotedPrice ?? it.targetPrice,
          quantity: it.quantity,
          pricingRationale: it.pricingRationale,
          priceConfidence: it.priceConfidence,
          sortOrder: i,
        });
      }
      // Submit for the 5-level approval workflow
      const approvalResult = await submitForApproval.mutateAsync({
        workflowToken,
        submittedBy: form.contactName || "Sales Rep",
      });
      toast.success(approvalResult.message ?? "Quote submitted for approval!");
      navigate("/approval-queue");
    } catch (e) {
      toast.error("Failed to submit quote");
    } finally {
      setSubmitting(false);
    }
  };

  // Quote totals
  const totalList = lineItems.reduce((s, it) => s + (it.listPrice ?? 0) * it.quantity, 0);
  const totalQuoted = lineItems.reduce((s, it) => s + ((it.quotedPrice ?? it.targetPrice ?? 0) * it.quantity), 0);
  const totalDiscount = totalList > 0 ? ((totalList - totalQuoted) / totalList * 100) : 0;

  const workflow = workflowQuery.data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">New Quote</h1>
              {workflowToken && <p className="text-xs text-muted-foreground font-mono">{workflowToken}</p>}
            </div>
          </div>
          {step === 2 && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Quote Total</div>
                <div className="text-lg font-bold text-foreground">${totalQuoted.toFixed(2)}</div>
                {totalDiscount > 0 && <div className="text-xs text-muted-foreground">{totalDiscount.toFixed(1)}% avg discount</div>}
              </div>
              <Button onClick={handleSubmit} disabled={submitting || lineItems.length === 0} className="gap-2">
                <Send className="w-4 h-4" />
                {submitting ? "Submitting…" : "Submit Quote"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <StepIndicator step={step} />

        {/* ── STEP 1: Customer & Deal ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Search existing customers</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="Search by name…"
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Customer results */}
                {customerSearch.length >= 2 && customersQuery.data && (
                  <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                    {customersQuery.data.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No customers found</div>
                    ) : customersQuery.data.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className={`w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors flex items-center justify-between ${selectedCustomerId === c.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                      >
                        <div>
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.industry} · {c.region}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">{c.tier}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>

                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => { setIsNewCustomer(true); setSelectedCustomerId(null); setCustomerSearch(""); }}>
                  <Plus className="w-3.5 h-3.5" /> Enter new customer manually
                </Button>

                {/* Customer form fields */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Customer Name *</Label>
                    <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Lockheed Martin" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Tier</Label>
                      <Select value={form.customerTier} onValueChange={v => setForm(f => ({ ...f, customerTier: v as any }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Enterprise", "Large", "Mid", "SMB"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Channel</Label>
                      <Select value={form.customerChannel} onValueChange={v => setForm(f => ({ ...f, customerChannel: v as any }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["OEM", "Distribution", "Intercompany"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Industry</Label>
                    <Select value={form.customerIndustry} onValueChange={v => setForm(f => ({ ...f, customerIndustry: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select industry…" /></SelectTrigger>
                      <SelectContent>
                        {ANALYTICS_INDUSTRIES.filter(i => i.value !== "All Industries").map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Region</Label>
                    <Select value={form.customerRegion} onValueChange={v => setForm(f => ({ ...f, customerRegion: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select region…" /></SelectTrigger>
                      <SelectContent>
                        {["Americas", "Europe", "Asia Pacific", "Middle East & Africa"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact & Deal */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Contact Name</Label>
                    <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="John Smith" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Email</Label>
                    <Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="jsmith@customer.com" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Phone</Label>
                    <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+1 (555) 000-0000" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" /> Deal Attributes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Deal Type</Label>
                      <Select value={form.dealType} onValueChange={v => setForm(f => ({ ...f, dealType: v as any }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["New Business", "Repeat Business", "Renewal", "Expansion"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Urgency</Label>
                      <Select value={form.urgency} onValueChange={v => setForm(f => ({ ...f, urgency: v as any }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Standard", "Expedite", "Emergency"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Target Margin %</Label>
                    <Input type="number" min={0} max={100} step={0.5}
                      value={form.targetMarginPct}
                      onChange={e => setForm(f => ({ ...f, targetMarginPct: parseFloat(e.target.value) || 35 }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Effective Date</Label>
                      <Input type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Expiration Date</Label>
                      <Input type="date" value={form.expirationDate} onChange={e => setForm(f => ({ ...f, expirationDate: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
                  <Textarea value={form.notes} rows={2} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any context for the pricing team…" />
                </div>
              </CardContent>
            </Card>

            {/* Competitors Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-500" /> Competitors in This Deal
                  <span className="text-xs font-normal text-muted-foreground ml-1">(optional — used for competitive intelligence)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Known competitors dropdown */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Add from known competitors</Label>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (v && !form.competitors.includes(v)) {
                        setForm(f => ({ ...f, competitors: [...f.competitors, v] }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a competitor…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(competitorNamesQuery.data ?? ["Amphenol Corporation", "TE Connectivity", "Souriau-Sunbank", "Glenair Inc.", "ITT Cannon (Us)"]).filter(
                        n => !form.competitors.includes(n)
                      ).map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Custom competitor entry */}
                <div className="flex gap-2">
                  <Input
                    value={form.customCompetitor}
                    onChange={e => setForm(f => ({ ...f, customCompetitor: e.target.value }))}
                    placeholder="Add custom competitor name…"
                    onKeyDown={e => {
                      if (e.key === "Enter" && form.customCompetitor.trim()) {
                        const name = form.customCompetitor.trim();
                        if (!form.competitors.includes(name)) {
                          setForm(f => ({ ...f, competitors: [...f.competitors, name], customCompetitor: "" }));
                        } else {
                          setForm(f => ({ ...f, customCompetitor: "" }));
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      const name = form.customCompetitor.trim();
                      if (name && !form.competitors.includes(name)) {
                        setForm(f => ({ ...f, competitors: [...f.competitors, name], customCompetitor: "" }));
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {/* Selected competitors list */}
                {form.competitors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.competitors.map(name => (
                      <div key={name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-sm text-red-800">
                        <Swords className="w-3 h-3 shrink-0" />
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, competitors: f.competitors.filter(c => c !== name) }))}
                          className="ml-0.5 hover:text-red-600 transition-colors"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {form.competitors.length === 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Identifying competitors helps the pricing engine calibrate win probabilities and feeds the Competitive Intelligence page.
                  </p>
                )}
              </CardContent>
            </Card>

            <Button
              className="w-full gap-2 h-11"
              disabled={!form.customerName.trim() || createWorkflow.isPending}
                onClick={handleProceedToItems}
              >
                {createWorkflow.isPending ? "Creating…" : "Continue to Line Items"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Line Items ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Customer summary bar */}
            {workflow && (
              <div className="rounded-xl border bg-card px-5 py-3 flex items-center gap-4 flex-wrap">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold text-foreground">{workflow.customerName}</span>
                  <span className="text-muted-foreground text-sm ml-2">{workflow.customerIndustry} · {workflow.customerRegion}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" />{workflow.customerTier}</span>
                  <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{workflow.dealType}</span>
                  {workflow.urgency !== "Standard" && (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs flex items-center gap-1">
                      <Zap className="w-3 h-3" />{workflow.urgency}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" />Target margin {workflow.targetMarginPct}%</span>
                </div>
              </div>
            )}

            {/* Line items */}
            <div className="space-y-3">
              {lineItems.map((item, i) => (
                <LineItemRow
                  key={item.tempId}
                  item={item}
                  index={i}
                  token={workflowToken!}
                  workflow={workflow}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                  openConfigurator={(tempId, family) => {
                    setConfiguratorTargetTempId(tempId);
                    setConfiguratorInitialFamily(family);
                    setConfiguratorModalOpen(true);
                  }}
                />
              ))}
            </div>

            <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addLineItem}>
              <Plus className="w-4 h-4" /> Add Line Item
            </Button>

            {/* Quote Intelligence Panel */}
            <QuoteIntelligencePanel
              workflow={workflow ?? null}
              lineItems={lineItems}
              totalQuoted={totalQuoted}
              totalDiscount={totalDiscount}
            />

            {/* Quote summary */}
            {lineItems.length > 0 && (
              <div className="rounded-xl border bg-card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Quote Summary</h3>
                <div className="space-y-1.5">
                  {lineItems.map((it, i) => {
                    const qp = it.quotedPrice ?? it.targetPrice ?? 0;
                    const total = qp * it.quantity;
                    return (
                      <div key={it.tempId} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                          <ItemTypeIcon type={it.itemType} />
                          <span className="font-mono truncate">{it.partNumber || it.customDescription?.slice(0, 30) || "—"}</span>
                          <span className="text-muted-foreground shrink-0">×{it.quantity}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!it.isStandardCatalog && it.itemType !== "custom" && (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">Non-catalog</Badge>
                          )}
                          <span className="font-semibold">${total.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Separator />
                <div className="flex items-center justify-between font-bold">
                  <span>Total</span>
                  <div className="text-right">
                    <div className="text-xl">${totalQuoted.toFixed(2)}</div>
                    {totalDiscount > 0 && (
                      <div className="text-xs text-muted-foreground font-normal">{totalDiscount.toFixed(1)}% avg discount from list</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                className="flex-1 gap-2 h-11"
                disabled={submitting || lineItems.length === 0}
                onClick={handleSubmit}
              >
                <Send className="w-4 h-4" />
                {submitting ? "Submitting…" : `Submit Quote (${lineItems.length} item${lineItems.length !== 1 ? "s" : ""})`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Page-level configurator modal — rendered at root to avoid nested portal issues */}
      {configuratorModalOpen && configuratorTargetTempId && (
        <ConfiguratorModal
          open={configuratorModalOpen}
          onClose={() => {
            setConfiguratorModalOpen(false);
            setConfiguratorTargetTempId(null);
            setConfiguratorInitialFamily(undefined);
          }}
          onConfirm={(result) => {
            const tempId = configuratorTargetTempId;
            handleUpdateItem(tempId, {
              partNumber: result.partNumber,
              description: result.description,
              family: result.family,
              isStandardCatalog: !result.isCustom,
              configuredAttributes: result.attributes,
              lookupResult: {
                found: !result.isCustom,
                description: result.description,
                series: result.series,
                family: result.family,
              },
              pricingLoaded: true,
            });
            setConfiguratorModalOpen(false);
            setConfiguratorTargetTempId(null);
            setConfiguratorInitialFamily(undefined);
          }}
          initialFamily={configuratorInitialFamily}
        />
      )}
    </div>
  );
}
