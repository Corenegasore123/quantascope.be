/** Curated square dish photography for public menus. Restaurant uploads win when they are not the venue cover. */

const SQUARE = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&h=800&q=80`;

const RULES: { re: RegExp; id: string }[] = [
  { re: /bao|dumpling|gyoza/i, id: "photo-1496116218417-1a781b1c416c" },
  { re: /ramen|noodle|dan dan/i, id: "photo-1569718212165-3a8278d5f624" },
  { re: /sushi|omakase|sashimi|\bdon\b/i, id: "photo-1579871494447-9813b98c05f1" },
  { re: /pizza|margherita|\bpie\b/i, id: "photo-1513104890138-7c749659a591" },
  { re: /burger|smash/i, id: "photo-1568901345628-af6d0d4149ee" },
  { re: /pasta|cacio|spaghetti|osso/i, id: "photo-1621996346565-e3dbc646d9a9" },
  { re: /butter chicken|palak|paneer|naan|curry/i, id: "photo-1585937421612-70a008356fbe" },
  { re: /injera|doro|misir|shiro/i, id: "photo-1544025162-d76694265947" },
  { re: /hummus|fattoush|meze/i, id: "photo-1541518763669-27fef04b14ea" },
  { re: /prawn|shrimp/i, id: "photo-1559339352-11d035aa65de" },
  { re: /tilapia|trout|salmon|sambaza|ndagala|\bfish\b/i, id: "photo-1519708227418-c8fd9a32b7a2" },
  { re: /steak|ribeye|nyama|brochette|grill|confit|goat|lamb/i, id: "photo-1555939594-58d7cb561ad1" },
  { re: /salad|pumpkin|isombe|avocado|veg gyoza|vegetarian combination/i, id: "photo-1512621776951-a57141f2eefd" },
  { re: /soup|stew|agatogo|ibihaza/i, id: "photo-1547592166-23acba9895e0" },
  { re: /sandwich|toast|wrap|chapati/i, id: "photo-1528735602780-2552fd46c7af" },
  { re: /bun|bread|bakery|banana/i, id: "photo-1509440159596-0249088772ff" },
  { re: /coffee|pour-over|latte|espresso|filter/i, id: "photo-1495474472287-4d71bcdd2085" },
  { re: /cocktail|sour|gin|wine|drink/i, id: "photo-1514362545857-3bc16c4c7d1b" },
  { re: /egg|omelette|brunch|breakfast/i, id: "photo-1482049016688-2d3e1b311543" },
  { re: /chicken|duck|beef|pork/i, id: "photo-1600891964092-4316c288032e" },
];

const PLATED = [
  "photo-1504674900247-0877df9cc836",
  "photo-1476224203421-9ac39bcb3327",
  "photo-1467003909585-2f8a72700288",
  "photo-1473093295043-cdd812d0e601",
  "photo-1567620905732-2d1ec7ab7445",
  "photo-1482049016688-2d3e1b311543",
  "photo-1544025162-d76694265947",
  "photo-1555939594-58d7cb561ad1",
];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function squarePhotoUrl(url: string) {
  if (!url.includes("images.unsplash.com")) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("auto", "format");
    u.searchParams.set("fit", "crop");
    u.searchParams.set("w", "800");
    u.searchParams.set("h", "800");
    u.searchParams.set("q", "80");
    return u.toString();
  } catch {
    return url;
  }
}

export function dishStockPhoto(name: string) {
  const hit = RULES.find((r) => r.re.test(name));
  return SQUARE(hit?.id ?? PLATED[hashName(name) % PLATED.length]);
}

export function resolveDishImage(name: string, stored: string | null | undefined, coverUrl: string | null | undefined) {
  const photo = stored?.trim() || null;
  const cover = coverUrl?.trim() || null;
  if (photo && photo !== cover) return squarePhotoUrl(photo);
  return dishStockPhoto(name);
}
