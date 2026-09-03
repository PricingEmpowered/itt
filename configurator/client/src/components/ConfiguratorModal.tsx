import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2, AlertTriangle, Loader2, Zap, RotateCcw, Copy,
  Info, ChevronRight, Settings2, X, Package,
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

export interface ConfiguratorResult {
  partNumber: string;
  isCustom: boolean;
  family: string;
  description?: string;
  series?: string;
  attributes: Record<string, string>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: ConfiguratorResult) => void;
  initialFamily?: string;
}

// ─── Attribute option button ──────────────────────────────────────────────────
function AttrButton({
  value, label, selected, onClick,
}: { value: string; label: string; selected: boolean; onClick: () => void }) {
  const desc = label.includes("—") ? label.split("—").slice(1).join("—").trim() : label;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all duration-150 hover:shadow-sm",
        selected
          ? "border-violet-500 bg-violet-50 shadow-sm ring-2 ring-violet-200"
          : "border-border/60 hover:border-violet-300 hover:bg-violet-50/30"
      )}
    >
      <span className="font-mono text-sm font-bold text-violet-700 leading-none mb-1">{value}</span>
      <span className="text-xs text-muted-foreground leading-snug line-clamp-2">{desc}</span>
      {selected && (
        <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-violet-500 shrink-0" />
      )}
    </button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ step, title, subtitle, complete }: { step: number; title: string; subtitle?: string; complete?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors",
        complete ? "bg-violet-500 text-white" : "bg-violet-100 text-violet-700"
      )}>
        {complete ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <div>
        <div className="font-semibold text-base text-foreground">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

export default function ConfiguratorModal({ open, onClose, onConfirm, initialFamily }: Props) {
  const [sel, setSel] = useState<SelectionState>({ ...EMPTY_SELECTION, family: initialFamily ?? "" });
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

  useEffect(() => {
    if (open) {
      setSel({ ...EMPTY_SELECTION, family: initialFamily ?? "" });
      setLookupResult(null);
      setLivePartNumber("");
    }
  }, [open, initialFamily]);

  const { data: families } = trpc.configurator.getFamilies.useQuery();
  const { data: attrs, isLoading: attrsLoading } = trpc.configurator.getAttributes.useQuery(
    { family: sel.family },
    { enabled: !!sel.family }
  );
  const buildMutation = trpc.configurator.buildAndLookup.useMutation();

  useEffect(() => {
    if (!sel.family) { setLivePartNumber(""); return; }
    setLivePartNumber(assemblePartNumber(sel));
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

  const handleConfirm = () => {
    if (!lookupResult) return;
    const product = lookupResult.product as Record<string, string> | null;
    onConfirm({
      partNumber: lookupResult.partNumber,
      isCustom: lookupResult.isCustom,
      family: lookupResult.family,
      description: product?.description,
      series: product?.series,
      attributes: Object.fromEntries(
        Object.entries(lookupResult.attributes).filter(([, v]) => v).map(([k, v]) => [k, v as string])
      ),
    });
    onClose();
  };

  const selectedFamily = (families ?? FAMILIES).find((f) => f.id === sel.family);
  const hasMinSelection = !!sel.family && (!!sel.style || !!sel.size || !!sel.contact);

  if (!open) return null;

  return (
    createPortal(
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          background: "white",
          overflow: "hidden",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Top bar ── */}
        <div className="flex items-center gap-4 px-6 py-4 border-b bg-white shrink-0">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Settings2 className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg leading-none">Connector Configurator</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {sel.family ? (
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  <span className="font-medium text-violet-700">{sel.family}</span>
                  {selectedFamily && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                      <span>{selectedFamily.standard}</span>
                    </>
                  )}
                </span>
              ) : (
                "Select a family, configure attributes, then confirm to use this part number on the quote line."
              )}
            </div>
          </div>
          {/* Live part number in header */}
          {livePartNumber && (
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 border border-violet-200">
              <span className="text-xs text-violet-500 font-medium uppercase tracking-wide">Part #</span>
              <span className="font-mono text-base font-bold text-violet-800 tracking-widest">{livePartNumber}</span>
              <button onClick={handleCopyPN} className="p-1 rounded hover:bg-violet-200 text-violet-500 transition-colors" title="Copy">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Main body: left config + right sticky panel ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: scrollable configuration */}
          <div className="flex-1 overflow-y-auto p-8 space-y-10">

            {/* ── Step 1: Family ── */}
            <section>
              <SectionHeader
                step={1}
                title="Select Connector Family"
                subtitle="Choose the connector series that matches your application requirements"
                complete={!!sel.family}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {(families ?? FAMILIES).map((fam) => (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => handleFamilyChange(fam.id)}
                    className={cn(
                      "relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all duration-150 hover:shadow-sm",
                      sel.family === fam.id
                        ? "border-violet-500 bg-violet-50 shadow-sm ring-2 ring-violet-200"
                        : "border-border/60 hover:border-violet-300 hover:bg-violet-50/30"
                    )}
                  >
                    <span className="font-bold text-base text-foreground leading-none mb-1.5">{fam.id}</span>
                    <span className="text-xs text-muted-foreground leading-snug">
                      {fam.label.split("—")[1]?.trim() || fam.standard}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{fam.standard}</span>
                    {sel.family === fam.id && (
                      <CheckCircle2 className="absolute top-2.5 right-2.5 w-4 h-4 text-violet-500" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* ── Step 2: Attributes ── */}
            {sel.family && (
              <section>
                <SectionHeader
                  step={2}
                  title="Configure Attributes"
                  subtitle="Select each attribute to build your part number. Required fields are marked."
                  complete={hasMinSelection}
                />
                {attrsLoading ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="space-y-3">
                        <Skeleton className="h-5 w-32" />
                        <div className="grid grid-cols-2 gap-2">
                          {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-16 w-full rounded-xl" />)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : attrs ? (
                  <div className="space-y-8">
                    {/* Shell Style */}
                    {attrs.styles.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Shell Style</span>
                          <span className="text-xs text-red-500 font-medium">Required</span>
                          {sel.style && <Badge variant="outline" className="text-violet-700 border-violet-300 bg-violet-50 font-mono text-xs">{sel.style}</Badge>}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                          {attrs.styles.map((opt) => (
                            <AttrButton
                              key={opt.value}
                              value={opt.value}
                              label={opt.label}
                              selected={sel.style === opt.value}
                              onClick={() => handleAttrChange("style", opt.value)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Material */}
                    {attrs.materials.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Material / Finish</span>
                          {sel.material && <Badge variant="outline" className="text-violet-700 border-violet-300 bg-violet-50 font-mono text-xs">{sel.material}</Badge>}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                          {attrs.materials.map((opt) => (
                            <AttrButton
                              key={opt.value}
                              value={opt.value}
                              label={opt.label}
                              selected={sel.material === opt.value}
                              onClick={() => handleAttrChange("material", opt.value)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shell Size */}
                    {attrs.sizes.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Shell Size</span>
                          <span className="text-xs text-red-500 font-medium">Required</span>
                          {sel.size && <Badge variant="outline" className="text-violet-700 border-violet-300 bg-violet-50 font-mono text-xs">{sel.size}</Badge>}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                          {attrs.sizes.map((opt) => (
                            <AttrButton
                              key={opt.value}
                              value={opt.value}
                              label={opt.label}
                              selected={sel.size === opt.value}
                              onClick={() => handleAttrChange("size", opt.value)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contact Type */}
                    {attrs.contacts.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Contact Type</span>
                          <span className="text-xs text-red-500 font-medium">Required</span>
                          {sel.contact && <Badge variant="outline" className="text-violet-700 border-violet-300 bg-violet-50 font-mono text-xs">{sel.contact}</Badge>}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                          {attrs.contacts.map((opt) => (
                            <AttrButton
                              key={opt.value}
                              value={opt.value}
                              label={opt.label}
                              selected={sel.contact === opt.value}
                              onClick={() => handleAttrChange("contact", opt.value)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Insert Arrangement */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Insert Arrangement</span>
                        <span className="text-xs text-muted-foreground font-medium">Optional</span>
                      </div>
                      <div className="flex items-center gap-3 max-w-xs">
                        <input
                          type="text"
                          value={sel.insert}
                          onChange={(e) => handleAttrChange("insert", e.target.value.toUpperCase())}
                          placeholder="e.g. 35, 19, 11…"
                          className="flex-1 px-4 py-3 rounded-xl border-2 border-border/60 font-mono text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition-all"
                        />
                        {sel.insert && (
                          <button
                            type="button"
                            onClick={() => handleAttrChange("insert", "")}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        Enter the numeric insert arrangement code (e.g. 35 for 35-pin)
                      </p>
                    </div>

                    {/* Suffix */}
                    {attrs.suffixes && attrs.suffixes.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Service Class / Suffix</span>
                          <span className="text-xs text-muted-foreground font-medium">Optional</span>
                          {sel.suffix && sel.suffix !== "none" && <Badge variant="outline" className="text-violet-700 border-violet-300 bg-violet-50 font-mono text-xs">{sel.suffix}</Badge>}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleAttrChange("suffix", "none")}
                            className={cn(
                              "flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all duration-150",
                              (sel.suffix === "none" || sel.suffix === "")
                                ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200"
                                : "border-border/60 hover:border-violet-300 hover:bg-violet-50/30"
                            )}
                          >
                            <span className="font-mono text-sm font-bold text-violet-700">—</span>
                            <span className="text-xs text-muted-foreground mt-1">None</span>
                          </button>
                          {attrs.suffixes.filter(opt => opt.value).map((opt) => (
                            <AttrButton
                              key={opt.value}
                              value={opt.value}
                              label={opt.label}
                              selected={sel.suffix === opt.value}
                              onClick={() => handleAttrChange("suffix", opt.value)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            )}

            {/* ── Step 3: Build & Lookup ── */}
            {sel.family && (
              <section>
                <SectionHeader
                  step={3}
                  title="Build & Look Up"
                  subtitle="Validate the assembled part number against the ITT catalog"
                  complete={!!lookupResult}
                />
                <div className="flex gap-3 max-w-lg">
                  <Button
                    onClick={handleLookup}
                    disabled={!hasMinSelection || buildMutation.isPending}
                    className="flex-1 h-12 gap-2 bg-violet-600 hover:bg-violet-700 text-white text-base font-semibold"
                  >
                    {buildMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Zap className="w-5 h-5" />
                    )}
                    {buildMutation.isPending ? "Looking up…" : "Build & Look Up Part Number"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="h-12 gap-2 px-4 border-border/60"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
                {!hasMinSelection && (
                  <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1.5">
                    <Info className="w-4 h-4 shrink-0" />
                    Select at least a Shell Style, Shell Size, or Contact Type to enable lookup
                  </p>
                )}

                {/* Lookup result */}
                {lookupResult && (
                  <div className={cn(
                    "mt-6 rounded-2xl border-2 p-6 transition-all",
                    lookupResult.isCustom ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"
                  )}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Validated Part Number</div>
                        <div className="font-mono text-2xl font-bold tracking-widest text-foreground">{lookupResult.partNumber}</div>
                      </div>
                      {lookupResult.isCustom ? (
                        <Badge className="gap-1.5 bg-amber-100 text-amber-800 border-amber-300 text-sm px-3 py-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          Custom / MTO
                        </Badge>
                      ) : (
                        <Badge className="gap-1.5 bg-emerald-100 text-emerald-800 border-emerald-300 text-sm px-3 py-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Standard Catalog
                        </Badge>
                      )}
                    </div>
                    {lookupResult.product && (
                      <div className="text-sm font-medium text-foreground mb-4">
                        {(lookupResult.product as Record<string, string>).description}
                      </div>
                    )}
                    {Object.keys(lookupResult.decoded).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(lookupResult.decoded).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/70 border border-white/80 text-xs">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="font-mono font-semibold text-foreground ml-2">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Bottom padding */}
            <div className="h-8" />
          </div>

          {/* Right: sticky summary panel */}
          <div className="w-80 border-l bg-muted/20 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-6 space-y-6">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Assembled Part Number</div>
                <div className={cn(
                  "min-h-[64px] flex items-center px-4 py-3 rounded-xl border-2 font-mono text-lg tracking-widest transition-all duration-200",
                  livePartNumber
                    ? "border-violet-400 bg-violet-50 text-foreground"
                    : "border-dashed border-border/60 bg-white text-muted-foreground/40"
                )}>
                  {livePartNumber || "—"}
                </div>
                {!sel.family && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Select a family to begin
                  </p>
                )}
              </div>

              {/* Selection summary */}
              {sel.family && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Current Selections</div>
                  <div className="space-y-2">
                    {[
                      { label: "Family", value: sel.family },
                      { label: "Shell Style", value: sel.style },
                      { label: "Material", value: sel.material },
                      { label: "Shell Size", value: sel.size },
                      { label: "Contact", value: sel.contact },
                      { label: "Insert", value: sel.insert },
                      { label: "Suffix", value: sel.suffix && sel.suffix !== "none" ? sel.suffix : "" },
                    ].filter(s => s.value).map(s => (
                      <div key={s.label} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-mono font-semibold text-foreground">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky footer actions */}
            <div className="mt-auto p-6 border-t bg-white space-y-3">
              <Button
                onClick={handleConfirm}
                disabled={!lookupResult}
                className="w-full h-12 gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-base"
              >
                <CheckCircle2 className="w-5 h-5" />
                Use This Part Number
              </Button>
              {lookupResult && (
                <div className="text-center text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">{lookupResult.partNumber}</span>
                  {" "}will be added to the quote line
                </div>
              )}
              <Button variant="outline" onClick={onClose} className="w-full border-border/60">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  );
}
