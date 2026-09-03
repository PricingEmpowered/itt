/**
 * ITT Connectors — Attribute Data & Part Number Assembly Logic
 * Sourced from ITTConnectorsAttributeMapping5.17.26.xlsx
 */

// ─── Family Definitions ───────────────────────────────────────────────────────

export const FAMILIES = [
  { id: "38999", label: "38999 / KJB — MIL-DTL-38999 Series III", standard: "MIL-DTL-38999" },
  { id: "KPT",   label: "KPT — MIL-DTL-26482 Series I",           standard: "MIL-DTL-26482" },
  { id: "CIR",   label: "CIR — VEAM MIL-5015 Crimp",              standard: "MIL-DTL-5015" },
  { id: "FRCIR", label: "FRCIR — Fire-Resistant Railway (EN 45545)", standard: "EN 45545" },
  { id: "CA",    label: "CA — CA Bayonet Series",                  standard: "MIL-DTL-26482 II" },
  { id: "MS",    label: "MS — MIL-DTL-5015 Series I",             standard: "MIL-DTL-5015" },
  { id: "DPX",   label: "DPX — Rack & Panel Rectangular",         standard: "MIL-DTL-83733" },
  { id: "DBM",   label: "DBM — D-Subminiature",                   standard: "MIL-DTL-24308" },
  { id: "MKJ",   label: "MKJ — Fiber-Optic (MIL-PRF-29504)",     standard: "MIL-PRF-29504" },
  { id: "VBN",   label: "VBN — VEAM Backshell / Banding Neck",   standard: "Proprietary" },
  { id: "VS",    label: "VS — VEAM VE / Vibration-Resistant",     standard: "Proprietary" },
  { id: "VPT",   label: "VPT — VEAM Power Coupler (IEC 61984)",  standard: "IEC 61984" },
  { id: "BKAD",  label: "BKAD — Cannon Trident Bayonet",         standard: "AS85049" },
  { id: "TKJ",   label: "TKJ — Cannon EMI Filter Connector",     standard: "MIL-DTL-38999" },
] as const;

export type FamilyId = typeof FAMILIES[number]["id"];

// ─── Attribute Options Per Family ─────────────────────────────────────────────

export interface AttributeOption {
  value: string;
  label: string;
}

export interface FamilyAttributes {
  styles: AttributeOption[];
  materials: AttributeOption[];
  contacts: AttributeOption[];
  sizes: AttributeOption[];
  suffixes?: AttributeOption[];
  inserts?: AttributeOption[];  // free-text for insert arrangement
}

const mkOpt = (value: string, label: string): AttributeOption => ({ value, label });

export const FAMILY_ATTRIBUTES: Record<string, FamilyAttributes> = {
  "38999": {
    styles: [
      mkOpt("A", "A — Straight Plug"),
      mkOpt("T", "T — Wall-Mount Receptacle"),
      mkOpt("E", "E — Jam-Nut Receptacle"),
      mkOpt("F", "F — Box-Mount Receptacle"),
      mkOpt("H", "H — Hermetic Receptacle"),
      mkOpt("J", "J — Jam-Nut Plug"),
      mkOpt("P", "P — Plug with Backshell"),
      mkOpt("Y", "Y — 90° Plug"),
      mkOpt("R", "R — Rear-Release Receptacle"),
      mkOpt("N", "N — Jam-Nut with Flange"),
      mkOpt("G", "G — Grounding Plug"),
      mkOpt("S", "S — In-Line Receptacle"),
      mkOpt("X", "X — Special"),
    ],
    materials: [
      mkOpt("0", "0 — Aluminum, Cadmium Olive Drab"),
      mkOpt("6", "6 — Aluminum, Olive Drab Cad"),
      mkOpt("7", "7 — Composite (Lightweight)"),
      mkOpt("L", "L — Stainless Steel"),
      mkOpt("M", "M — Aluminum, Nickel-PTFE"),
      mkOpt("W", "W — Aluminum, Electroless Nickel"),
      mkOpt("B", "B — Aluminum, Black Anodize"),
      mkOpt("8", "8 — Aluminum, Passivated"),
      mkOpt("C", "C — Aluminum, Chromate"),
      mkOpt("F", "F — Aluminum, Electroless Nickel (Alt)"),
    ],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
      mkOpt("A", "A — Pin, Alternate Keying"),
      mkOpt("B", "B — Socket, Alternate Keying"),
    ],
    sizes: [
      mkOpt("09", "09 — Shell Size 09"),
      mkOpt("11", "11 — Shell Size 11"),
      mkOpt("13", "13 — Shell Size 13"),
      mkOpt("15", "15 — Shell Size 15"),
      mkOpt("17", "17 — Shell Size 17"),
      mkOpt("19", "19 — Shell Size 19"),
      mkOpt("21", "21 — Shell Size 21"),
      mkOpt("23", "23 — Shell Size 23"),
      mkOpt("25", "25 — Shell Size 25"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("N", "N — No Accessory Threads"),
      mkOpt("F80", "F80 — Fluid-Resistant 80°C"),
      mkOpt("T12", "T12 — Thermal Cycling Class T12"),
      mkOpt("T39", "T39 — Thermal Cycling Class T39"),
      mkOpt("VO", "VO — Vibration-Resistant"),
    ],
  },

  KPT: {
    styles: [
      mkOpt("00", "00 — Wall-Mount Receptacle"),
      mkOpt("01", "01 — Box-Mount Receptacle"),
      mkOpt("02", "02 — Box-Mount with Flange"),
      mkOpt("06", "06 — Straight Plug"),
      mkOpt("07", "07 — Jam-Nut Receptacle"),
      mkOpt("08", "08 — 90° Plug"),
      mkOpt("0L", "0L — Low-Profile Plug"),
    ],
    materials: [
      mkOpt("F", "F — Standard Aluminum/Cad"),
      mkOpt("E", "E — Aluminum/Electroless Nickel"),
      mkOpt("W", "W — Aluminum/Olive Drab"),
      mkOpt("Y", "Y — Composite"),
    ],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
      mkOpt("PX", "PX — Pin, Extended"),
      mkOpt("SX", "SX — Socket, Extended"),
      mkOpt("A", "A — Pin, Alt Keying"),
      mkOpt("B", "B — Socket, Alt Keying"),
    ],
    sizes: [
      mkOpt("08", "08 — Shell Size 08"),
      mkOpt("10", "10 — Shell Size 10"),
      mkOpt("12", "12 — Shell Size 12"),
      mkOpt("14", "14 — Shell Size 14"),
      mkOpt("16", "16 — Shell Size 16"),
      mkOpt("18", "18 — Shell Size 18"),
      mkOpt("20", "20 — Shell Size 20"),
      mkOpt("22", "22 — Shell Size 22"),
      mkOpt("24", "24 — Shell Size 24"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("F80", "F80 — Fluid-Resistant 80°C"),
      mkOpt("T12", "T12 — Thermal Cycling"),
    ],
  },

  CIR: {
    styles: [
      mkOpt("00", "00 — Wall Receptacle"),
      mkOpt("02", "02 — Box-Mount Receptacle"),
      mkOpt("03", "03 — Panel-Mount Receptacle"),
      mkOpt("06", "06 — Straight Plug"),
      mkOpt("06SW", "06SW — 90° Left Plug"),
      mkOpt("06SY", "06SY — 90° Right Plug"),
      mkOpt("07", "07 — Jam-Nut Receptacle"),
      mkOpt("08", "08 — 90° Plug"),
      mkOpt("030R", "030R — Bulkhead Receptacle"),
      mkOpt("030F", "030F — Bulkhead Plug"),
      mkOpt("030N", "030N — Bulkhead Neutral"),
    ],
    materials: [
      mkOpt("GA", "GA — Aluminum"),
      mkOpt("GS", "GS — Stainless Steel"),
      mkOpt("GT", "GT — Composite"),
      mkOpt("GZ", "GZ — Zinc-Nickel Alloy"),
      mkOpt("GN", "GN — Aluminum, Nickel"),
    ],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
      mkOpt("ST", "ST — Socket, Thermocouple"),
      mkOpt("PT", "PT — Pin, Thermocouple"),
      mkOpt("SXT", "SXT — Socket, Extended Thermocouple"),
    ],
    sizes: [
      mkOpt("8",  "8  — Shell Size 8"),
      mkOpt("12", "12 — Shell Size 12"),
      mkOpt("14", "14 — Shell Size 14"),
      mkOpt("16", "16 — Shell Size 16"),
      mkOpt("18", "18 — Shell Size 18"),
      mkOpt("20", "20 — Shell Size 20"),
      mkOpt("22", "22 — Shell Size 22"),
      mkOpt("24", "24 — Shell Size 24"),
      mkOpt("28", "28 — Shell Size 28"),
      mkOpt("32", "32 — Shell Size 32"),
      mkOpt("36", "36 — Shell Size 36"),
      mkOpt("40", "40 — Shell Size 40"),
      mkOpt("48", "48 — Shell Size 48"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("F80", "F80 — Fluid-Resistant 80°C"),
      mkOpt("T12", "T12 — Thermal Cycling T12"),
      mkOpt("T39", "T39 — Thermal Cycling T39"),
      mkOpt("VO", "VO — Vibration-Resistant"),
      mkOpt("CR1", "CR1 — Corrosion-Resistant"),
    ],
  },

  FRCIR: {
    styles: [
      mkOpt("06", "06 — Straight Plug"),
      mkOpt("06SW", "06SW — 90° Left Plug"),
      mkOpt("06SY", "06SY — 90° Right Plug"),
      mkOpt("030R", "030R — Bulkhead Receptacle"),
      mkOpt("030F", "030F — Bulkhead Plug"),
    ],
    materials: [
      mkOpt("GA", "GA — Aluminum"),
      mkOpt("GT", "GT — Composite"),
      mkOpt("GS", "GS — Stainless Steel"),
    ],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
    ],
    sizes: [
      mkOpt("12", "12 — Shell Size 12"),
      mkOpt("16", "16 — Shell Size 16"),
      mkOpt("20", "20 — Shell Size 20"),
      mkOpt("24", "24 — Shell Size 24"),
      mkOpt("28", "28 — Shell Size 28"),
      mkOpt("32", "32 — Shell Size 32"),
      mkOpt("36", "36 — Shell Size 36"),
      mkOpt("40", "40 — Shell Size 40"),
    ],
    suffixes: [
      mkOpt("F80", "F80 — Fluid-Resistant 80°C"),
      mkOpt("EN", "EN — EN 45545 Fire Compliance"),
      mkOpt("T12", "T12 — Thermal Cycling"),
    ],
  },

  CA: {
    styles: [
      mkOpt("100", "100 — Straight Plug"),
      mkOpt("101", "101 — Wall Receptacle"),
      mkOpt("102", "102 — Box-Mount Receptacle"),
      mkOpt("106", "106 — Straight Plug with Flange"),
      mkOpt("108", "108 — 90° Plug"),
    ],
    materials: [
      mkOpt("E", "E — Aluminum/Electroless Nickel"),
      mkOpt("F", "F — Aluminum/Cadmium"),
      mkOpt("R", "R — Aluminum/Olive Drab"),
      mkOpt("A", "A — Aluminum/Anodize"),
      mkOpt("K", "K — Aluminum/Black Zinc-Nickel"),
    ],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
    ],
    sizes: [
      mkOpt("10", "10 — Shell Size 10"),
      mkOpt("12", "12 — Shell Size 12"),
      mkOpt("14", "14 — Shell Size 14"),
      mkOpt("16", "16 — Shell Size 16"),
      mkOpt("18", "18 — Shell Size 18"),
      mkOpt("20", "20 — Shell Size 20"),
      mkOpt("22", "22 — Shell Size 22"),
      mkOpt("24", "24 — Shell Size 24"),
      mkOpt("28", "28 — Shell Size 28"),
      mkOpt("32", "32 — Shell Size 32"),
      mkOpt("36", "36 — Shell Size 36"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("F80", "F80 — Fluid-Resistant 80°C"),
      mkOpt("VO", "VO — Vibration-Resistant"),
    ],
  },

  MS: {
    styles: [
      mkOpt("100", "3100 — Straight Plug"),
      mkOpt("101", "3101 — Wall Receptacle"),
      mkOpt("102", "3102 — Box-Mount Receptacle"),
      mkOpt("106", "3106 — Cable Connecting Plug"),
      mkOpt("108", "3108 — 90° Plug"),
    ],
    materials: [
      mkOpt("E", "E — Aluminum/Electroless Nickel"),
      mkOpt("F", "F — Standard Aluminum/Cad"),
      mkOpt("R", "R — Aluminum/Olive Drab"),
      mkOpt("K", "K — Aluminum/Black Zinc-Nickel"),
    ],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
    ],
    sizes: [
      mkOpt("10", "10 — Shell Size 10"),
      mkOpt("12", "12 — Shell Size 12"),
      mkOpt("14", "14 — Shell Size 14"),
      mkOpt("16", "16 — Shell Size 16"),
      mkOpt("18", "18 — Shell Size 18"),
      mkOpt("20", "20 — Shell Size 20"),
      mkOpt("22", "22 — Shell Size 22"),
      mkOpt("24", "24 — Shell Size 24"),
      mkOpt("28", "28 — Shell Size 28"),
      mkOpt("32", "32 — Shell Size 32"),
      mkOpt("36", "36 — Shell Size 36"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("F80", "F80 — Fluid-Resistant 80°C"),
    ],
  },

  DPX: {
    styles: [
      mkOpt("MA", "MA — Plug"),
      mkOpt("FE", "FE — Receptacle"),
      mkOpt("RE", "RE — Rear-Mount Receptacle"),
      mkOpt("WB", "WB — Wire-Bundle Plug"),
      mkOpt("B",  "B  — Board-Mount"),
      mkOpt("NB", "NB — Narrow Plug"),
      mkOpt("NE", "NE — Narrow Receptacle"),
      mkOpt("2MA","2MA — Gen-2 Plug"),
      mkOpt("2FE","2FE — Gen-2 Receptacle"),
      mkOpt("2RE","2RE — Gen-2 Rear-Mount"),
      mkOpt("2WB","2WB — Gen-2 Wire-Bundle"),
    ],
    materials: [],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
    ],
    sizes: [
      mkOpt("8",   "8   — 8 Contacts"),
      mkOpt("11",  "11  — 11 Contacts"),
      mkOpt("13",  "13  — 13 Contacts"),
      mkOpt("17",  "17  — 17 Contacts"),
      mkOpt("19",  "19  — 19 Contacts"),
      mkOpt("25",  "25  — 25 Contacts"),
      mkOpt("33",  "33  — 33 Contacts"),
      mkOpt("37",  "37  — 37 Contacts"),
      mkOpt("57",  "57  — 57 Contacts"),
      mkOpt("67",  "67  — 67 Contacts"),
      mkOpt("85",  "85  — 85 Contacts"),
      mkOpt("104", "104 — 104 Contacts"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("A", "A — Polarization Key A"),
      mkOpt("B", "B — Polarization Key B"),
      mkOpt("C", "C — Polarization Key C"),
    ],
  },

  DBM: {
    styles: [
      mkOpt("DBM",  "DBM  — Standard D-Sub"),
      mkOpt("DAM",  "DAM  — High-Density D-Sub"),
      mkOpt("DEM",  "DEM  — Extended D-Sub"),
      mkOpt("DCM",  "DCM  — Combo D-Sub"),
      mkOpt("DBMA", "DBMA — D-Sub with Accessories"),
    ],
    materials: [],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
      mkOpt("W", "W — Mixed Pin/Socket"),
      mkOpt("C", "C — Coax"),
      mkOpt("H", "H — High-Power"),
    ],
    sizes: [
      mkOpt("9",  "9  — DE-9 (9 contacts)"),
      mkOpt("15", "15 — DA-15 (15 contacts)"),
      mkOpt("25", "25 — DB-25 (25 contacts)"),
      mkOpt("37", "37 — DC-37 (37 contacts)"),
      mkOpt("44", "44 — DD-44 (44 contacts)"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("M", "M — Metal Shell"),
      mkOpt("P", "P — Plastic Shell"),
    ],
  },

  MKJ: {
    styles: [
      mkOpt("1A", "1A — Single-Channel Plug"),
      mkOpt("1C", "1C — Single-Channel Receptacle"),
      mkOpt("3A", "3A — 3-Channel Plug"),
      mkOpt("3C", "3C — 3-Channel Receptacle"),
      mkOpt("4A", "4A — 4-Channel Plug"),
      mkOpt("4C", "4C — 4-Channel Receptacle"),
      mkOpt("5A", "5A — 5-Channel Plug"),
      mkOpt("5B", "5B — 5-Channel Receptacle (Alt)"),
      mkOpt("5C", "5C — 5-Channel Receptacle"),
    ],
    materials: [],
    contacts: [],
    sizes: [],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("SM", "SM — Single-Mode"),
      mkOpt("MM", "MM — Multi-Mode"),
    ],
  },

  VBN: {
    styles: [
      mkOpt("2",   "2   — Standard Backshell"),
      mkOpt("3",   "3   — Strain-Relief Backshell"),
      mkOpt("6",   "6   — EMI Banding Backshell"),
      mkOpt("290", "290 — Heavy-Duty Backshell"),
    ],
    materials: [],
    contacts: [],
    sizes: [
      mkOpt("16", "16 — For Shell-16"),
      mkOpt("20", "20 — For Shell-20"),
      mkOpt("22", "22 — For Shell-22"),
      mkOpt("28", "28 — For Shell-28"),
      mkOpt("40", "40 — For Shell-40"),
      mkOpt("74", "74 — For Shell-74"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("G", "G — Gland Type"),
    ],
  },

  VS: {
    styles: [
      mkOpt("3402", "3402 — Straight Plug"),
      mkOpt("3106", "3106 — Cable Plug"),
      mkOpt("3102", "3102 — Box Receptacle"),
      mkOpt("3108", "3108 — 90° Plug"),
      mkOpt("3101", "3101 — Wall Receptacle"),
      mkOpt("3406", "3406 — Hermetic Receptacle"),
      mkOpt("3407", "3407 — Hermetic Plug"),
    ],
    materials: [],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
    ],
    sizes: [],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("F80", "F80 — Fluid-Resistant 80°C"),
    ],
  },

  VPT: {
    styles: [
      mkOpt("06", "06 — Standard Coupler"),
      mkOpt("08", "08 — Heavy-Duty Coupler"),
    ],
    materials: [],
    contacts: [
      mkOpt("P", "P — Pin (Male)"),
      mkOpt("S", "S — Socket (Female)"),
    ],
    sizes: [
      mkOpt("10", "10 — 10 kV Rating"),
      mkOpt("14", "14 — 14 kV Rating"),
      mkOpt("16", "16 — 16 kV Rating"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("HV", "HV — High-Voltage"),
    ],
  },

  BKAD: {
    styles: [
      mkOpt("BKAD",  "BKAD  — Standard Bayonet"),
      mkOpt("BKADP", "BKADP — Bayonet with Protective Cap"),
    ],
    materials: [],
    contacts: [],
    sizes: [
      mkOpt("125", "125 — Size 125"),
      mkOpt("155", "155 — Size 155"),
      mkOpt("313", "313 — Size 313"),
      mkOpt("385", "385 — Size 385"),
      mkOpt("400", "400 — Size 400"),
      mkOpt("800", "800 — Size 800"),
    ],
    suffixes: [
      mkOpt("", "None"),
    ],
  },

  TKJ: {
    styles: [
      mkOpt("S", "S — Standard Filter"),
      mkOpt("E", "E — Enhanced Filter"),
      mkOpt("B", "B — Broadband Filter"),
    ],
    materials: [],
    contacts: [],
    sizes: [
      mkOpt("16", "16 — Shell Size 16"),
      mkOpt("20", "20 — Shell Size 20"),
      mkOpt("24", "24 — Shell Size 24"),
      mkOpt("32", "32 — Shell Size 32"),
    ],
    suffixes: [
      mkOpt("", "None"),
      mkOpt("C", "C — Capacitive Filter"),
      mkOpt("L", "L — Inductive Filter"),
    ],
  },
};

// ─── Part Number Assembly Logic ───────────────────────────────────────────────

export interface ConfigSelection {
  family: string;
  style?: string;
  material?: string;
  size?: string;
  insert?: string;
  contact?: string;
  suffix?: string;
}

/**
 * Assemble a part number string from selected attributes,
 * following each family's positional decode rules.
 */
export function assemblePartNumber(sel: ConfigSelection): string {
  const { family, style = "", material = "", size = "", insert = "", contact = "", suffix = "" } = sel;

  switch (family) {
    case "38999": {
      // KJB[Material][Style][Size][ServiceClass][Insert][Contact][Suffix]
      // e.g. KJB7T17F35PN
      const svcClass = "F"; // default service class
      const parts = ["KJB", material, style, size, svcClass, insert, contact, suffix].filter(Boolean);
      return parts.join("");
    }

    case "KPT": {
      // KPT[Style][Material][Size]-[Insert][Contact][Suffix]
      // e.g. KPT06F14-19P
      const base = ["KPT", style, material, size].filter(Boolean).join("");
      const tail = [insert, contact].filter(Boolean).join("");
      const sfx = suffix ? `-${suffix}` : "";
      return tail ? `${base}-${tail}${sfx}` : `${base}${sfx}`;
    }

    case "CIR":
    case "FRCIR": {
      // [CIR|FRCIR][Style][Material][Size]-[Insert][Contact][-Suffix...]
      // e.g. CIR06GA24-11P-F80
      const prefix = family;
      const base = [prefix, style, material, size].filter(Boolean).join("");
      const tail = [insert, contact].filter(Boolean).join("");
      const sfxParts = suffix ? suffix.split("-").filter(Boolean).map(s => `-${s}`).join("") : "";
      return tail ? `${base}-${tail}${sfxParts}` : `${base}${sfxParts}`;
    }

    case "CA": {
      // CA[Style][Material][Size]-[Insert][Contact]
      // e.g. CA3106F14-19P
      const base = ["CA", style, material, size].filter(Boolean).join("");
      const tail = [insert, contact].filter(Boolean).join("");
      const sfx = suffix ? `-${suffix}` : "";
      return tail ? `${base}-${tail}${sfx}` : `${base}${sfx}`;
    }

    case "MS": {
      // MS[Style][Material][Size]-[Insert][Contact]
      // e.g. MS3106F18-1S
      const base = ["MS", style, material, size].filter(Boolean).join("");
      const tail = [insert, contact].filter(Boolean).join("");
      const sfx = suffix ? `-${suffix}` : "";
      return tail ? `${base}-${tail}${sfx}` : `${base}${sfx}`;
    }

    case "DPX": {
      // DPX[Style]-[Size][Contact][-Suffix]
      // e.g. DPX2MA-67P-A34B30
      const base = ["DPX", style].filter(Boolean).join("");
      const tail = [size, contact].filter(Boolean).join("");
      const sfx = suffix ? `-${suffix}` : "";
      return tail ? `${base}-${tail}${sfx}` : `${base}${sfx}`;
    }

    case "DBM": {
      // [Style][Size][Contact]
      // e.g. DBM25P
      return [style, size, contact, suffix].filter(Boolean).join("");
    }

    case "MKJ": {
      // MKJ[Style][-Suffix]
      const base = ["MKJ", style].filter(Boolean).join("");
      const sfx = suffix ? `-${suffix}` : "";
      return `${base}${sfx}`;
    }

    case "VBN": {
      // VBN-[Style]-[Suffix]-[Size]
      // e.g. VBN-25-G-32
      const parts = ["VBN", style, suffix, size].filter(Boolean);
      return parts.join("-");
    }

    case "VS": {
      // VS[Style][Size][Contact][-Suffix]
      const base = ["VS", style, size, contact].filter(Boolean).join("");
      const sfx = suffix ? `-${suffix}` : "";
      return `${base}${sfx}`;
    }

    case "VPT": {
      // VPT[Style][Size][Contact]
      return ["VPT", style, size, contact, suffix].filter(Boolean).join("");
    }

    case "BKAD": {
      // [Style][Size]
      return [style, size, suffix].filter(Boolean).join("-");
    }

    case "TKJ": {
      // TKJ[Style][Size][Suffix]
      return ["TKJ", style, size, suffix].filter(Boolean).join("");
    }

    default:
      return [family, style, material, size, insert, contact, suffix].filter(Boolean).join("-");
  }
}

/**
 * Decode a part number into its attribute components for display.
 */
export function decodePartNumber(family: string, partNumber: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const famAttrs = FAMILY_ATTRIBUTES[family];
  if (!famAttrs) return attrs;

  // Return a human-readable breakdown based on family
  switch (family) {
    case "38999": {
      // KJB[Material][Style][Size][ServiceClass][Insert][Contact][Suffix]
      const rest = partNumber.replace(/^KJB/, "");
      attrs["Series Prefix"] = "KJB (MIL-DTL-38999 Series III)";
      if (rest.length >= 1) attrs["Shell Material"] = rest[0];
      if (rest.length >= 2) attrs["Shell Style"] = rest[1];
      if (rest.length >= 4) attrs["Shell Size"] = rest.substring(2, 4);
      if (rest.length >= 5) attrs["Service Class"] = rest[4];
      if (rest.length >= 7) attrs["Insert Arrangement"] = rest.substring(5, 7);
      if (rest.length >= 8) attrs["Contact Style"] = rest[7];
      if (rest.length > 8) attrs["Suffix/Options"] = rest.substring(8);
      break;
    }
    case "KPT": {
      attrs["Series Prefix"] = "KPT (MIL-DTL-26482 Series I)";
      const dashIdx = partNumber.indexOf("-");
      if (dashIdx > 0) {
        const head = partNumber.substring(3, dashIdx);
        attrs["Shell Style"] = head.substring(0, 2);
        attrs["Class/Finish"] = head[2];
        attrs["Shell Size"] = head.substring(3);
        const tail = partNumber.substring(dashIdx + 1);
        attrs["Insert Arrangement"] = tail.replace(/[PS].*$/, "");
        const contactMatch = tail.match(/[PS][A-Z]?$/);
        if (contactMatch) attrs["Contact Style"] = contactMatch[0];
      }
      break;
    }
    case "CIR":
    case "FRCIR": {
      attrs["Series Prefix"] = family === "FRCIR" ? "FRCIR (Fire-Resistant Railway)" : "CIR (VEAM MIL-5015)";
      const dashIdx = partNumber.indexOf("-");
      if (dashIdx > 0) {
        const head = partNumber.substring(family.length);
        const headParts = head.split("-");
        if (headParts[0]) attrs["Shell Style"] = headParts[0];
        if (headParts[1]) attrs["Shell Size"] = headParts[1];
        if (headParts[2]) {
          const ic = headParts[2];
          const contactMatch = ic.match(/(SXT|SX|ST|PT|S|P)$/);
          if (contactMatch) {
            attrs["Contact Style"] = contactMatch[0];
            attrs["Insert Arrangement"] = ic.substring(0, ic.length - contactMatch[0].length);
          } else {
            attrs["Insert Arrangement"] = ic;
          }
        }
        const suffixes = headParts.slice(3);
        if (suffixes.length) attrs["Service Class"] = suffixes.join("-");
      }
      break;
    }
    default: {
      attrs["Part Number"] = partNumber;
      attrs["Family"] = family;
    }
  }
  return attrs;
}
