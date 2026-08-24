import { Inject, Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { AccountStatus, ReservationStatus, RestaurantStatus } from "@prisma/client";
import type { User } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/app-error";
import { DEFAULT_OPENING_HOURS } from "../../shared/types";
import { RestaurantService } from "../restaurant/restaurant.service";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "restaurant"
  );
}

const SLOT_TIMES = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

@Injectable()
export class EcosystemService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RestaurantService) private readonly ops: RestaurantService
  ) {}

  async platformDashboard() {
    const [restaurants, owners, users, reservationsToday, ordersToday, list] = await Promise.all([
      this.prisma.restaurant.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.user.count({ where: { role: "OWNER" } }),
      this.prisma.user.count({ where: { role: { not: "PLATFORM_ADMIN" } } }),
      this.prisma.reservation.count({ where: { date: { gte: startOfDay() } } }),
      this.prisma.order.count({ where: { createdAt: { gte: startOfDay() } } }),
      this.prisma.restaurant.findMany({
        include: { owner: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const byStatus = Object.fromEntries(restaurants.map((r) => [r.status, r._count._all]));
    const total = restaurants.reduce((s, r) => s + r._count._all, 0);
    return {
      restaurants: total,
      active: byStatus.ACTIVE ?? 0,
      pending: byStatus.PENDING ?? 0,
      suspended: byStatus.SUSPENDED ?? 0,
      owners,
      users,
      reservationsToday,
      ordersToday,
      list: list.map((r) => ({
        id: r.id,
        name: r.name,
        city: r.city,
        status: r.status,
        owner: r.owner?.name ?? "Unassigned",
        ownerEmail: r.owner?.email ?? null,
      })),
    };
  }

  async createOwner(input: { name: string; email: string; phone?: string }) {
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new AppError(409, "An account with this email already exists", "EMAIL_EXISTS");
    }
    const temporaryPassword = `Nexora#${Math.floor(1000 + Math.random() * 9000)}`;
    const user = await this.prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        phone: input.phone,
        passwordHash: await bcrypt.hash(temporaryPassword, 12),
        role: "OWNER",
        accountStatus: AccountStatus.INVITED,
        mustChangePassword: true,
        title: "Restaurant Owner",
      },
      select: { id: true, name: true, email: true, phone: true, accountStatus: true, role: true },
    });
    return { user, temporaryPassword };
  }

  async createRestaurant(
    owner: User,
    input: {
      name: string;
      description?: string;
      phone?: string;
      email?: string;
      website?: string;
      address?: string;
      city?: string;
      country?: string;
      cuisine?: string;
      logoUrl?: string;
      coverUrl?: string;
    }
  ) {
    if (owner.role !== "OWNER") throw new AppError(403, "Only restaurant owners can create a restaurant", "FORBIDDEN");
    if (owner.restaurantId) throw new AppError(409, "This owner already has a restaurant", "HAS_RESTAURANT");
    const base = slugify(input.name);
    let slug = base;
    let n = 1;
    while (await this.prisma.restaurant.findUnique({ where: { slug } })) {
      slug = `${base}-${++n}`;
    }
    const restaurant = await this.prisma.restaurant.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description ?? "",
        phone: input.phone ?? "",
        email: input.email ?? owner.email,
        website: input.website ?? "",
        address: input.address ?? "",
        city: input.city ?? "Kigali",
        country: input.country ?? "Rwanda",
        cuisine: input.cuisine ?? "Rwandan",
        logoUrl: input.logoUrl || null,
        coverUrl: input.coverUrl || null,
        openingHours: DEFAULT_OPENING_HOURS,
        status: RestaurantStatus.PENDING,
        ownerId: owner.id,
      },
    });
    await this.prisma.user.update({ where: { id: owner.id }, data: { restaurantId: restaurant.id } });
    return restaurant;
  }

  async updateSettings(
    owner: User,
    input: {
      currency?: string;
      timezone?: string;
      taxRate?: number;
      openingHours?: { day: string; open: string; close: string }[];
      paymentMethods?: string;
    }
  ) {
    const restaurantId = owner.restaurantId;
    if (!restaurantId) throw new AppError(400, "Create your restaurant profile first", "NO_RESTAURANT");
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        currency: input.currency,
        timezone: input.timezone,
        taxRate: input.taxRate,
        openingHours: input.openingHours,
        paymentMethods: input.paymentMethods,
      },
    });
  }

  async addBranch(owner: User, input: { name: string; city: string; address?: string; code?: string }) {
    const restaurantId = owner.restaurantId;
    if (!restaurantId) throw new AppError(400, "Create your restaurant profile first", "NO_RESTAURANT");
    const count = await this.prisma.branch.count({ where: { restaurantId } });
    const code = (input.code || input.name.slice(0, 2)).toUpperCase().replace(/[^A-Z0-9]/g, "") + String(count + 1);
    return this.prisma.branch.create({
      data: {
        restaurantId,
        name: input.name.trim(),
        city: input.city.trim(),
        address: input.address ?? "",
        code,
      },
    });
  }

  async checklist(user: User) {
    const restaurantId = user.restaurantId;
    if (!restaurantId) {
      return {
        restaurant: false,
        business: false,
        branches: false,
        tables: false,
        categories: false,
        menu: false,
        recipes: false,
        ingredients: false,
        inventory: false,
        staff: false,
        reservations: false,
        payments: false,
        notifications: false,
      };
    }
    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
    const [branches, tables, categories, items, recipes, ingredients, staff] = await Promise.all([
      this.prisma.branch.count({ where: { restaurantId } }),
      this.prisma.diningTable.count({ where: { branch: { restaurantId } } }),
      this.prisma.menuCategory.count({ where: { restaurantId } }),
      this.prisma.menuItem.count({ where: { category: { restaurantId } } }),
      this.prisma.recipeLine.count({ where: { menuItem: { category: { restaurantId } } } }),
      this.prisma.ingredient.count({ where: { restaurantId } }),
      this.prisma.user.count({ where: { restaurantId, role: { notIn: ["OWNER", "CUSTOMER", "PLATFORM_ADMIN"] } } }),
    ]);
    return {
      restaurant: Boolean(restaurant.name),
      business: Boolean(restaurant.currency && restaurant.timezone),
      branches: branches > 0,
      tables: tables > 0,
      categories: categories > 0,
      menu: items > 0,
      recipes: recipes > 0,
      ingredients: ingredients > 0,
      inventory: ingredients > 0,
      staff: staff > 0,
      reservations: tables > 0,
      payments: Boolean(restaurant.paymentMethods),
      notifications: restaurant.notificationsOn,
    };
  }

  async discover(query: { city?: string; cuisine?: string; price?: string; minRating?: number; guests?: number }) {
    const restaurants = await this.prisma.restaurant.findMany({
      where: {
        status: "ACTIVE",
        ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {}),
        ...(query.cuisine ? { cuisine: { contains: query.cuisine, mode: "insensitive" } } : {}),
        ...(query.price ? { priceTier: query.price } : {}),
        ...(query.minRating ? { rating: { gte: query.minRating } } : {}),
      },
      include: { branches: { orderBy: { createdAt: "asc" }, take: 1 } },
      orderBy: { rating: "desc" },
    });
    return restaurants.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      city: r.city,
      cuisine: r.cuisine,
      priceTier: r.priceTier,
      rating: r.rating,
      reviewCount: r.reviewCount,
      branch: r.branches[0]?.name ?? r.address,
      available: true,
    }));
  }

  async publicRestaurant(idOrSlug: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], status: "ACTIVE" },
      include: {
        branches: { orderBy: { createdAt: "asc" } },
        reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 8 },
      },
    });
    if (!restaurant) throw new AppError(404, "Restaurant not found", "NOT_FOUND");
    const menu = await this.prisma.menuItem.findMany({
      where: { category: { restaurantId: restaurant.id }, active: true },
      include: { category: true },
      orderBy: { name: "asc" },
    });
    const hours = Array.isArray(restaurant.openingHours)
      ? (restaurant.openingHours as { day: string; open: string; close: string }[])
      : DEFAULT_OPENING_HOURS;
    return {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      description: restaurant.description,
      city: restaurant.city,
      cuisine: restaurant.cuisine,
      priceTier: restaurant.priceTier,
      rating: restaurant.rating,
      reviewCount: restaurant.reviewCount,
      branch: restaurant.branches[0]?.name ?? restaurant.address,
      available: true,
      address: restaurant.address,
      phone: restaurant.phone,
      website: restaurant.website,
      features: restaurant.features,
      coverUrl: restaurant.coverUrl,
      openingHours: hours,
      branches: restaurant.branches,
      reviews: restaurant.reviews,
      menu,
    };
  }

  async availability(restaurantId: string, date: string, guests: number, branchId?: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { OR: [{ id: restaurantId }, { slug: restaurantId }], status: "ACTIVE" },
      include: { branches: true },
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
      where: {
        branchId: branch.id,
        date: { gte: day, lt: next },
        status: { in: ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "SEATED"] },
      },
    });
    return SLOT_TIMES.map((time) => {
      const taken = new Set(reservations.filter((r) => r.time === time).map((r) => r.tableId).filter(Boolean));
      const free = tables.filter((t) => t.seats >= guests && !taken.has(t.id));
      return { time, available: free.length, label: free.length ? `${free.length} tables available` : "Fully booked" };
    });
  }

  async book(
    input: {
      restaurantId: string;
      branchId?: string;
      date: string;
      time: string;
      guests: number;
      name?: string;
      email?: string;
      phone?: string;
    },
    user?: User | null
  ) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { OR: [{ id: input.restaurantId }, { slug: input.restaurantId }], status: "ACTIVE" },
      include: { branches: true, users: { where: { role: { in: ["OWNER", "MANAGER"] } } } },
    });
    if (!restaurant) throw new AppError(404, "Restaurant not found", "NOT_FOUND");
    const branch = input.branchId
      ? restaurant.branches.find((b) => b.id === input.branchId)
      : restaurant.branches[0];
    if (!branch) throw new AppError(400, "No branch available", "NO_BRANCH");

    const name = (user?.role === "CUSTOMER" ? user.name : input.name)?.trim();
    if (!name) throw new AppError(400, "Guest name is required", "BAD_INPUT");
    const email = (user?.role === "CUSTOMER" ? user.email : input.email)?.trim().toLowerCase() || undefined;
    const phone = (user?.role === "CUSTOMER" ? user.phone : input.phone)?.trim() || input.phone?.trim() || undefined;

    const day = new Date(input.date);
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const tables = await this.prisma.diningTable.findMany({
      where: { branchId: branch.id },
      orderBy: { seats: "asc" },
    });
    const taken = await this.prisma.reservation.findMany({
      where: {
        branchId: branch.id,
        time: input.time,
        date: { gte: day, lt: next },
        status: { in: ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "SEATED"] },
      },
    });
    const takenIds = new Set(taken.map((r) => r.tableId).filter(Boolean));
    const table = tables.find((t) => t.seats >= input.guests && !takenIds.has(t.id));
    if (!table) throw new AppError(409, "No tables available at that time", "NO_AVAILABILITY");

    let customer =
      user?.role === "CUSTOMER"
        ? await this.prisma.customer.findUnique({ where: { userId: user.id } })
        : email
          ? await this.prisma.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
          : phone
            ? await this.prisma.customer.findFirst({ where: { phone } })
            : null;
    if (user?.role === "CUSTOMER" && !customer && email) {
      customer = await this.prisma.customer.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, userId: null },
      });
      if (customer) {
        customer = await this.prisma.customer.update({
          where: { id: customer.id },
          data: { userId: user.id, name: user.name, phone: phone ?? customer.phone },
        });
      }
    }
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          name,
          email: email || null,
          phone,
          userId: user?.role === "CUSTOMER" ? user.id : undefined,
        },
      });
    }

    const number = await this.ops.nextNumber("reservation", "RES-");
    const reservation = await this.prisma.reservation.create({
      data: {
        number,
        customerId: customer.id,
        branchId: branch.id,
        tableId: table.id,
        guests: input.guests,
        date: day,
        time: input.time,
        status: ReservationStatus.CONFIRMED,
      },
      include: { customer: true, table: true, branch: true },
    });
    await this.ops.refreshTableOccupancy(table.id);
    await this.prisma.notification.createMany({
      data: restaurant.users.map((u) => ({
        userId: u.id,
        title: "New reservation",
        body: `${input.time} · ${input.guests} guests · ${name} · ${table.code}`,
      })),
    });
    return {
      reservation: {
        ...reservation,
        table: { code: table.code },
      },
      public: {
        restaurant: restaurant.name,
        restaurantSlug: restaurant.slug,
        date: input.date,
        time: input.time,
        guests: input.guests,
        number: reservation.number,
        name,
        email: email ?? null,
        phone: phone ?? null,
        message: `Table for ${input.guests} confirmed.`,
      },
    };
  }

  async lookupReservation(number: string, email?: string, phone?: string) {
    const raw = number.trim();
    const resv = await this.prisma.reservation.findFirst({
      where: { OR: [{ number: raw }, { number: raw.toUpperCase() }] },
      include: {
        customer: true,
        table: { select: { code: true } },
        branch: {
          include: {
            restaurant: { select: { id: true, name: true, slug: true, coverUrl: true, address: true } },
          },
        },
      },
    });
    if (!resv) throw new AppError(404, "Reservation not found", "NOT_FOUND");
    const emailOk = Boolean(email && resv.customer.email?.toLowerCase() === email.trim().toLowerCase());
    const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");
    const phoneOk = Boolean(phone && digits(phone) && digits(phone) === digits(resv.customer.phone));
    if (!emailOk && !phoneOk) throw new AppError(404, "Reservation not found", "NOT_FOUND");
    return {
      number: resv.number,
      status: resv.status,
      date: resv.date,
      time: resv.time,
      guests: resv.guests,
      restaurant: resv.branch.restaurant?.name ?? resv.branch.name,
      restaurantSlug: resv.branch.restaurant?.slug ?? null,
      address: resv.branch.restaurant?.address ?? resv.branch.address,
      table: resv.table?.code ?? null,
      name: resv.customer.name,
    };
  }

  async myReservations(user: User) {
    await this.ops.completeElapsedReservations();
    return this.prisma.reservation.findMany({
      where: {
        OR: [
          { customer: { userId: user.id } },
          { customer: { email: { equals: user.email, mode: "insensitive" } } },
        ],
      },
      include: {
        customer: { select: { name: true } },
        table: { select: { code: true } },
        review: { select: { id: true, status: true } },
        branch: {
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                slug: true,
                coverUrl: true,
                images: { orderBy: { sort: "asc" }, take: 1, select: { url: true } },
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });
  }

  async cancelMyReservation(user: User, id: string) {
    const resv = await this.prisma.reservation.findFirst({
      where: {
        id,
        OR: [
          { customer: { userId: user.id } },
          { customer: { email: { equals: user.email, mode: "insensitive" } } },
        ],
      },
    });
    if (!resv) throw new AppError(404, "Reservation not found", "NOT_FOUND");
    if (!["NEW", "PENDING", "CONFIRMED"].includes(resv.status)) {
      throw new AppError(409, "This reservation cannot be cancelled", "NOT_CANCELLABLE");
    }
    const updated = await this.prisma.reservation.update({
      where: { id: resv.id },
      data: { status: ReservationStatus.CANCELLED },
    });
    await this.ops.refreshTableOccupancy(resv.tableId);
    return updated;
  }
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
