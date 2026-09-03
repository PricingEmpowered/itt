/**
 * Canonical analytics filter values — these MUST match exactly what is
 * stored in the analytics_* database tables.
 *
 * The analytics families are derived directly from the live products table
 * (products.family + products.series) and grouped as follows:
 *
 *  products.family → analyticsFamily
 *  ─────────────────────────────────────────────────────────────────────
 *  38999           → "38999/KJB"         (MIL-DTL-38999 Series III)
 *  KPT             → "KPT"               (MIL-DTL-26482 Series I)
 *  CIR, FRCIR      → "CIR/FRCIR"         (MIL-5015 & Fire-Resistant Railway)
 *  CA              → "CA Bayonet"         (MIL-DTL-26482 Series II)
 *  MS              → "MS Series"          (MIL-DTL-5015 Series I)
 *  MKJ             → "MKJ Trinity"        (Fiber-Optic MIL-PRF-29504)
 *  VBN, VS, VPT    → "VBN/VS/VPT"        (VEAM Backshell & Power)
 *  DBM, DPX        → "D-Sub/DPX"         (D-Subminiature & Rack-Panel Rect.)
 *  BKAD, TKJ       → "Rack & Panel"       (Cannon Trident Bayonet & EMI Filter)
 *  Micro           → "Micro"              (Micro series)
 *  Trident         → "Trident"            (Trident series)
 *  Transportation  → "Transportation"     (Vector/APD/Harness)
 *  Hermetics       → "Hermetics"          (Hermetic connectors)
 *  Filters         → "Filters"            (Filter connectors)
 *  DL              → "DL"                 (DL series)
 *  HDx             → "HDx"               (HDx series)
 *  RF              → "RF"                 (RF50 series)
 *  EV              → "EV"                 (EV series)
 *  Fiber Optics    → "Fiber Optics"       (Fiber Optics series)
 *  Circular (generic) → "Circular Other"  (Plastic Push Pull, PV/CV, Powerlock, etc.)
 */

/** Product families exactly as stored in analytics_* tables */
export const ANALYTICS_FAMILIES = [
  { value: "All Product Families", label: "All Product Families" },
  // ── High-volume Circular MIL-Spec ──────────────────────────────────────────
  { value: "MKJ Trinity",    label: "MKJ Trinity — Fiber-Optic MIL-PRF-29504 (27,157 SKUs)" },
  { value: "CIR/FRCIR",      label: "CIR/FRCIR — MIL-5015 & Fire-Resistant Railway (16,915 SKUs)" },
  { value: "CA Bayonet",     label: "CA Bayonet — MIL-DTL-26482 Series II (14,369 SKUs)" },
  { value: "38999/KJB",      label: "38999/KJB — MIL-DTL-38999 Series III (8,421 SKUs)" },
  { value: "KPT",            label: "KPT — MIL-DTL-26482 Series I (6,382 SKUs)" },
  { value: "MS Series",      label: "MS Series — MIL-DTL-5015 Series I (5,383 SKUs)" },
  { value: "VBN/VS/VPT",     label: "VBN/VS/VPT — VEAM Backshell & Power (44 SKUs)" },
  // ── D-Sub & Rack/Panel ─────────────────────────────────────────────────────
  { value: "D-Sub/DPX",      label: "D-Sub/DPX — D-Subminiature & Rectangular (6,807 SKUs)" },
  { value: "Rack & Panel",   label: "Rack & Panel — BKAD/TKJ Cannon Trident (325 SKUs)" },
  // ── Micro & Specialty ──────────────────────────────────────────────────────
  { value: "Micro",          label: "Micro — Micro Series (9,818 SKUs)" },
  { value: "Trident",        label: "Trident — Trident Series (824 SKUs)" },
  { value: "Transportation", label: "Transportation — Vector/APD/Harness (347 SKUs)" },
  { value: "Hermetics",      label: "Hermetics — Hermetic Connectors (331 SKUs)" },
  { value: "Filters",        label: "Filters — Filter Connectors (262 SKUs)" },
  { value: "DL",             label: "DL — DL Series (178 SKUs)" },
  { value: "HDx",            label: "HDx — HDx Series (160 SKUs)" },
  { value: "RF",             label: "RF — RF50 Series (108 SKUs)" },
  { value: "EV",             label: "EV — EV Series (36 SKUs)" },
  { value: "Fiber Optics",   label: "Fiber Optics — Fiber Optic Connectors (32 SKUs)" },
  { value: "Circular Other", label: "Circular Other — Plastic Push Pull, PV/CV, Powerlock, etc." },
];

/** Regions exactly as stored in analytics_* tables */
export const ANALYTICS_REGIONS = [
  { value: "All Regions", label: "All Regions" },
  { value: "NA",          label: "North America" },
  { value: "EMEA",        label: "EMEA" },
  { value: "APAC",        label: "Asia-Pacific" },
];

/** Sales channels exactly as stored in analytics_* tables */
export const ANALYTICS_CHANNELS = [
  { value: "All Channels",      label: "All Channels" },
  { value: "Direct Sales",      label: "Direct Sales" },
  { value: "Distribution",      label: "Distribution" },
  { value: "Partner",           label: "Partner" },
  { value: "E-Commerce",        label: "E-Commerce" },
  { value: "OEM",               label: "OEM" },
  { value: "System Integrator", label: "System Integrator" },
];

/** Market segments exactly as stored in analytics_quote_funnel table */
export const ANALYTICS_SEGMENTS = [
  { value: "All Segments",  label: "All Segments" },
  { value: "Aerospace",     label: "Aerospace & Defense" },
  { value: "Automotive",    label: "Automotive" },
  { value: "Industrial",    label: "Industrial" },
  { value: "Energy",        label: "Energy & Utilities" },
  { value: "Medical",       label: "Medical" },
  { value: "Electronics",   label: "Electronics" },
];

/** Industry segments — maps to ITT's real end-market groupings */
export const ANALYTICS_INDUSTRIES = [
  { value: "All Industries",         label: "All Industries" },
  // ── Aerospace & Defense ───────────────────────────────────────────────────
  { value: "Military Airframe",      label: "Military Airframe" },
  { value: "Military Avionics",      label: "Military Avionics" },
  { value: "Military Land Vehicles", label: "Military Land Vehicles" },
  { value: "Guidance/Control/Navigation", label: "Guidance / Control / Navigation" },
  { value: "Command/Control/Comms/Intel", label: "Command / Control / Comms / Intel" },
  { value: "Radar/Sonar",            label: "Radar / Sonar" },
  { value: "Space",                  label: "Space" },
  // ── Commercial Aviation ───────────────────────────────────────────────────
  { value: "Commercial Aircraft",    label: "Commercial Aircraft" },
  { value: "Commercial Avionics",    label: "Commercial Avionics" },
  // ── Distribution ─────────────────────────────────────────────────────────
  { value: "Franchised Distributors",label: "Franchised Distributors" },
  // ── Industrial & Energy ───────────────────────────────────────────────────
  { value: "Rolling Stock",          label: "Rolling Stock / Rail" },
  { value: "Electric Vehicle",       label: "Electric Vehicle" },
  { value: "Nuclear",                label: "Nuclear" },
  // ── Medical ───────────────────────────────────────────────────────────────
  { value: "Imaging",                label: "Medical Imaging" },
  { value: "Patient Monitoring",     label: "Patient Monitoring" },
];

/** Time period comparison options */
export const ANALYTICS_TIME_PERIODS = [
  { value: "Year over Year",       label: "Year over Year" },
  { value: "Quarter over Quarter", label: "Quarter over Quarter" },
  { value: "Month over Month",     label: "Month over Month" },
];

/** Generate YYYY-MM period options for the last 24 months */
export function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    options.push({ value: `${y}-${m}`, label: `${y}/${m}` });
  }
  return options;
}

/**
 * Map from products.family (configurator) → analytics productFamily label.
 * Used server-side to bucket real part numbers into analytics families.
 */
export const CONFIGURATOR_TO_ANALYTICS_FAMILY: Record<string, string> = {
  '38999':          '38999/KJB',
  'KPT':            'KPT',
  'CIR':            'CIR/FRCIR',
  'FRCIR':          'CIR/FRCIR',
  'CA':             'CA Bayonet',
  'MS':             'MS Series',
  'MKJ':            'MKJ Trinity',
  'VBN':            'VBN/VS/VPT',
  'VS':             'VBN/VS/VPT',
  'VPT':            'VBN/VS/VPT',
  'DBM':            'D-Sub/DPX',
  'DPX':            'D-Sub/DPX',
  'BKAD':           'Rack & Panel',
  'TKJ':            'Rack & Panel',
  'Micro':          'Micro',
  'Trident':        'Trident',
  'Transportation': 'Transportation',
  'Hermetics':      'Hermetics',
  'Filters':        'Filters',
  'DL':             'DL',
  'HDx':            'HDx',
  'RF':             'RF',
  'EV':             'EV',
  'Fiber Optics':   'Fiber Optics',
  'Circular':       'Circular Other',
};
