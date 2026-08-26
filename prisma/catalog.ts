import type { PrismaClient } from "@prisma/client";

import { dishStockPhoto } from "../src/shared/dish-photos";

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

const PHOTOS = {
  interior: "photo-1517248135467-4c7edcad34c4",
  plated: "photo-1414235077428-338989a2e8c0",
  grill: "photo-1555939594-58d7cb561ad1",
  italian: "photo-1498579809087-ef1e558fd1da",
  sushi: "photo-1579871494447-9813b98c05f1",
  cafe: "photo-1495474472287-4d71bcdd2085",
  indian: "photo-1585937421612-70a008356fbe",
  seafood: "photo-1559339352-11d035aa65de",
  steak: "photo-1600891964092-4316c288032e",
  pizza: "photo-1513104890138-7c749659a591",
  brunch: "photo-1482049016688-2d3e1b311543",
  african: "photo-1544025162-d76694265947",
  bakery: "photo-1509440159596-0249088772ff",
  chinese: "photo-1526318896980-cf78c088247c",
  veg: "photo-1512621776951-a57141f2eefd",
  burger: "photo-1568901345628-af6d0d4149ee",
  rooftop: "photo-1414235077428-338989a2e8c0",
  lake: "photo-1507525428034-b723cf961d3e",
  cocktail: "photo-1514362545857-3bc16c4c7d1b",
  pasta: "photo-1621996346565-e3dbc646d9a9",
};

const COORDS: Record<string, { lat: number; lng: number }> = {
  Kigali: { lat: -1.9441, lng: 30.0619 },
  Musanze: { lat: -1.4992, lng: 29.635 },
  Rubavu: { lat: -1.7028, lng: 29.2564 },
  Huye: { lat: -2.5967, lng: 29.7394 },
};

type Hours = { day: string; open: string; close: string }[];

type CatalogRestaurant = {
  slug: string;
  name: string;
  description: string;
  city: string;
  neighborhood: string;
  cuisine: string;
  priceTier: "$" | "$$" | "$$$";
  features: string;
  featuredTags: string;
  rating: number;
  reviewCount: number;
  cover: string;
  photos: string[];
  daysAgo: number;
  late?: boolean;
  dishes: { name: string; price: number; description: string; dietary?: string; popular?: boolean }[];
  reviews: { author: string; rating: number; comment: string }[];
  groupTables?: boolean;
};

const CATALOG: CatalogRestaurant[] = [
  {
    slug: "nyarutarama-grill",
    name: "Nyarutarama Grill",
    description: "Open-fire nyama and umutsima on a quiet Nyarutarama terrace.",
    city: "Kigali",
    neighborhood: "Nyarutarama",
    cuisine: "Rwandan • Grill",
    priceTier: "$$",
    features: "outdoor seating, family friendly",
    featuredTags: "local-favorite,grill",
    rating: 4.7,
    reviewCount: 210,
    cover: PHOTOS.grill,
    photos: [PHOTOS.grill, PHOTOS.african, PHOTOS.interior],
    daysAgo: 40,
    dishes: [
      { name: "Goat brochettes", price: 9500, description: "Charcoal-grilled, served with ibitoke.", popular: true },
      { name: "Tilapia whole", price: 12000, description: "Lake fish, lemon and pili pili." },
    ],
    reviews: [{ author: "Diane", rating: 5, comment: "Best brochettes in this part of town." }],
    groupTables: true,
  },
  {
    slug: "kiyovu-trattoria",
    name: "Kiyovu Trattoria",
    description: "Handmade pasta and a short Italian wine list above KN 3.",
    city: "Kigali",
    neighborhood: "Kiyovu",
    cuisine: "Italian",
    priceTier: "$$$",
    features: "date night, wine, outdoor seating",
    featuredTags: "date-night,italian",
    rating: 4.8,
    reviewCount: 156,
    cover: PHOTOS.italian,
    photos: [PHOTOS.italian, PHOTOS.pasta, PHOTOS.interior],
    daysAgo: 20,
    dishes: [
      { name: "Cacio e pepe", price: 14000, description: "Pecorino, black pepper, bronze-cut spaghetti.", popular: true, dietary: "vegetarian" },
      { name: "Osso buco", price: 22000, description: "Slow veal, saffron risotto." },
    ],
    reviews: [{ author: "Marc", rating: 5, comment: "Quiet, candlelit, excellent pasta." }],
  },
  {
    slug: "remera-spice-house",
    name: "Remera Spice House",
    description: "Kerala thalis and Goan seafood, weekday lunch thali until 15:00.",
    city: "Kigali",
    neighborhood: "Remera",
    cuisine: "Indian",
    priceTier: "$$",
    features: "family friendly, vegetarian options",
    featuredTags: "family,indian",
    rating: 4.5,
    reviewCount: 98,
    cover: PHOTOS.indian,
    photos: [PHOTOS.indian, PHOTOS.interior],
    daysAgo: 55,
    dishes: [
      { name: "Butter chicken", price: 11000, description: "Kasundi tomato gravy, naan.", popular: true },
      { name: "Palak paneer", price: 9000, description: "Spinach and house paneer.", dietary: "vegetarian" },
    ],
    reviews: [{ author: "Priya", rating: 4, comment: "Generous thali, friendly service." }],
  },
  {
    slug: "kimihurura-omakase",
    name: "Kimihurura Omakase",
    description: "Twelve-seat sushi counter. Book ahead for the evening seating.",
    city: "Kigali",
    neighborhood: "Kimihurura",
    cuisine: "Japanese",
    priceTier: "$$$",
    features: "date night, business dining",
    featuredTags: "date-night,new",
    rating: 4.9,
    reviewCount: 64,
    cover: PHOTOS.sushi,
    photos: [PHOTOS.sushi, PHOTOS.interior],
    daysAgo: 8,
    dishes: [
      { name: "Omakase 12", price: 45000, description: "Chef's selection, two hours.", popular: true },
      { name: "Salmon don", price: 16000, description: "Rice bowl with house soy." },
    ],
    reviews: [{ author: "Kenji", rating: 5, comment: "Serious fish. Worth the wait." }],
  },
  {
    slug: "nyamirambo-injera",
    name: "Nyamirambo Injera",
    description: "Ethiopian and Eritrean platters in a courtyard off KN 2.",
    city: "Kigali",
    neighborhood: "Nyamirambo",
    cuisine: "Ethiopian • East African",
    priceTier: "$",
    features: "family friendly, vegetarian options, outdoor seating",
    featuredTags: "local-favorite,groups",
    rating: 4.6,
    reviewCount: 241,
    cover: PHOTOS.african,
    photos: [PHOTOS.african, PHOTOS.veg],
    daysAgo: 90,
    dishes: [
      { name: "Vegetarian combination", price: 8000, description: "Misir, gomen, shiro on injera.", popular: true, dietary: "vegan" },
      { name: "Doro wat", price: 10500, description: "Berbere chicken, boiled egg." },
    ],
    reviews: [{ author: "Hanna", rating: 5, comment: "Tastes like home. Come hungry." }],
    groupTables: true,
  },
  {
    slug: "kacyiru-copper-pot",
    name: "Kacyiru Copper Pot",
    description: "French bistro plates and a short list of Burgundy by the glass.",
    city: "Kigali",
    neighborhood: "Kacyiru",
    cuisine: "French",
    priceTier: "$$$",
    features: "date night, wine, business dining",
    featuredTags: "date-night,business",
    rating: 4.7,
    reviewCount: 133,
    cover: PHOTOS.plated,
    photos: [PHOTOS.plated, PHOTOS.interior, PHOTOS.cocktail],
    daysAgo: 30,
    dishes: [
      { name: "Duck confit", price: 24000, description: "Sarladaise potatoes, bitter greens.", popular: true },
      { name: "Onion soup", price: 7500, description: "Comté crust, dark stock." },
    ],
    reviews: [{ author: "Sophie", rating: 4.5, comment: "Proper bistro cooking." }],
  },
  {
    slug: "gisozi-bao",
    name: "Gisozi Bao",
    description: "Steamed buns, chili oil noodles, late kitchen on Fridays.",
    city: "Kigali",
    neighborhood: "Gisozi",
    cuisine: "Chinese • Pan-Asian",
    priceTier: "$",
    features: "open late, casual",
    featuredTags: "open-late,new",
    rating: 4.4,
    reviewCount: 87,
    cover: PHOTOS.chinese,
    photos: [PHOTOS.chinese, PHOTOS.interior],
    daysAgo: 6,
    late: true,
    dishes: [
      { name: "Pork bao (3)", price: 6500, description: "Hoison, pickled cucumber.", popular: true },
      { name: "Dan dan noodles", price: 8000, description: "Sesame, Sichuan pepper." },
    ],
    reviews: [{ author: "Leo", rating: 4, comment: "Go for the chili oil." }],
  },
  {
    slug: "kimironko-harvest",
    name: "Kimironko Harvest",
    description: "Vegetable-led plates from the Kimironko market morning haul.",
    city: "Kigali",
    neighborhood: "Kimironko",
    cuisine: "Vegetarian • Rwandan",
    priceTier: "$$",
    features: "vegetarian, family friendly",
    featuredTags: "vegetarian,local-favorite",
    rating: 4.5,
    reviewCount: 119,
    cover: PHOTOS.veg,
    photos: [PHOTOS.veg, PHOTOS.brunch],
    daysAgo: 25,
    dishes: [
      { name: "Isombe bowl", price: 7000, description: "Cassava leaves, peanut, rice.", popular: true, dietary: "vegan" },
      { name: "Roasted pumpkin", price: 6500, description: "Chili honey, yogurt.", dietary: "vegetarian" },
    ],
    reviews: [{ author: "Aline", rating: 5, comment: "Bright, seasonal, filling." }],
  },
  {
    slug: "kigali-heights-roast",
    name: "Heights Roast",
    description: "Daytime bakery and all-day breakfast under Kigali Heights.",
    city: "Kigali",
    neighborhood: "Kigali Heights",
    cuisine: "Cafe • Bakery",
    priceTier: "$",
    features: "family friendly, brunch, wifi",
    featuredTags: "brunch,cafe",
    rating: 4.3,
    reviewCount: 302,
    cover: PHOTOS.bakery,
    photos: [PHOTOS.bakery, PHOTOS.cafe, PHOTOS.brunch],
    daysAgo: 110,
    dishes: [
      { name: "Cardamom bun", price: 2500, description: "Butter, sugar, morning bake.", popular: true, dietary: "vegetarian" },
      { name: "Eggs on isombe toast", price: 6500, description: "Soft scramble, chili oil." },
    ],
    reviews: [{ author: "Emma", rating: 4, comment: "Best coffee in the mall." }],
  },
  {
    slug: "cbd-steel-and-smoke",
    name: "Steel & Smoke",
    description: "Steakhouse and dry-aged cuts for groups in the CBD.",
    city: "Kigali",
    neighborhood: "CBD",
    cuisine: "Steakhouse • Grill",
    priceTier: "$$$",
    features: "groups, business dining, private dining",
    featuredTags: "groups,business,grill",
    rating: 4.6,
    reviewCount: 178,
    cover: PHOTOS.steak,
    photos: [PHOTOS.steak, PHOTOS.interior],
    daysAgo: 18,
    dishes: [
      { name: "Ribeye 400g", price: 32000, description: "Salt, fire, bone marrow butter.", popular: true },
      { name: "Sharing board", price: 54000, description: "For four. Sausage, steak, lamb." },
    ],
    reviews: [{ author: "David", rating: 5, comment: "Took the team. Perfect." }],
    groupTables: true,
  },
  {
    slug: "remera-slice",
    name: "Remera Slice",
    description: "Wood-fired pies until midnight on weekends.",
    city: "Kigali",
    neighborhood: "Remera",
    cuisine: "Pizza • Italian",
    priceTier: "$",
    features: "open late, family friendly, outdoor seating",
    featuredTags: "open-late,groups",
    rating: 4.2,
    reviewCount: 265,
    cover: PHOTOS.pizza,
    photos: [PHOTOS.pizza, PHOTOS.interior],
    daysAgo: 70,
    late: true,
    dishes: [
      { name: "Margherita", price: 8000, description: "San Marzano, fior di latte.", popular: true, dietary: "vegetarian" },
      { name: "Ndagala pie", price: 9500, description: "Lake sardines, chili, mozzarella." },
    ],
    reviews: [{ author: "Yves", rating: 4, comment: "Late pizza that is actually good." }],
    groupTables: true,
  },
  {
    slug: "nyarutarama-meze",
    name: "Nyarutarama Meze",
    description: "Levantine mezze and charcoal meats under the jacarandas.",
    city: "Kigali",
    neighborhood: "Nyarutarama",
    cuisine: "Lebanese",
    priceTier: "$$",
    features: "outdoor seating, date night, vegetarian options",
    featuredTags: "date-night,outdoor",
    rating: 4.6,
    reviewCount: 144,
    cover: PHOTOS.plated,
    photos: [PHOTOS.plated, PHOTOS.veg, PHOTOS.interior],
    daysAgo: 22,
    dishes: [
      { name: "Hummus & lamb", price: 12000, description: "Warm chickpeas, spiced mince.", popular: true },
      { name: "Fattoush", price: 6000, description: "Pomegranate molasses, fried bread.", dietary: "vegan" },
    ],
    reviews: [{ author: "Rania", rating: 5, comment: "The garden tables at dusk." }],
  },
  {
    slug: "kigali-burger-club",
    name: "Kigali Burger Club",
    description: "Smashed patties, pickles, and a milkshake counter.",
    city: "Kigali",
    neighborhood: "Kimihurura",
    cuisine: "Burgers • American",
    priceTier: "$",
    features: "family friendly, casual",
    featuredTags: "casual,groups",
    rating: 4.1,
    reviewCount: 410,
    cover: PHOTOS.burger,
    photos: [PHOTOS.burger, PHOTOS.interior],
    daysAgo: 95,
    dishes: [
      { name: "Club smash", price: 7500, description: "Double patty, American cheese.", popular: true },
      { name: "Mushroom melt", price: 7000, description: "Agaricus, Swiss, rye.", dietary: "vegetarian" },
    ],
    reviews: [{ author: "Tom", rating: 4, comment: "Messy in the right way." }],
    groupTables: true,
  },
  {
    slug: "musanze-volcano-table",
    name: "Volcano Table",
    description: "Mountain vegetables and grilled trout after a park day.",
    city: "Musanze",
    neighborhood: "Town Center",
    cuisine: "Rwandan • Grill",
    priceTier: "$$",
    features: "family friendly, outdoor seating",
    featuredTags: "local-favorite,regional",
    rating: 4.7,
    reviewCount: 92,
    cover: PHOTOS.grill,
    photos: [PHOTOS.grill, PHOTOS.african],
    daysAgo: 14,
    dishes: [
      { name: "Volcano trout", price: 13500, description: "Charred lemon, irish potatoes.", popular: true },
      { name: "Gorilla trail stew", price: 9000, description: "Beef, plantain, broth." },
    ],
    reviews: [{ author: "Claire", rating: 5, comment: "Eat here after the hike." }],
    groupTables: true,
  },
  {
    slug: "musanze-cloud-cafe",
    name: "Cloud Café Musanze",
    description: "High-altitude coffee and short lunch plates.",
    city: "Musanze",
    neighborhood: "Town Center",
    cuisine: "Cafe",
    priceTier: "$",
    features: "wifi, brunch",
    featuredTags: "cafe,brunch",
    rating: 4.4,
    reviewCount: 77,
    cover: PHOTOS.cafe,
    photos: [PHOTOS.cafe, PHOTOS.bakery],
    daysAgo: 12,
    dishes: [
      { name: "Pour-over", price: 3000, description: "Northern Province lot.", popular: true, dietary: "vegan" },
      { name: "Avocado toast", price: 5500, description: "Chili, lime, sourdough.", dietary: "vegetarian" },
    ],
    reviews: [{ author: "Noah", rating: 4, comment: "Good beans, slow wifi. Fine." }],
  },
  {
    slug: "musanze-firepit",
    name: "Musanze Firepit",
    description: "Shared grills for groups coming down from the volcanoes.",
    city: "Musanze",
    neighborhood: "Kinigi Road",
    cuisine: "Grill • Rwandan",
    priceTier: "$$",
    features: "groups, outdoor seating, family friendly",
    featuredTags: "groups,grill",
    rating: 4.5,
    reviewCount: 61,
    cover: PHOTOS.african,
    photos: [PHOTOS.african, PHOTOS.grill],
    daysAgo: 9,
    dishes: [
      { name: "Firepit mixed grill", price: 28000, description: "For three to four.", popular: true },
      { name: "Ibijumba mash", price: 4000, description: "Sweet potato, brown butter.", dietary: "vegetarian" },
    ],
    reviews: [{ author: "Patrick", rating: 4.5, comment: "Bring a group. Order the grill." }],
    groupTables: true,
  },
  {
    slug: "kivu-shore-kitchen",
    name: "Kivu Shore Kitchen",
    description: "Lake fish and sundowners on the Rubavu waterfront.",
    city: "Rubavu",
    neighborhood: "Waterfront",
    cuisine: "Seafood • Rwandan",
    priceTier: "$$",
    features: "outdoor seating, date night, sunset",
    featuredTags: "date-night,regional,open-late",
    rating: 4.8,
    reviewCount: 189,
    cover: PHOTOS.lake,
    photos: [PHOTOS.lake, PHOTOS.seafood, PHOTOS.cocktail],
    daysAgo: 16,
    late: true,
    dishes: [
      { name: "Kivu sambaza", price: 8000, description: "Fried lake sardines, lime.", popular: true },
      { name: "Whole tilapia", price: 14000, description: "Grilled over charcoal." },
    ],
    reviews: [{ author: "Ines", rating: 5, comment: "Sunset table if you can get it." }],
  },
  {
    slug: "rubavu-palm-house",
    name: "Palm House Rubavu",
    description: "Long lunches, cold beer, and a sandy garden.",
    city: "Rubavu",
    neighborhood: "Gisenyi",
    cuisine: "International • Seafood",
    priceTier: "$$",
    features: "family friendly, outdoor seating, groups",
    featuredTags: "groups,regional",
    rating: 4.3,
    reviewCount: 154,
    cover: PHOTOS.seafood,
    photos: [PHOTOS.seafood, PHOTOS.interior],
    daysAgo: 45,
    dishes: [
      { name: "Grilled prawns", price: 18000, description: "Garlic butter, fries.", popular: true },
      { name: "Club sandwich", price: 9000, description: "Chicken, avocado, toast." },
    ],
    reviews: [{ author: "Sam", rating: 4, comment: "Holiday energy, decent fish." }],
    groupTables: true,
  },
  {
    slug: "rubavu-night-market",
    name: "Rubavu Night Market",
    description: "Street grills plated properly after 18:00.",
    city: "Rubavu",
    neighborhood: "Town",
    cuisine: "Street food • Grill",
    priceTier: "$",
    features: "open late, casual, outdoor seating",
    featuredTags: "open-late,local-favorite",
    rating: 4.4,
    reviewCount: 203,
    cover: PHOTOS.grill,
    photos: [PHOTOS.grill, PHOTOS.african],
    daysAgo: 5,
    late: true,
    dishes: [
      { name: "Brochette plate", price: 5500, description: "Beef, onion, chili.", popular: true },
      { name: "Chapati wrap", price: 4000, description: "Egg, cabbage, sauce.", dietary: "vegetarian" },
    ],
    reviews: [{ author: "Jean", rating: 4, comment: "Cheap, loud, good." }],
  },
  {
    slug: "huye-campus-table",
    name: "Campus Table Huye",
    description: "University-town cooking: beans, rice, and a serious stew.",
    city: "Huye",
    neighborhood: "Campus",
    cuisine: "Rwandan",
    priceTier: "$",
    features: "family friendly, casual",
    featuredTags: "local-favorite,regional",
    rating: 4.5,
    reviewCount: 128,
    cover: PHOTOS.african,
    photos: [PHOTOS.african, PHOTOS.interior],
    daysAgo: 33,
    dishes: [
      { name: "Ibihaza stew", price: 5000, description: "Pumpkin, groundnuts, rice.", popular: true, dietary: "vegan" },
      { name: "Beef agatogo", price: 7500, description: "Tomato, plantain." },
    ],
    reviews: [{ author: "Divine", rating: 5, comment: "Students and lecturers both eat here." }],
  },
  {
    slug: "huye-southern-grill",
    name: "Southern Grill Huye",
    description: "Weekend nyama choma and live radio from the courtyard.",
    city: "Huye",
    neighborhood: "Town Center",
    cuisine: "Grill • Rwandan",
    priceTier: "$$",
    features: "groups, outdoor seating, family friendly",
    featuredTags: "groups,grill,regional",
    rating: 4.4,
    reviewCount: 86,
    cover: PHOTOS.grill,
    photos: [PHOTOS.grill, PHOTOS.interior],
    daysAgo: 19,
    dishes: [
      { name: "Half chicken", price: 9000, description: "Pili pili, fries.", popular: true },
      { name: "Mixed nyama", price: 16000, description: "Goat, beef, sausage." },
    ],
    reviews: [{ author: "Eric", rating: 4, comment: "Saturday lunch is the move." }],
    groupTables: true,
  },
  {
    slug: "huye-library-cafe",
    name: "Library Café Huye",
    description: "Quiet tables, pastry, and filter coffee near the cathedral.",
    city: "Huye",
    neighborhood: "Cathedral",
    cuisine: "Cafe",
    priceTier: "$",
    features: "wifi, brunch",
    featuredTags: "cafe,new",
    rating: 4.2,
    reviewCount: 41,
    cover: PHOTOS.cafe,
    photos: [PHOTOS.cafe, PHOTOS.bakery],
    daysAgo: 4,
    dishes: [
      { name: "Filter coffee", price: 2500, description: "Huye hills lot.", popular: true, dietary: "vegan" },
      { name: "Banana bread", price: 2000, description: "Walnut, brown sugar.", dietary: "vegetarian" },
    ],
    reviews: [{ author: "Chantal", rating: 4, comment: "Best place to read in town." }],
  },
  {
    slug: "kigali-rooftop-verde",
    name: "Rooftop Verde",
    description: "Herbs, cocktails, and city lights over Kimihurura.",
    city: "Kigali",
    neighborhood: "Kimihurura",
    cuisine: "International • Cocktail",
    priceTier: "$$$",
    features: "date night, open late, rooftop",
    featuredTags: "date-night,open-late,trending",
    rating: 4.7,
    reviewCount: 221,
    cover: PHOTOS.rooftop,
    photos: [PHOTOS.rooftop, PHOTOS.cocktail, PHOTOS.plated],
    daysAgo: 11,
    late: true,
    dishes: [
      { name: "Herb chicken", price: 18000, description: "Charred lemon, farro.", popular: true },
      { name: "Verde sour", price: 8000, description: "Passion fruit, gin, basil." },
    ],
    reviews: [{ author: "Maya", rating: 5, comment: "Dress up. Stay for a second drink." }],
  },
  {
    slug: "kacyiru-noodle-bar",
    name: "Kacyiru Noodle Bar",
    description: "Broths all day, chili on the table, stools at the counter.",
    city: "Kigali",
    neighborhood: "Kacyiru",
    cuisine: "Pan-Asian",
    priceTier: "$",
    features: "casual, open late",
    featuredTags: "open-late,casual",
    rating: 4.3,
    reviewCount: 167,
    cover: PHOTOS.chinese,
    photos: [PHOTOS.chinese, PHOTOS.interior],
    daysAgo: 27,
    late: true,
    dishes: [
      { name: "Chicken ramen", price: 9000, description: "Clear broth, ajitama.", popular: true },
      { name: "Veg gyoza", price: 5500, description: "Six pieces, vinegar.", dietary: "vegetarian" },
    ],
    reviews: [{ author: "Ben", rating: 4, comment: "Fast, hot, consistent." }],
  },
];

function lateHours(base: Hours): Hours {
  return base.map((h) => ({ ...h, close: h.day === "Sunday" ? "22:00" : "00:00" }));
}

function sectionForDish(name: string, cuisine: string, index: number) {
  const n = name.toLowerCase();
  if (/wine|beer|cocktail|juice|latte|espresso|tea|soda|coffee|drink/.test(n)) return "Drinks";
  if (/dessert|cake|mousse|ice cream|tart|brownie/.test(n)) return "Dinner";
  if (/breakfast|brunch|pancake|omelette|croissant|granola|toast/.test(n) || /cafe/i.test(cuisine)) {
    return index === 0 ? "Breakfast" : "Lunch";
  }
  if (/salad|sandwich|soup|wrap|burger/.test(n)) return "Lunch";
  return index === 0 ? "Lunch" : "Dinner";
}

export async function seedCatalog(prisma: PrismaClient, hours: Hours) {
  await prisma.city.createMany({
    data: [
      { slug: "kigali", name: "Kigali", region: "City of Kigali" },
      { slug: "gasabo", name: "Gasabo", region: "City of Kigali" },
      { slug: "kicukiro", name: "Kicukiro", region: "City of Kigali" },
      { slug: "nyarugenge", name: "Nyarugenge", region: "City of Kigali" },
      { slug: "burera", name: "Burera", region: "Northern Province" },
      { slug: "gakenke", name: "Gakenke", region: "Northern Province" },
      { slug: "gicumbi", name: "Gicumbi", region: "Northern Province" },
      { slug: "musanze", name: "Musanze", region: "Northern Province" },
      { slug: "rulindo", name: "Rulindo", region: "Northern Province" },
      { slug: "gisagara", name: "Gisagara", region: "Southern Province" },
      { slug: "huye", name: "Huye", region: "Southern Province" },
      { slug: "kamonyi", name: "Kamonyi", region: "Southern Province" },
      { slug: "muhanga", name: "Muhanga", region: "Southern Province" },
      { slug: "nyamagabe", name: "Nyamagabe", region: "Southern Province" },
      { slug: "nyanza", name: "Nyanza", region: "Southern Province" },
      { slug: "nyaruguru", name: "Nyaruguru", region: "Southern Province" },
      { slug: "ruhango", name: "Ruhango", region: "Southern Province" },
      { slug: "bugesera", name: "Bugesera", region: "Eastern Province" },
      { slug: "gatsibo", name: "Gatsibo", region: "Eastern Province" },
      { slug: "kayonza", name: "Kayonza", region: "Eastern Province" },
      { slug: "kirehe", name: "Kirehe", region: "Eastern Province" },
      { slug: "ngoma", name: "Ngoma", region: "Eastern Province" },
      { slug: "nyagatare", name: "Nyagatare", region: "Eastern Province" },
      { slug: "rwamagana", name: "Rwamagana", region: "Eastern Province" },
      { slug: "karongi", name: "Karongi", region: "Western Province" },
      { slug: "ngororero", name: "Ngororero", region: "Western Province" },
      { slug: "nyabihu", name: "Nyabihu", region: "Western Province" },
      { slug: "nyamasheke", name: "Nyamasheke", region: "Western Province" },
      { slug: "rubavu", name: "Rubavu", region: "Western Province" },
      { slug: "rusizi", name: "Rusizi", region: "Western Province" },
      { slug: "rutsiro", name: "Rutsiro", region: "Western Province" },
    ],
  });

  for (const item of CATALOG) {
    const publishedAt = new Date();
    publishedAt.setDate(publishedAt.getDate() - item.daysAgo);
    const coords = COORDS[item.city] ?? COORDS.Kigali;
    const restaurant = await prisma.restaurant.create({
      data: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        city: item.city,
        neighborhood: item.neighborhood,
        country: "Rwanda",
        cuisine: item.cuisine,
        priceTier: item.priceTier,
        features: item.features,
        featuredTags: item.featuredTags,
        rating: item.rating,
        reviewCount: item.reviewCount,
        status: "ACTIVE",
        publishedAt,
        coverUrl: img(item.cover),
        address: `${item.neighborhood}, ${item.city}`,
        openingHours: item.late ? lateHours(hours) : hours,
        images: {
          create: item.photos.map((photo, sort) => ({
            url: img(photo),
            alt: `${item.name} ${sort === 0 ? "dining room" : "plate"}`,
            sort,
          })),
        },
      },
    });

    const branch = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        code: "MAIN",
        name: item.neighborhood,
        city: item.city,
        neighborhood: item.neighborhood,
        address: restaurant.address,
        lat: coords.lat + (Math.random() - 0.5) * 0.04,
        lng: coords.lng + (Math.random() - 0.5) * 0.04,
        isPrimary: true,
      },
    });

    const tableData = item.groupTables
      ? [
          { code: "T01", seats: 2, posX: 1, posY: 1 },
          { code: "T02", seats: 4, posX: 2, posY: 1 },
          { code: "T03", seats: 4, posX: 3, posY: 1 },
          { code: "T04", seats: 6, posX: 1, posY: 2 },
          { code: "T05", seats: 8, posX: 2, posY: 2 },
        ]
      : [
          { code: "T01", seats: 2, posX: 1, posY: 1 },
          { code: "T02", seats: 2, posX: 2, posY: 1 },
          { code: "T03", seats: 4, posX: 3, posY: 1 },
          { code: "T04", seats: 4, posX: 1, posY: 2 },
        ];
    await prisma.diningTable.createMany({
      data: tableData.map((t) => ({ ...t, branchId: branch.id })),
    });

    const mains = await prisma.menuCategory.create({ data: { restaurantId: restaurant.id, name: "Dinner" } });
    const lunch = await prisma.menuCategory.create({ data: { restaurantId: restaurant.id, name: "Lunch" } });
    const breakfast = await prisma.menuCategory.create({ data: { restaurantId: restaurant.id, name: "Breakfast" } });
    const drinks = await prisma.menuCategory.create({ data: { restaurantId: restaurant.id, name: "Drinks" } });
    for (const [index, dish] of item.dishes.entries()) {
      const section = sectionForDish(dish.name, item.cuisine, index);
      const categoryId = section === "Breakfast" ? breakfast.id : section === "Lunch" ? lunch.id : section === "Drinks" ? drinks.id : mains.id;
      await prisma.menuItem.create({
        data: {
          categoryId,
          name: dish.name,
          description: dish.description,
          price: dish.price,
          dietary: dish.dietary ?? "",
          popular: Boolean(dish.popular),
          imageUrl: dishStockPhoto(dish.name),
        },
      });
    }

    if (item.reviews.length) {
      await prisma.review.createMany({
        data: item.reviews.map((r) => ({
          restaurantId: restaurant.id,
          author: r.author,
          rating: Math.round(r.rating),
          food: Math.round(r.rating),
          service: Math.round(r.rating),
          ambience: Math.round(r.rating),
          comment: r.comment,
          status: "APPROVED",
          moderatedAt: new Date(),
        })),
      });
      const avg = item.reviews.reduce((s, r) => s + r.rating, 0) / item.reviews.length;
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          rating: Number(avg.toFixed(2)),
          ratingFood: Number(avg.toFixed(2)),
          ratingService: Number(avg.toFixed(2)),
          ratingAmbience: Number(avg.toFixed(2)),
          reviewCount: item.reviews.length,
        },
      });
    }
  }
}
