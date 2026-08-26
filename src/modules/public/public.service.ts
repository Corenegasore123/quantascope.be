import { Inject, Injectable } from "@nestjs/common";
import { Prisma, ReservationStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/app-error";
import { RecommendationService } from "./recommendation.service";
import {
  PUBLIC_SLOT_TIMES,
  isOpenNow,
  openUntil,
  parseHours,
  splitTags,
  type PublicCard,
  type PublicMenuItem,
  groupMenuSections,
} from "./public.util";
import { resolveDishImage } from "../../shared/dish-photos";

const ACTIVE = { status: "ACTIVE" as const };
const HELD: ReservationStatus[] = ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "SEATED"];
const KIGALI_DISTRICTS = new Set(["gasabo", "kicukiro", "nyarugenge"]);

function restaurantCityKey(placeName: string) {
  const key = placeName.trim().toLowerCase();
  if (key === "kigali" || KIGALI_DISTRICTS.has(key)) return "kigali";
  return key;
}

function restaurantMatchesPlace(restaurantCity: string, placeName: string) {
  return restaurantCity.trim().toLowerCase() === restaurantCityKey(placeName);
}

function numericField(row: object, key: string) {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

type ProfileReview = {
  id: string;
  author: string;
  rating: number;
  food: number;
  service: number;
  ambience: number;
  comment: string;
  createdAt: Date;
  images: { url: string; alt: string }[];
};

function loadApprovedReviews(db: PrismaService, restaurantId: string) {
  return (
    db as unknown as {
      review: {
        findMany: (args: {
          where: { restaurantId: string; status: "APPROVED" };
          include: { images: true };
          orderBy: { createdAt: "desc" };
          take: number;
        }) => Promise<ProfileReview[]>;
      };
    }
  ).review.findMany({
    where: { restaurantId, status: "APPROVED" },
    include: { images: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}

export type ListQuery = {
  city?: string;
  q?: string;
  cuisine?: string;
  neighborhood?: string;
  price?: string;
  rating?: string;
  feature?: string;
  openNow?: string;
  available?: string;
  date?: string;
  time?: string;
  guests?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
};

@Injectable()
export class PublicService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RecommendationService) private readonly recs: RecommendationService
  ) {}

  async cities() {
    const cities = await this.prisma.city.findMany({ orderBy: { name: "asc" } });
    const restaurants = await this.prisma.restaurant.findMany({
      where: ACTIVE,
      select: { city: true, coverUrl: true, cuisine: true, neighborhood: true },
    });
    const rows = cities.map((city) => {
      const inCity = restaurants.filter((r) => restaurantMatchesPlace(r.city, city.name));
      const cuisines = [...new Set(inCity.map((r) => r.cuisine.split(/[•,]/)[0].trim()).filter(Boolean))].slice(0, 5);
      const neighborhoods = [...new Set(inCity.map((r) => r.neighborhood).filter(Boolean))].slice(0, 6);
      return {
        slug: city.slug,
        name: city.name,
        region: city.region,
        restaurantCount: inCity.length,
        coverUrl: inCity.find((r) => r.coverUrl)?.coverUrl ?? null,
        cuisines,
        neighborhoods,
        featured: inCity.length > 0 && !KIGALI_DISTRICTS.has(city.name.toLowerCase()),
      };
    });
    return rows.sort((a, b) => b.restaurantCount - a.restaurantCount || a.name.localeCompare(b.name));
  }

  async cityPage(slug: string) {
    const city = await this.prisma.city.findFirst({
      where: { slug: { equals: slug, mode: "insensitive" } },
    });
    if (!city) throw new AppError(404, "City not found", "NOT_FOUND");
    const filterCity =
      restaurantCityKey(city.name) === "kigali" ? "Kigali" : city.name;
    const cards = await this.decorate(await this.loadActive({ city: filterCity }));
    const neighborhoods = [...new Map(
      cards
        .filter((c) => c.neighborhood)
        .map((c) => [c.neighborhood, cards.filter((x) => x.neighborhood === c.neighborhood).length])
    )].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const featured = cards
      .filter((c) => c.featuredTags.includes("local-favorite") || c.featuredTags.includes("trending") || c.featuredTags.includes("date-night"))
      .slice(0, 8);
    return {
      city: { slug: city.slug, name: city.name, region: city.region },
      restaurantCount: cards.length,
      cuisines: this.groupCuisines(cards).map((g) => ({ name: g.name, count: g.items.length })),
      neighborhoods,
      featured: featured.length ? featured : cards.slice(0, 8),
      availableTonight: cards.filter((c) => c.nextSlots.some((s) => s.available > 0)).slice(0, 8),
      coverUrl: cards.find((c) => c.coverUrl)?.coverUrl ?? null,
    };
  }

  async home(city?: string) {
    const scope = city?.trim() || undefined;
    const cards = await this.decorate(await this.loadActive(scope ? { city: scope } : {}));
    const ranked = this.recs.rank(cards);
    const tonight = cards.filter((c) => c.nextSlots.some((s) => s.available > 0));
    const cuisineGroups = this.groupCuisines(cards);
    const label = scope ?? "Rwanda";
    return {
      city: label,
      demo: true,
      rails: [
        { id: "popular", title: `Popular in ${label}`, items: ranked.slice(0, 8) },
        { id: "tonight", title: "Available tonight", items: tonight.slice(0, 8) },
        { id: "rated", title: "Highly rated", items: [...cards].sort((a, b) => b.rating - a.rating).slice(0, 8) },
        { id: "new", title: "New on Nexora", items: [...cards].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 8) },
        {
          id: "groups",
          title: "Perfect for groups",
          items: cards.filter((c) => c.featuredTags.includes("groups") || c.tags.some((t) => /group/i.test(t))).slice(0, 8),
        },
        { id: "date", title: "Date night", items: cards.filter((c) => c.featuredTags.includes("date-night")).slice(0, 8) },
        { id: "local", title: "Local favorites", items: cards.filter((c) => c.featuredTags.includes("local-favorite")).slice(0, 8) },
        {
          id: "cuisine",
          title: cuisineGroups[0] ? `${cuisineGroups[0].name} cuisine` : "Regional cuisine",
          items: cuisineGroups[0]?.items.slice(0, 8) ?? [],
        },
        { id: "open", title: "Open now", items: cards.filter((c) => c.openNow).slice(0, 8) },
        {
          id: "trending",
          title: "Trending this week",
          items: cards.filter((c) => c.featuredTags.includes("trending") || c.reasons.includes("booked often this week")).slice(0, 8),
        },
      ].filter((r) => r.items.length),
    };
  }

  async list(query: ListQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(24, Math.max(1, Number(query.pageSize) || 12));
    const rows = await this.loadActive(query);
    let cards = await this.decorate(rows, {
      date: query.date,
      time: query.time,
      guests: Number(query.guests || 2),
    });

    if (query.openNow === "1") cards = cards.filter((c) => c.openNow);
    if (query.available === "1") cards = cards.filter((c) => c.nextSlots.some((s) => s.available > 0));

    const sort = query.sort || "recommended";
    if (sort === "rating") cards.sort((a, b) => b.rating - a.rating);
    else if (sort === "reviews") cards.sort((a, b) => b.reviewCount - a.reviewCount);
    else if (sort === "price") cards.sort((a, b) => a.priceTier.length - b.priceTier.length || a.name.localeCompare(b.name));
    else if (sort === "newest") cards.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    else cards = this.recs.rank(cards);

    const total = cards.length;
    const items = cards.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async search(query: ListQuery) {
    return this.list(query);
  }

  async suggest(q = "") {
    const term = q.trim();
    if (term.length < 2) {
      const popular = await this.prisma.restaurant.findMany({
        where: ACTIVE,
        orderBy: { reviewCount: "desc" },
        take: 6,
        select: { slug: true, name: true, cuisine: true, city: true },
      });
      return { recent: [], popular: popular.map((r) => ({ type: "restaurant" as const, ...r })) };
    }
    const [restaurants, dishes, neighborhoods] = await Promise.all([
      this.prisma.restaurant.findMany({
        where: {
          ...ACTIVE,
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { cuisine: { contains: term, mode: "insensitive" } },
            { neighborhood: { contains: term, mode: "insensitive" } },
          ],
        },
        take: 6,
        select: { slug: true, name: true, cuisine: true, city: true },
      }),
      this.prisma.menuItem.findMany({
        where: { active: true, name: { contains: term, mode: "insensitive" }, category: { restaurant: ACTIVE } },
        take: 4,
        select: { name: true, category: { select: { restaurant: { select: { slug: true, name: true } } } } },
      }),
      this.prisma.restaurant.findMany({
        where: { ...ACTIVE, neighborhood: { contains: term, mode: "insensitive" } },
        distinct: ["neighborhood"],
        take: 4,
        select: { neighborhood: true, city: true },
      }),
    ]);
    return {
      restaurants: restaurants.map((r) => ({ type: "restaurant" as const, ...r })),
      dishes: dishes
        .filter((d) => d.category.restaurant)
        .map((d) => ({
          type: "dish" as const,
          name: d.name,
          restaurant: d.category.restaurant!.name,
          slug: d.category.restaurant!.slug,
        })),
      neighborhoods: neighborhoods
        .filter((n) => n.neighborhood)
        .map((n) => ({ type: "neighborhood" as const, name: n.neighborhood, city: n.city })),
    };
  }

  async restaurant(slug: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { OR: [{ slug }, { id: slug }], ...ACTIVE },
      include: {
        images: { orderBy: { sort: "asc" } },
        branches: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    });
    if (!restaurant) throw new AppError(404, "Restaurant not found", "NOT_FOUND");
    const [menu, approvedReviews, cards] = await Promise.all([
      this.prisma.menuItem.findMany({
        where: { active: true, category: { restaurantId: restaurant.id } },
        include: { category: true },
        orderBy: [{ popular: "desc" }, { name: "asc" }],
      }),
      loadApprovedReviews(this.prisma, restaurant.id),
      this.decorate([restaurant]),
    ]);
    const card = cards[0];
    const hours = parseHours(restaurant.openingHours);
    const primary = restaurant.branches[0];
    const publicMenu = menu.map(
      (m): PublicMenuItem => ({
        id: m.id,
        name: m.name,
        description: m.description,
        price: m.price,
        dietary: m.dietary,
        popular: m.popular,
        imageUrl: resolveDishImage(m.name, m.imageUrl, restaurant.coverUrl),
        category: m.category.name,
      })
    );
    return {
      ...card,
      phone: restaurant.phone,
      website: restaurant.website,
      address: restaurant.address,
      openingHours: hours,
      openUntil: openUntil(hours),
      images: restaurant.images.map((i) => ({ url: i.url, alt: i.alt })),
      branches: restaurant.branches.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        neighborhood: b.neighborhood,
        address: b.address,
        lat: b.lat,
        lng: b.lng,
      })),
      ratingFood: card.ratingFood,
      ratingService: card.ratingService,
      ratingAmbience: card.ratingAmbience,
      reviews: approvedReviews.map((r) => ({
        id: r.id,
        author: r.author,
        rating: r.rating,
        food: r.food,
        service: r.service,
        ambience: r.ambience,
        comment: r.comment,
        createdAt: r.createdAt,
        images: r.images.map((i) => ({ url: i.url, alt: i.alt })),
      })),
      menu: publicMenu,
      menuSections: groupMenuSections(publicMenu),
      mapUrl:
        primary?.lat && primary?.lng
          ? `https://www.openstreetmap.org/?mlat=${primary.lat}&mlon=${primary.lng}#map=16/${primary.lat}/${primary.lng}`
          : null,
    };
  }

  availability(id: string, date: string, guests: number, branchId?: string) {
    return this.slotsFor(id, date, guests, branchId);
  }

  private async loadActive(query: Pick<ListQuery, "city" | "q" | "cuisine" | "neighborhood" | "price" | "rating" | "feature">) {
    const AND: Prisma.RestaurantWhereInput[] = [{ ...ACTIVE }];
    if (query.city) AND.push({ city: { contains: query.city, mode: "insensitive" } });
    if (query.cuisine) AND.push({ cuisine: { contains: query.cuisine, mode: "insensitive" } });
    if (query.neighborhood) AND.push({ neighborhood: { contains: query.neighborhood, mode: "insensitive" } });
    if (query.price) AND.push({ priceTier: query.price });
    if (query.rating) AND.push({ rating: { gte: Number(query.rating) } });
    if (query.feature) {
      AND.push({
        OR: [
          { features: { contains: query.feature, mode: "insensitive" } },
          { featuredTags: { contains: query.feature, mode: "insensitive" } },
        ],
      });
    }
    if (query.q) {
      AND.push({
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { cuisine: { contains: query.q, mode: "insensitive" } },
          { neighborhood: { contains: query.q, mode: "insensitive" } },
          { city: { contains: query.q, mode: "insensitive" } },
          { description: { contains: query.q, mode: "insensitive" } },
          { menuCategories: { some: { items: { some: { name: { contains: query.q, mode: "insensitive" } } } } } },
        ],
      });
    }
    return this.prisma.restaurant.findMany({
      where: { AND },
      include: {
        branches: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 },
        images: { orderBy: { sort: "asc" }, take: 1 },
      },
    });
  }

  private async decorate(
    restaurants: Awaited<ReturnType<PublicService["loadActive"]>>,
    opts?: { date?: string; time?: string; guests?: number }
  ): Promise<PublicCard[]> {
    if (!restaurants.length) return [];
    const ids = restaurants.map((r) => r.id);
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const date = opts?.date ? new Date(opts.date) : new Date();
    date.setHours(0, 0, 0, 0);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const guests = opts?.guests ?? 2;

    const [tables, reservations, popular] = await Promise.all([
      this.prisma.diningTable.findMany({
        where: { branch: { restaurantId: { in: ids } } },
        select: { id: true, seats: true, status: true, branch: { select: { restaurantId: true } } },
      }),
      this.prisma.reservation.findMany({
        where: {
          branch: { restaurantId: { in: ids } },
          date: { gte: date, lt: next },
          status: { in: HELD },
        },
        select: { time: true, tableId: true, branch: { select: { restaurantId: true } } },
      }),
      this.prisma.reservation.groupBy({
        by: ["branchId"],
        where: { createdAt: { gte: since }, branch: { restaurantId: { in: ids } } },
        _count: { _all: true },
      }),
    ]);

    const branchCounts = new Map(popular.map((p) => [p.branchId, p._count._all]));
    const branchToRestaurant = new Map<string, string>();
    for (const r of restaurants) {
      for (const b of r.branches) branchToRestaurant.set(b.id, r.id);
    }
    const res14 = new Map<string, number>();
    for (const [branchId, count] of branchCounts) {
      const rid = branchToRestaurant.get(branchId);
      if (rid) res14.set(rid, (res14.get(rid) ?? 0) + count);
    }

    return restaurants.map((r) => {
      const hours = parseHours(r.openingHours);
      const restTables = tables.filter((t) => t.branch.restaurantId === r.id);
      const restRes = reservations.filter((x) => x.branch.restaurantId === r.id);
      const nextSlots = PUBLIC_SLOT_TIMES.map((time) => {
        const taken = new Set(restRes.filter((x) => x.time === time).map((x) => x.tableId).filter(Boolean));
        const free = restTables.filter((t) => t.seats >= guests && !taken.has(t.id));
        return { time, available: free.length };
      });
      const firstSlot = nextSlots.find((s) => s.available > 0);
      const scored = this.recs.score({
        rating: r.rating,
        reviewCount: r.reviewCount,
        hasAvailability: Boolean(firstSlot),
        nextSlot: firstSlot?.time,
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
        reservations14d: res14.get(r.id) ?? 0,
      });
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        city: r.city,
        neighborhood: r.neighborhood,
        cuisine: r.cuisine,
        priceTier: r.priceTier,
        rating: r.rating,
        ratingFood: numericField(r, "ratingFood"),
        ratingService: numericField(r, "ratingService"),
        ratingAmbience: numericField(r, "ratingAmbience"),
        reviewCount: r.reviewCount,
        coverUrl: r.coverUrl ?? r.images[0]?.url ?? null,
        tags: splitTags(r.features),
        featuredTags: splitTags(r.featuredTags),
        openNow: isOpenNow(hours),
        publishedAt: r.publishedAt?.toISOString() ?? r.createdAt.toISOString(),
        nextSlots: nextSlots.filter((s) => s.available > 0).slice(0, 3),
        score: scored.score,
        reasons: scored.reasons,
      };
    });
  }

  private groupCuisines(cards: PublicCard[]) {
    const map = new Map<string, PublicCard[]>();
    for (const c of cards) {
      const key = c.cuisine.split(/[•,]/)[0].trim() || "Dining";
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.entries()]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }

  private async slotsFor(idOrSlug: string, date: string, guests: number, branchId?: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], ...ACTIVE },
      include: { branches: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
    });
    if (!restaurant) throw new AppError(404, "Restaurant not found", "NOT_FOUND");
    const branch = branchId ? restaurant.branches.find((b) => b.id === branchId) : restaurant.branches[0];
    if (!branch) throw new AppError(400, "No branch available", "NO_BRANCH");
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const tables = await this.prisma.diningTable.findMany({ where: { branchId: branch.id } });
    const reservations = await this.prisma.reservation.findMany({
      where: { branchId: branch.id, date: { gte: day, lt: next }, status: { in: HELD } },
    });
    return PUBLIC_SLOT_TIMES.map((time) => {
      const taken = new Set(reservations.filter((r) => r.time === time).map((r) => r.tableId).filter(Boolean));
      const free = tables.filter((t) => t.seats >= guests && !taken.has(t.id));
      return { time, available: free.length, label: free.length ? `${free.length} tables available` : "Fully booked" };
    });
  }

  async favorites(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: {
          include: {
            branches: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 },
            images: { orderBy: { sort: "asc" }, take: 1 },
          },
        },
      },
    });
    const active = rows.map((r) => r.restaurant).filter((r) => r.status === "ACTIVE");
    return { ids: rows.map((r) => r.restaurantId), items: await this.decorate(active) };
  }

  async toggleFavorite(userId: string, restaurantKey: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { OR: [{ id: restaurantKey }, { slug: restaurantKey }], ...ACTIVE },
    });
    if (!restaurant) throw new AppError(404, "Restaurant not found", "NOT_FOUND");
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_restaurantId: { userId, restaurantId: restaurant.id } },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { saved: false, restaurantId: restaurant.id, ids: await this.listFavoriteIds(userId) };
    }
    await this.prisma.favorite.create({ data: { userId, restaurantId: restaurant.id } });
    return { saved: true, restaurantId: restaurant.id, ids: await this.listFavoriteIds(userId) };
  }

  private listFavoriteIds(userId: string) {
    return this.prisma.favorite.findMany({ where: { userId }, select: { restaurantId: true } }).then((rows) =>
      rows.map((r) => r.restaurantId)
    );
  }
}
