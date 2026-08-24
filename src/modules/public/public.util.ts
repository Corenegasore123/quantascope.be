import { DEFAULT_OPENING_HOURS } from "../../shared/types";

export const PUBLIC_SLOT_TIMES = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

export type OpeningHour = { day: string; open: string; close: string };

export function parseHours(json: unknown): OpeningHour[] {
  return Array.isArray(json) ? (json as OpeningHour[]) : DEFAULT_OPENING_HOURS;
}

export function kigaliNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kigali" }));
}

export function isOpenNow(hours: OpeningHour[], at = kigaliNow()) {
  const day = at.toLocaleDateString("en-US", { weekday: "long", timeZone: "Africa/Kigali" });
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  const now = `${hh}:${mm}`;
  const row = hours.find((h) => h.day === day);
  if (!row) return false;
  if (row.close < row.open) return now >= row.open || now <= row.close;
  return now >= row.open && now < row.close;
}

export function openUntil(hours: OpeningHour[], at = kigaliNow()) {
  const day = at.toLocaleDateString("en-US", { weekday: "long", timeZone: "Africa/Kigali" });
  return hours.find((h) => h.day === day)?.close ?? "22:00";
}

export function splitTags(value?: string | null) {
  return (value ?? "")
    .split(/[,•]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type PublicCard = {
  id: string;
  slug: string;
  name: string;
  description: string;
  city: string;
  neighborhood: string;
  cuisine: string;
  priceTier: string;
  rating: number;
  reviewCount: number;
  coverUrl: string | null;
  tags: string[];
  featuredTags: string[];
  openNow: boolean;
  publishedAt: string | null;
  nextSlots: { time: string; available: number }[];
  score: number;
  reasons: string[];
};

export type PublicMenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  dietary: string;
  popular: boolean;
  imageUrl: string | null;
  category: string;
};

const SECTION_ORDER = ["Breakfast", "Brunch", "Lunch", "Dinner", "Dessert", "Drinks", "Menu"];

export function menuSectionName(category: string, dishName: string) {
  const known = SECTION_ORDER.find((s) => s.toLowerCase() === category.trim().toLowerCase());
  if (known && known !== "Menu") return known;
  const t = `${category} ${dishName}`.toLowerCase();
  if (/drink|wine|beer|cocktail|juice|latte|espresso|tea|soda|coffee/.test(t)) return "Drinks";
  if (/dessert|cake|mousse|ice cream|tart|brownie/.test(t)) return "Dessert";
  if (/breakfast|brunch|pancake|omelette|croissant|granola/.test(t)) return "Breakfast";
  if (/lunch|salad|sandwich|soup|wrap|burger/.test(t)) return "Lunch";
  if (/main|side|grill|dinner/.test(t)) return "Dinner";
  return "Dinner";
}

export function groupMenuSections(items: PublicMenuItem[]) {
  const map = new Map<string, PublicMenuItem[]>();
  for (const item of items) {
    const section = menuSectionName(item.category, item.name);
    map.set(section, [...(map.get(section) ?? []), { ...item, category: section }]);
  }
  const named = SECTION_ORDER.filter((name) => map.has(name)).map((name) => ({ name, items: map.get(name)! }));
  const extra = [...map.keys()]
    .filter((name) => !SECTION_ORDER.includes(name))
    .sort()
    .map((name) => ({ name, items: map.get(name)! }));
  return [...named, ...extra];
}
