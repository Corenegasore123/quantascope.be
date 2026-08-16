import type { UnitCategory } from "../types/index.js";

interface UnitDefinition {
  id: string;
  symbol: string;
  category: UnitCategory;
  toBase: number;
}

const LENGTH_UNITS: UnitDefinition[] = [
  { id: "mm", symbol: "mm", category: "length", toBase: 0.001 },
  { id: "cm", symbol: "cm", category: "length", toBase: 0.01 },
  { id: "m", symbol: "m", category: "length", toBase: 1 },
  { id: "km", symbol: "km", category: "length", toBase: 1000 },
  { id: "in", symbol: "in", category: "length", toBase: 0.0254 },
  { id: "ft", symbol: "ft", category: "length", toBase: 0.3048 },
  { id: "yd", symbol: "yd", category: "length", toBase: 0.9144 },
];

const AREA_UNITS: UnitDefinition[] = [
  { id: "sqm", symbol: "sqm", category: "area", toBase: 1 },
  { id: "sq_m", symbol: "sq m", category: "area", toBase: 1 },
  { id: "sqft", symbol: "sqft", category: "area", toBase: 0.092903 },
];

const VOLUME_UNITS: UnitDefinition[] = [
  { id: "cum", symbol: "cum", category: "volume", toBase: 1 },
  { id: "cu_m", symbol: "cu m", category: "volume", toBase: 1 },
];

const ALL_UNITS = [...LENGTH_UNITS, ...AREA_UNITS, ...VOLUME_UNITS];

export function normalizeUnit(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/\./g, "");
  const aliases: Record<string, string> = {
    metre: "m",
    meters: "m",
    meter: "m",
    metres: "m",
    centimetre: "cm",
    centimeter: "cm",
    millimetre: "mm",
    millimeter: "mm",
    sqm: "sqm",
    sq_m: "sqm",
    m2: "sqm",
    "m²": "sqm",
    cum: "cum",
    cu_m: "cum",
    "m3": "cum",
    "m³": "cum",
    rs: "Rs.",
    rupees: "Rs.",
  };
  return aliases[cleaned] ?? raw;
}

export function getUnitCategory(unit: string): UnitCategory | null {
  const normalized = normalizeUnit(unit);
  const found = ALL_UNITS.find((u) => u.id === normalized || u.symbol === unit);
  return found?.category ?? (unit === "Rs." ? "currency" : unit === "count" ? "count" : null);
}

export function convert(value: number, fromUnit: string, toUnit: string): number {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return value;

  const fromDef = ALL_UNITS.find((u) => u.id === from);
  const toDef = ALL_UNITS.find((u) => u.id === to);
  if (!fromDef || !toDef || fromDef.category !== toDef.category) {
    throw new Error(`Cannot convert ${fromUnit} to ${toUnit}`);
  }
  return (value * fromDef.toBase) / toDef.toBase;
}

export function normalizeToMetres(value: number, unit: string): number {
  return convert(value, unit, "m");
}

export function normalizeToCum(value: number, unit: string): number {
  return convert(value, unit, "cum");
}

export function normalizeToSqm(value: number, unit: string): number {
  return convert(value, unit, "sqm");
}

export { ALL_UNITS };
