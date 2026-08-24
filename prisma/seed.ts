/// <reference types="node" />
import "dotenv/config";
import {
  PrismaClient,
  UserRole,
  TableStatus,
  ReservationStatus,
  OrderStatus,
  KitchenTicketStatus,
  PaymentMethod,
  WasteReason,
  PurchaseOrderStatus,
  AttendanceStatus,
  LoyaltyTier,
  MenuClassification,
  DeliveryStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedCatalog } from "./catalog";

const prisma = new PrismaClient();
const PASSWORD = "Nexora#2026";

async function main() {
  await prisma.$executeRawUnsafe(`DELETE FROM "Favorite"`);
  await prisma.reviewImage.deleteMany();
  await prisma.review.deleteMany();
  await prisma.restaurantImage.deleteMany();
  await prisma.city.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.kitchenTicket.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.purchaseLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.wasteEntry.deleteMany();
  await prisma.recipeLine.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.diningTable.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.counter.deleteMany();

  const hash = await bcrypt.hash(PASSWORD, 10);
  const hours = [
    { day: "Monday", open: "08:00", close: "22:00" },
    { day: "Tuesday", open: "08:00", close: "22:00" },
    { day: "Wednesday", open: "08:00", close: "22:00" },
    { day: "Thursday", open: "08:00", close: "22:00" },
    { day: "Friday", open: "08:00", close: "22:00" },
    { day: "Saturday", open: "08:00", close: "22:00" },
    { day: "Sunday", open: "10:00", close: "20:00" },
  ];

  await prisma.user.create({
    data: {
      name: "Nexora Platform",
      email: "admin@nexora.rw",
      passwordHash: hash,
      role: UserRole.PLATFORM_ADMIN,
      title: "Platform Admin",
    },
  });

  const owner = await prisma.user.create({
    data: { name: "Amina Uwase", email: "owner@nexora.rw", passwordHash: hash, role: UserRole.OWNER, title: "Restaurant Owner" },
  });

  const umutuzo = await prisma.restaurant.create({
    data: {
      slug: "umutuzo-kitchen",
      name: "Umutuzo Kitchen",
      description: "Contemporary Rwandan cuisine",
      phone: "+250 788 100 200",
      email: "hello@umutuzo.rw",
      address: "KG 7 Ave, Kigali Heights",
      city: "Kigali",
      neighborhood: "Kigali Heights",
      country: "Rwanda",
      cuisine: "Rwandan • African • Grill",
      priceTier: "$$",
      features: "outdoor seating, family friendly, groups",
      featuredTags: "local-favorite,grill,groups",
      rating: 4.8,
      reviewCount: 324,
      status: "ACTIVE",
      publishedAt: new Date(Date.now() - 120 * 86400000),
      coverUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80",
      ownerId: owner.id,
      openingHours: hours,
    },
  });
  await prisma.user.update({ where: { id: owner.id }, data: { restaurantId: umutuzo.id } });

  const john = await prisma.user.create({
    data: { name: "John Doe", email: "john@kigalibistro.rw", passwordHash: hash, role: UserRole.OWNER, title: "Restaurant Owner" },
  });
  const kigaliBistro = await prisma.restaurant.create({
    data: {
      slug: "kigali-bistro",
      name: "Kigali Bistro",
      description: "European plates with a Kigali pantry",
      city: "Kigali",
      neighborhood: "CBD",
      cuisine: "European • Bistro",
      priceTier: "$$$",
      features: "date night, wine, business dining",
      featuredTags: "date-night,business",
      rating: 4.6,
      reviewCount: 188,
      status: "ACTIVE",
      publishedAt: new Date(Date.now() - 80 * 86400000),
      coverUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
      ownerId: john.id,
      openingHours: hours,
    },
  });
  await prisma.user.update({ where: { id: john.id }, data: { restaurantId: kigaliBistro.id } });
  const kbBranch = await prisma.branch.create({
    data: { restaurantId: kigaliBistro.id, code: "KB1", name: "City Center", city: "Kigali", neighborhood: "CBD", address: "KN 2 Ave", lat: -1.944, lng: 30.061, isPrimary: true },
  });
  await prisma.diningTable.createMany({
    data: [
      { branchId: kbBranch.id, code: "T01", seats: 2, posX: 1, posY: 1 },
      { branchId: kbBranch.id, code: "T02", seats: 2, posX: 2, posY: 1 },
      { branchId: kbBranch.id, code: "T03", seats: 4, posX: 3, posY: 1 },
      { branchId: kbBranch.id, code: "T04", seats: 4, posX: 1, posY: 2 },
      { branchId: kbBranch.id, code: "T05", seats: 6, posX: 2, posY: 2 },
      { branchId: kbBranch.id, code: "T06", seats: 8, posX: 3, posY: 2 },
    ],
  });

  const gardenOwner = await prisma.user.create({
    data: { name: "Eric", email: "eric@thegarden.rw", passwordHash: hash, role: UserRole.OWNER, title: "Restaurant Owner", accountStatus: "INVITED", mustChangePassword: true },
  });
  const garden = await prisma.restaurant.create({
    data: {
      slug: "the-garden",
      name: "The Garden",
      description: "Garden dining",
      city: "Kigali",
      cuisine: "Vegetarian",
      status: "PENDING",
      ownerId: gardenOwner.id,
      openingHours: hours,
    },
  });
  await prisma.user.update({ where: { id: gardenOwner.id }, data: { restaurantId: garden.id } });

  const diane = await prisma.user.create({
    data: { name: "Diane", email: "diane@urbanfork.rw", passwordHash: hash, role: UserRole.OWNER, title: "Restaurant Owner" },
  });
  const urban = await prisma.restaurant.create({
    data: {
      slug: "urban-fork",
      name: "Urban Fork",
      city: "Kigali",
      cuisine: "International",
      status: "SUSPENDED",
      ownerId: diane.id,
      openingHours: hours,
    },
  });
  await prisma.user.update({ where: { id: diane.id }, data: { restaurantId: urban.id } });

  await prisma.user.create({
    data: {
      name: "Jean Claude",
      email: "jean@example.com",
      phone: "+250 788 000 111",
      passwordHash: await bcrypt.hash("Temp#2026", 10),
      role: UserRole.OWNER,
      accountStatus: "INVITED",
      mustChangePassword: true,
      title: "Restaurant Owner",
    },
  });

  const heights = await prisma.branch.create({
    data: { restaurantId: umutuzo.id, code: "KH", name: "Kigali Heights", city: "Kigali", neighborhood: "Kigali Heights", address: "KG 7 Ave, Kigali Heights", lat: -1.953, lng: 30.094, isPrimary: true },
  });
  const downtown = await prisma.branch.create({
    data: { restaurantId: umutuzo.id, code: "DT", name: "Downtown Kigali", city: "Kigali", address: "KN 4 Ave, CBD" },
  });
  const remera = await prisma.branch.create({
    data: { restaurantId: umutuzo.id, code: "RM", name: "Remera", city: "Kigali", address: "KG 17 Ave, Remera" },
  });
  const musanze = await prisma.branch.create({
    data: { restaurantId: umutuzo.id, code: "MZ", name: "Musanze", city: "Musanze", address: "Rue du Commerce" },
  });
  const rubavu = await prisma.branch.create({
    data: { restaurantId: umutuzo.id, code: "RB", name: "Rubavu", city: "Rubavu", address: "Lake Kivu waterfront" },
  });
  const manager = await prisma.user.create({
    data: {
      name: "Eric Niyonsaba",
      email: "manager@nexora.rw",
      passwordHash: hash,
      role: UserRole.MANAGER,
      restaurantId: umutuzo.id,
      branchId: heights.id,
      title: "Branch Manager",
    },
  });
  const waiter = await prisma.user.create({
    data: {
      name: "Diane Mukamana",
      email: "waiter@nexora.rw",
      passwordHash: hash,
      role: UserRole.WAITER,
      restaurantId: umutuzo.id,
      branchId: heights.id,
      title: "Head Waiter",
    },
  });
  const chef = await prisma.user.create({
    data: {
      name: "Claude Habimana",
      email: "chef@nexora.rw",
      passwordHash: hash,
      role: UserRole.CHEF,
      restaurantId: umutuzo.id,
      branchId: heights.id,
      title: "Executive Chef",
    },
  });
  const cashier = await prisma.user.create({
    data: {
      name: "Sarah Ingabire",
      email: "cashier@nexora.rw",
      passwordHash: hash,
      role: UserRole.CASHIER,
      restaurantId: umutuzo.id,
      branchId: heights.id,
      title: "Cashier",
    },
  });
  const inventory = await prisma.user.create({
    data: {
      name: "Kevin Mugisha",
      email: "inventory@nexora.rw",
      passwordHash: hash,
      role: UserRole.INVENTORY_MANAGER,
      restaurantId: umutuzo.id,
      branchId: heights.id,
      title: "Inventory Manager",
    },
  });

  await prisma.user.createMany({
    data: [
      { name: "Patrick Kayitesi", email: "accountant@nexora.rw", passwordHash: hash, role: UserRole.ACCOUNTANT, restaurantId: umutuzo.id, title: "Group Accountant" },
      { name: "Lea Uwimana", email: "ops@nexora.rw", passwordHash: hash, role: UserRole.ADMIN, restaurantId: umutuzo.id, title: "Operations Admin" },
      { name: "Jean Bosco", email: "waiter.dt@nexora.rw", passwordHash: hash, role: UserRole.WAITER, restaurantId: umutuzo.id, branchId: downtown.id, title: "Waiter" },
      { name: "Marie Iradukunda", email: "kitchen@nexora.rw", passwordHash: hash, role: UserRole.KITCHEN, restaurantId: umutuzo.id, branchId: heights.id, title: "Line Cook" },
    ],
  });

  const tableDefs = [
    { code: "T01", seats: 2, status: TableStatus.AVAILABLE, posX: 1, posY: 1 },
    { code: "T02", seats: 4, status: TableStatus.OCCUPIED, posX: 2, posY: 1 },
    { code: "T03", seats: 4, status: TableStatus.AVAILABLE, posX: 3, posY: 1 },
    { code: "T04", seats: 4, status: TableStatus.OCCUPIED, posX: 2, posY: 2 },
    { code: "T05", seats: 6, status: TableStatus.RESERVED, posX: 3, posY: 2 },
    { code: "T06", seats: 2, status: TableStatus.AVAILABLE, posX: 1, posY: 3 },
    { code: "T07", seats: 4, status: TableStatus.AVAILABLE, posX: 2, posY: 3 },
    { code: "T08", seats: 4, status: TableStatus.OCCUPIED, posX: 3, posY: 3 },
    { code: "T12", seats: 4, status: TableStatus.OCCUPIED, posX: 1, posY: 2 },
    { code: "T24", seats: 4, status: TableStatus.RESERVED, posX: 4, posY: 2 },
  ];
  const tables = [];
  for (const t of tableDefs) {
    tables.push(await prisma.diningTable.create({ data: { ...t, branchId: heights.id } }));
  }
  const byCode = Object.fromEntries(tables.map((t) => [t.code, t]));

  const jean = await prisma.customer.create({
    data: {
      name: "Jean",
      phone: "+250788111222",
      visits: 6,
      totalSpent: 228000,
      favorite: "Chicken Burger",
      loyalty: LoyaltyTier.SILVER,
      points: 2280,
      lastVisit: new Date("2026-08-10"),
    },
  });
  const aliceUser = await prisma.user.create({
    data: {
      name: "Alice",
      email: "alice@nexora.rw",
      passwordHash: hash,
      role: UserRole.CUSTOMER,
    },
  });
  const alice = await prisma.customer.create({
    data: {
      userId: aliceUser.id,
      name: "Alice",
      email: "alice@nexora.rw",
      phone: "+250788333444",
      visits: 18,
      totalSpent: 684000,
      favorite: "Chicken Burger",
      loyalty: LoyaltyTier.GOLD,
      points: 2480,
      lastVisit: new Date("2026-08-14"),
    },
  });

  const tonight = new Date();
  tonight.setHours(19, 30, 0, 0);
  await prisma.reservation.create({
    data: {
      number: "RES-2026-001829",
      customerId: jean.id,
      branchId: heights.id,
      tableId: byCode.T24.id,
      guests: 4,
      date: tonight,
      time: "19:30",
      preference: "Window",
      status: ReservationStatus.CONFIRMED,
    },
  });
  await prisma.reservation.create({
    data: {
      number: "RES-2026-001830",
      customerId: alice.id,
      branchId: heights.id,
      tableId: byCode.T05.id,
      guests: 2,
      date: tonight,
      time: "20:00",
      status: ReservationStatus.CONFIRMED,
    },
  });
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 8);
  lastWeek.setHours(0, 0, 0, 0);
  const alicePast = await prisma.reservation.create({
    data: {
      number: "RES-2026-001640",
      customerId: alice.id,
      branchId: downtown.id,
      guests: 3,
      date: lastWeek,
      time: "19:00",
      status: ReservationStatus.COMPLETED,
    },
  });
  const older = new Date(lastWeek);
  older.setDate(older.getDate() - 10);
  await prisma.reservation.create({
    data: {
      number: "RES-2026-001500",
      customerId: alice.id,
      branchId: downtown.id,
      guests: 2,
      date: older,
      time: "20:00",
      status: ReservationStatus.COMPLETED,
    },
  });
  await prisma.favorite.createMany({
    data: [
      { userId: aliceUser.id, restaurantId: umutuzo.id },
      { userId: aliceUser.id, restaurantId: kigaliBistro.id },
    ],
  });
  await prisma.reservation.create({
    data: {
      number: "RES-10421",
      customerId: jean.id,
      branchId: heights.id,
      tableId: byCode.T03.id,
      guests: 4,
      date: tonight,
      time: "19:30",
      status: ReservationStatus.NEW,
    },
  });

  await prisma.review.create({
    data: {
      restaurantId: umutuzo.id,
      customerId: alice.id,
      reservationId: alicePast.id,
      author: "Alice",
      rating: 5,
      food: 5,
      service: 5,
      ambience: 4,
      comment: "Great service.",
      status: "APPROVED",
      moderatedAt: new Date(),
    },
  });
  await prisma.review.create({
    data: {
      restaurantId: kigaliBistro.id,
      customerId: alice.id,
      author: "Alice",
      rating: 4,
      food: 4,
      service: 4,
      ambience: 5,
      comment: "Quiet, candlelit, excellent pasta.",
      status: "APPROVED",
      moderatedAt: new Date(),
    },
  });
  await prisma.review.create({
    data: {
      restaurantId: umutuzo.id,
      author: "Patrick",
      rating: 5,
      food: 5,
      service: 4,
      ambience: 4,
      comment: "The grill is excellent.",
      status: "APPROVED",
      moderatedAt: new Date(),
    },
  });
  await prisma.restaurant.update({
    where: { id: umutuzo.id },
    data: { rating: 5, ratingFood: 5, ratingService: 4.5, ratingAmbience: 4, reviewCount: 2 },
  });
  await prisma.restaurant.update({
    where: { id: kigaliBistro.id },
    data: { rating: 4, ratingFood: 4, ratingService: 4, ratingAmbience: 5, reviewCount: 1 },
  });

  const fresh = await prisma.supplier.create({
    data: { name: "Kigali Fresh Foods", onTimeRate: 0.96, qualityScore: 0.94, avgDelayHours: 2.1 },
  });
  const grain = await prisma.supplier.create({
    data: { name: "Rwanda Grain Co.", onTimeRate: 0.91, qualityScore: 0.88, avgDelayHours: 3.4 },
  });

  const chicken = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Chicken Breast", unit: "kg", stock: 18, minStock: 15, costPerUnit: 7000, supplierId: fresh.id },
  });
  const oil = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Cooking Oil", unit: "L", stock: 4, minStock: 12, costPerUnit: 2800, supplierId: fresh.id },
  });
  const rice = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Rice", unit: "kg", stock: 48, minStock: 20, costPerUnit: 1800, supplierId: grain.id },
  });
  const bun = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Burger Bun", unit: "pcs", stock: 86, minStock: 40, costPerUnit: 300, supplierId: grain.id },
  });
  const cheese = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Cheese", unit: "pcs", stock: 70, minStock: 30, costPerUnit: 400, supplierId: fresh.id },
  });
  const lettuce = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Lettuce", unit: "g", stock: 4200, minStock: 1500, costPerUnit: 2, supplierId: fresh.id },
  });
  const tomato = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Tomato", unit: "g", stock: 5100, minStock: 2000, costPerUnit: 2, supplierId: fresh.id },
  });
  const sauce = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Sauce", unit: "g", stock: 2800, minStock: 800, costPerUnit: 3, supplierId: fresh.id },
  });
  const friesIng = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Potato", unit: "kg", stock: 32, minStock: 10, costPerUnit: 1200, supplierId: fresh.id },
  });
  const pastaIng = await prisma.ingredient.create({
    data: { restaurantId: umutuzo.id, name: "Pasta", unit: "kg", stock: 22, minStock: 8, costPerUnit: 2500, supplierId: grain.id },
  });

  const mains = await prisma.menuCategory.create({ data: { restaurantId: umutuzo.id, name: "Mains" } });
  const sides = await prisma.menuCategory.create({ data: { restaurantId: umutuzo.id, name: "Sides" } });
  const drinks = await prisma.menuCategory.create({ data: { restaurantId: umutuzo.id, name: "Drinks" } });

  const burger = await prisma.menuItem.create({
    data: {
      categoryId: mains.id,
      name: "Chicken Burger",
      description: "Grilled chicken, house bun, lettuce, tomato.",
      popular: true,
      price: 6000,
      ingredientCost: 2100,
      classification: MenuClassification.STAR,
    },
  });
  const steak = await prisma.menuItem.create({
    data: {
      categoryId: mains.id,
      name: "Steak Frites",
      description: "Charred steak, shoestring fries, pepper sauce.",
      popular: true,
      price: 14500,
      ingredientCost: 6200,
      classification: MenuClassification.PUZZLE,
    },
  });
  const pasta = await prisma.menuItem.create({
    data: {
      categoryId: mains.id,
      name: "Pasta",
      price: 8500,
      ingredientCost: 2400,
      classification: MenuClassification.PLOW_HORSE,
    },
  });
  const salad = await prisma.menuItem.create({
    data: {
      categoryId: sides.id,
      name: "Garden Salad",
      price: 3500,
      ingredientCost: 900,
      classification: MenuClassification.PUZZLE,
    },
  });
  const fries = await prisma.menuItem.create({
    data: {
      categoryId: sides.id,
      name: "Fries",
      price: 2500,
      ingredientCost: 600,
      classification: MenuClassification.PLOW_HORSE,
    },
  });
  const juice = await prisma.menuItem.create({
    data: {
      categoryId: drinks.id,
      name: "Passion Juice",
      price: 2000,
      ingredientCost: 500,
      classification: MenuClassification.STAR,
    },
  });

  await prisma.recipeLine.createMany({
    data: [
      { menuItemId: burger.id, ingredientId: chicken.id, quantity: 0.2 },
      { menuItemId: burger.id, ingredientId: bun.id, quantity: 1 },
      { menuItemId: burger.id, ingredientId: cheese.id, quantity: 1 },
      { menuItemId: burger.id, ingredientId: lettuce.id, quantity: 30 },
      { menuItemId: burger.id, ingredientId: tomato.id, quantity: 40 },
      { menuItemId: burger.id, ingredientId: sauce.id, quantity: 20 },
      { menuItemId: fries.id, ingredientId: friesIng.id, quantity: 0.18 },
      { menuItemId: fries.id, ingredientId: oil.id, quantity: 0.04 },
      { menuItemId: pasta.id, ingredientId: pastaIng.id, quantity: 0.12 },
      { menuItemId: salad.id, ingredientId: lettuce.id, quantity: 80 },
      { menuItemId: salad.id, ingredientId: tomato.id, quantity: 50 },
    ],
  });

  async function makeOrder(opts: {
    number: string;
    table: string;
    status: OrderStatus;
    ticket: KitchenTicketStatus;
    lines: { itemId: string; qty: number; price: number }[];
    paid?: boolean;
    method?: PaymentMethod;
    hoursAgo?: number;
    branchId?: string;
  }) {
    const subtotal = opts.lines.reduce((s, l) => s + l.qty * l.price, 0);
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + tax;
    const createdAt = new Date(Date.now() - (opts.hoursAgo ?? 0) * 3600_000);
    const order = await prisma.order.create({
      data: {
        number: opts.number,
        branchId: opts.branchId ?? heights.id,
        tableId: byCode[opts.table]?.id,
        waiterId: waiter.id,
        customerId: jean.id,
        status: opts.status,
        subtotal,
        tax,
        total,
        createdAt,
        paidAt: opts.paid ? createdAt : null,
        lines: {
          create: opts.lines.map((l) => ({
            menuItemId: l.itemId,
            quantity: l.qty,
            unitPrice: l.price,
          })),
        },
        tickets: {
          create: { status: opts.ticket, createdAt },
        },
      },
    });
    if (opts.paid) {
      await prisma.payment.create({
        data: { orderId: order.id, method: opts.method ?? PaymentMethod.MOBILE_MONEY, amount: total, createdAt },
      });
    }
    return order;
  }

  await makeOrder({
    number: "1824",
    table: "T12",
    status: OrderStatus.SENT,
    ticket: KitchenTicketStatus.NEW,
    lines: [
      { itemId: burger.id, qty: 2, price: 6000 },
      { itemId: fries.id, qty: 1, price: 2500 },
    ],
  });
  await makeOrder({
    number: "1821",
    table: "T04",
    status: OrderStatus.PREPARING,
    ticket: KitchenTicketStatus.PREPARING,
    lines: [
      { itemId: steak.id, qty: 1, price: 14500 },
      { itemId: fries.id, qty: 2, price: 2500 },
    ],
  });
  await makeOrder({
    number: "1819",
    table: "T08",
    status: OrderStatus.READY,
    ticket: KitchenTicketStatus.READY,
    lines: [
      { itemId: pasta.id, qty: 2, price: 8500 },
      { itemId: salad.id, qty: 1, price: 3500 },
    ],
  });
  await makeOrder({
    number: "1820",
    table: "T02",
    status: OrderStatus.PREPARING,
    ticket: KitchenTicketStatus.PREPARING,
    lines: [
      { itemId: burger.id, qty: 2, price: 6000 },
      { itemId: fries.id, qty: 2, price: 2500 },
      { itemId: juice.id, qty: 2, price: 2000 },
    ],
  });

  for (let i = 0; i < 40; i++) {
    const methods = [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.MOBILE_MONEY];
    await makeOrder({
      number: String(1700 + i),
      table: "T01",
      status: OrderStatus.PAID,
      ticket: KitchenTicketStatus.SERVED,
      paid: true,
      method: methods[i % 3],
      hoursAgo: 1 + (i % 10),
      lines: [
        { itemId: burger.id, qty: 1 + (i % 2), price: 6000 },
        { itemId: fries.id, qty: 1, price: 2500 },
        { itemId: juice.id, qty: 1, price: 2000 },
      ],
    });
  }

  await prisma.wasteEntry.createMany({
    data: [
      { branchId: heights.id, ingredientId: chicken.id, quantity: 4.2, reason: WasteReason.OVERPRODUCTION, cost: 29400 },
      { branchId: heights.id, ingredientId: lettuce.id, quantity: 2800, reason: WasteReason.EXPIRED, cost: 5600 },
      { branchId: downtown.id, ingredientId: bun.id, quantity: 14, reason: WasteReason.PREPARATION_ERROR, cost: 4200 },
    ],
  });

  await prisma.purchaseOrder.create({
    data: {
      number: "PO-2041",
      branchId: heights.id,
      supplierId: fresh.id,
      status: PurchaseOrderStatus.PENDING_APPROVAL,
      total: 420000,
      lines: { create: [{ ingredientId: chicken.id, quantity: 60, unitCost: 7000 }] },
    },
  });

  await prisma.shift.createMany({
    data: [
      { branchId: heights.id, userId: cashier.id, name: "Morning", startsAt: "06:00", endsAt: "14:00" },
      { branchId: heights.id, userId: waiter.id, name: "Morning", startsAt: "06:00", endsAt: "14:00" },
      { branchId: heights.id, userId: chef.id, name: "Morning", startsAt: "06:00", endsAt: "14:00" },
      { branchId: heights.id, userId: inventory.id, name: "Morning", startsAt: "06:00", endsAt: "14:00" },
    ],
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.attendance.createMany({
    data: [
      { branchId: heights.id, userId: cashier.id, date: today, status: AttendanceStatus.PRESENT },
      { branchId: heights.id, userId: waiter.id, date: today, status: AttendanceStatus.PRESENT },
      { branchId: heights.id, userId: chef.id, date: today, status: AttendanceStatus.LATE },
      { branchId: heights.id, userId: inventory.id, date: today, status: AttendanceStatus.PRESENT },
      { branchId: heights.id, userId: manager.id, date: today, status: AttendanceStatus.PRESENT },
    ],
  });

  await prisma.feedback.create({
    data: { orderId: (await prisma.order.findFirst({ where: { number: "1700" } }))!.id, customerId: alice.id, food: 5, service: 4, ambience: 5, comment: "Great service." },
  });

  await prisma.delivery.create({
    data: {
      orderId: (await prisma.order.findFirst({ where: { number: "1701" } }))!.id,
      driver: "Pacifique",
      status: DeliveryStatus.ON_THE_WAY,
    },
  });

  await prisma.notification.createMany({
    data: [
      { userId: chef.id, title: "New ticket", body: "Order #1824 arrived at the pass." },
      { userId: waiter.id, title: "Order ready", body: "Order #1819 for T08 is ready to serve." },
      { userId: inventory.id, title: "Low stock", body: "Cooking oil is below the minimum." },
      { userId: manager.id, title: "Purchase recommendation", body: "Chicken breast will drop below minimum in 2 days." },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: waiter.id, action: "order.sent", resource: "order:1824" },
      { userId: chef.id, action: "ticket.start", resource: "order:1821" },
      { userId: owner.id, action: "user.login", resource: `user:${owner.id}` },
    ],
  });

  await prisma.counter.createMany({
    data: [
      { key: "order", value: 1900 },
      { key: "reservation", value: 1840 },
      { key: "purchase", value: 2050 },
    ],
  });

  await prisma.restaurantImage.createMany({
    data: [
      { restaurantId: umutuzo.id, url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80", alt: "Umutuzo Kitchen grill", sort: 0 },
      { restaurantId: umutuzo.id, url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80", alt: "Dining room", sort: 1 },
      { restaurantId: umutuzo.id, url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1400&q=80", alt: "Plates from the pass", sort: 2 },
      { restaurantId: kigaliBistro.id, url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80", alt: "Kigali Bistro dining room", sort: 0 },
    ],
  });

  await seedCatalog(prisma, hours);

  const restaurants = await prisma.restaurant.findMany({ select: { id: true } });
  for (const row of restaurants) {
    const stats = await prisma.review.aggregate({
      where: { restaurantId: row.id, status: "APPROVED" },
      _avg: { rating: true, food: true, service: true, ambience: true },
      _count: true,
    });
    const round = (n: number | null) => Number((n ?? 0).toFixed(2));
    await prisma.restaurant.update({
      where: { id: row.id },
      data: {
        rating: round(stats._avg.rating),
        ratingFood: round(stats._avg.food),
        ratingService: round(stats._avg.service),
        ratingAmbience: round(stats._avg.ambience),
        reviewCount: stats._count,
      },
    });
  }

  console.log("Seeded Nexora");
  console.log("Password: Nexora#2026  (except jean@example.com → Temp#2026)");
  console.log("  admin@nexora.rw      platform admin  /platform-admin");
  console.log("  jean@example.com     invited owner   /onboarding (after password change)");
  console.log("  owner@nexora.rw      Umutuzo owner");
  console.log("  manager@nexora.rw    restaurant ops");
  console.log("  alice@nexora.rw      customer account");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
