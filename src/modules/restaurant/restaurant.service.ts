import { Inject, Injectable } from "@nestjs/common";
import {
  KitchenTicketStatus,
  OrderStatus,
  PaymentMethod,
  PurchaseOrderStatus,
  ReservationStatus,
  TableStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/app-error";
import { StorageService } from "../../common/storage.service";
import { assertRestaurantDishPhoto } from "../../common/menu-photo";
import type { User } from "@prisma/client";

@Injectable()
export class RestaurantService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService
  ) {}

  branchScope(user: User) {
    if (user.role === "OWNER" || user.role === "ADMIN" || user.role === "ACCOUNTANT") {
      if (user.restaurantId) return { branch: { restaurantId: user.restaurantId } };
      return { branchId: "__none__" };
    }
    if (user.branchId) return { branchId: user.branchId };
    return { branchId: "__none__" };
  }

  async resolveBranchId(user: User) {
    if (user.branchId) return user.branchId;
    const branch = await this.prisma.branch.findFirst({
      where: user.restaurantId ? { restaurantId: user.restaurantId } : undefined,
    });
    if (!branch) throw new AppError(400, "No branch available", "NO_BRANCH");
    return branch.id;
  }

  async nextNumber(key: string, prefix: string) {
    const row = await this.prisma.counter.upsert({
      where: { key },
      create: { key, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${prefix}${String(row.value).padStart(4, "0")}`;
  }

  async commandCenter(user: User) {
    const scope = this.branchScope(user);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const paidToday = await this.prisma.order.findMany({
      where: { ...scope, status: "PAID", paidAt: { gte: start } },
      include: { lines: true },
    });
    const revenue = paidToday.reduce((s, o) => s + o.total, 0);
    const orders = paidToday.length;
    const customers = paidToday.reduce((s, o) => s + o.lines.reduce((n, l) => n + l.quantity, 0), 0);
    const tables = await this.prisma.diningTable.findMany({ where: scope });
    const occupied = tables.filter((t) => t.status === "OCCUPIED").length;
    const tickets = await this.prisma.kitchenTicket.findMany({
      where: { order: scope },
      include: { order: { include: { table: true, lines: { include: { menuItem: true } } } } },
    });
    const ingredients = await this.prisma.ingredient.findMany();
    const attendance = await this.prisma.attendance.findMany({
      where: { ...scope, date: { gte: start } },
    });
    return {
      today: {
        revenue,
        orders,
        customers,
        avgOrderValue: orders ? Math.round(revenue / orders) : 0,
        tablesOccupiedPct: tables.length ? Math.round((occupied / tables.length) * 100) : 0,
      },
      live: {
        occupied,
        preparing: tickets.filter((t) => t.status === "PREPARING").length,
        ready: tickets.filter((t) => t.status === "READY").length,
        delayed: tickets.filter((t) => t.status === "NEW" && Date.now() - t.createdAt.getTime() > 15 * 60_000).length,
      },
      inventory: ingredients.map((i) => ({
        name: i.name,
        stock: i.stock,
        minStock: i.minStock,
        status: i.stock <= i.minStock * 0.4 ? "Critical" : i.stock <= i.minStock ? "Low" : "Healthy",
      })),
      staff: {
        active: attendance.filter((a) => a.status !== "ABSENT").length,
        late: attendance.filter((a) => a.status === "LATE").length,
        absent: attendance.filter((a) => a.status === "ABSENT").length,
      },
    };
  }

  branches(user: User) {
    return this.prisma.branch.findMany({
      where: user.restaurantId ? { restaurantId: user.restaurantId } : user.branchId ? { id: user.branchId } : { id: "__none__" },
      orderBy: { name: "asc" },
    });
  }

  tables(user: User) {
    return this.prisma.diningTable.findMany({
      where: this.branchScope(user),
      include: {
        orders: {
          where: { status: { in: ["OPEN", "SENT", "PREPARING", "READY", "SERVED"] } },
          include: { waiter: true, lines: { include: { menuItem: true } } },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        reservations: {
          where: { status: { in: ["NEW", "CONFIRMED", "ARRIVED", "SEATED"] } },
          include: { customer: true },
          take: 1,
          orderBy: { date: "asc" },
        },
      },
      orderBy: { code: "asc" },
    });
  }

  async setTableStatus(id: string, status: TableStatus) {
    return this.prisma.diningTable.update({ where: { id }, data: { status } });
  }

  reservationInstant(date: Date, time: string) {
    const [hh, mm] = time.split(":").map((n) => Number(n) || 0);
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  async completeElapsedReservations() {
    const held = await this.prisma.reservation.findMany({
      where: { status: { in: ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "SEATED"] } },
      select: { id: true, date: true, time: true, tableId: true },
    });
    const now = Date.now();
    const due = held.filter((r) => this.reservationInstant(r.date, r.time).getTime() < now);
    if (!due.length) return;
    await this.prisma.reservation.updateMany({
      where: { id: { in: due.map((r) => r.id) } },
      data: { status: ReservationStatus.COMPLETED },
    });
    const tables = [...new Set(due.map((r) => r.tableId).filter(Boolean))] as string[];
    for (const id of tables) await this.refreshTableOccupancy(id);
  }

  async refreshTableOccupancy(tableId: string | null | undefined) {
    if (!tableId) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const rows = await this.prisma.reservation.findMany({
      where: {
        tableId,
        date: { gte: start, lt: end },
        status: { in: ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "SEATED"] },
      },
    });
    const occupied = rows.some((r) => r.status === "SEATED" || r.status === "ARRIVED");
    const reserved = rows.some((r) => r.status === "NEW" || r.status === "PENDING" || r.status === "CONFIRMED");
    await this.prisma.diningTable.update({
      where: { id: tableId },
      data: {
        status: occupied ? TableStatus.OCCUPIED : reserved ? TableStatus.RESERVED : TableStatus.AVAILABLE,
      },
    });
  }

  async reservations(user: User) {
    await this.completeElapsedReservations();
    return this.prisma.reservation.findMany({
      where: this.branchScope(user),
      include: { customer: true, table: true, branch: true },
      orderBy: { date: "asc" },
    });
  }

  async createReservation(input: {
    customerName: string;
    guests: number;
    date: string;
    time: string;
    branchId: string;
    tableId?: string;
    preference?: string;
  }) {
    const customer = await this.prisma.customer.create({ data: { name: input.customerName } });
    const number = await this.nextNumber("reservation", "RES-2026-");
    if (input.tableId) {
      await this.prisma.diningTable.update({ where: { id: input.tableId }, data: { status: "RESERVED" } });
    }
    return this.prisma.reservation.create({
      data: {
        number,
        customerId: customer.id,
        branchId: input.branchId,
        tableId: input.tableId,
        guests: input.guests,
        date: new Date(input.date),
        time: input.time,
        preference: input.preference,
        status: "CONFIRMED",
      },
      include: { customer: true, table: true, branch: true },
    });
  }

  async seatReservation(id: string) {
    const resv = await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.SEATED },
      include: { table: true, customer: true, branch: true },
    });
    if (resv.tableId) {
      await this.prisma.diningTable.update({ where: { id: resv.tableId }, data: { status: TableStatus.OCCUPIED } });
    }
    return resv;
  }

  async confirmReservation(id: string) {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CONFIRMED },
      include: { customer: true, table: true, branch: true },
    });
  }

  async arriveReservation(id: string) {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.ARRIVED },
      include: { customer: true, table: true, branch: true },
    });
  }

  async cancelReservation(id: string) {
    const resv = await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
      include: { table: true, customer: true, branch: true },
    });
    await this.refreshTableOccupancy(resv.tableId);
    return resv;
  }

  menu(user?: User) {
    return this.prisma.menuItem.findMany({
      where: user?.restaurantId ? { category: { restaurantId: user.restaurantId } } : undefined,
      include: { category: true, recipe: { include: { ingredient: true } }, orderLines: true },
      orderBy: { name: "asc" },
    });
  }

  async setMenuPhoto(user: User, menuItemId: string, file: Express.Multer.File) {
    if (!user.restaurantId) throw new AppError(403, "Restaurant account required", "FORBIDDEN");
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, category: { restaurantId: user.restaurantId } },
    });
    if (!item) throw new AppError(404, "Menu item not found", "NOT_FOUND");
    if (!file) throw new AppError(400, "Restaurant dish photo required", "NO_PHOTO");
    assertRestaurantDishPhoto(file);
    const filename = `${item.id}.jpg`;
    await this.storage.save("menu", filename, file.buffer);
    const imageUrl = `/api/public/media/menu/${filename}`;
    return this.prisma.menuItem.update({ where: { id: item.id }, data: { imageUrl } });
  }

  async createOrder(user: User, input: { tableId?: string; customerId?: string; lines: { menuItemId: string; quantity: number; notes?: string }[] }) {
    const items = await this.prisma.menuItem.findMany({
      where: { id: { in: input.lines.map((l) => l.menuItemId) } },
    });
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    const lines = input.lines.map((l) => {
      const item = byId[l.menuItemId];
      if (!item) throw new AppError(400, "Unknown menu item", "BAD_ITEM");
      return { ...l, unitPrice: item.price };
    });
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const tax = Math.round(subtotal * 0.1);
    const number = await this.nextNumber("order", "");
    const branchId = await this.resolveBranchId(user);
    if (input.tableId) {
      await this.prisma.diningTable.update({ where: { id: input.tableId }, data: { status: "OCCUPIED" } });
    }
    return this.prisma.order.create({
      data: {
        number,
        branchId,
        tableId: input.tableId,
        customerId: input.customerId,
        waiterId: user.id,
        status: "OPEN",
        subtotal,
        tax,
        total: subtotal + tax,
        lines: { create: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, unitPrice: l.unitPrice, notes: l.notes })) },
      },
      include: { lines: { include: { menuItem: true } }, table: true },
    });
  }

  async sendToKitchen(orderId: string) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.SENT, tickets: { create: { status: KitchenTicketStatus.NEW } } },
      include: { tickets: true, lines: { include: { menuItem: true } }, table: true },
    });
    return order;
  }

  kitchen(user: User) {
    return this.prisma.kitchenTicket.findMany({
      where: { status: { in: ["NEW", "PREPARING", "READY"] }, order: this.branchScope(user) },
      include: { order: { include: { table: true, lines: { include: { menuItem: true } } } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async advanceTicket(id: string, action: "START" | "READY" | "SERVE") {
    const ticket = await this.prisma.kitchenTicket.findUniqueOrThrow({ where: { id } });
    if (action === "START") {
      await this.prisma.kitchenTicket.update({ where: { id }, data: { status: "PREPARING", startedAt: new Date() } });
      await this.prisma.order.update({ where: { id: ticket.orderId }, data: { status: "PREPARING" } });
    } else if (action === "READY") {
      await this.prisma.kitchenTicket.update({ where: { id }, data: { status: "READY", readyAt: new Date() } });
      await this.prisma.order.update({ where: { id: ticket.orderId }, data: { status: "READY" } });
      const order = await this.prisma.order.findUnique({ where: { id: ticket.orderId } });
      if (order?.waiterId) {
        await this.prisma.notification.create({
          data: { userId: order.waiterId, title: "Order ready", body: `Order #${order.number} is ready to serve.` },
        });
      }
    } else {
      await this.prisma.kitchenTicket.update({ where: { id }, data: { status: "SERVED" } });
      await this.prisma.order.update({ where: { id: ticket.orderId }, data: { status: "SERVED" } });
    }
    return this.prisma.kitchenTicket.findUniqueOrThrow({
      where: { id },
      include: { order: { include: { table: true, lines: { include: { menuItem: true } } } } },
    });
  }

  async payOrder(id: string, method: PaymentMethod, discount = 0) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: { lines: { include: { menuItem: { include: { recipe: true } } } } },
    });
    const total = Math.max(0, order.subtotal + order.tax - discount);
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({ data: { orderId: id, method, amount: total } });
      await tx.order.update({
        where: { id },
        data: { status: "PAID", discount, total, paidAt: new Date() },
      });
      if (order.tableId) {
        await tx.diningTable.update({ where: { id: order.tableId }, data: { status: "CLEANING" } });
      }
      for (const line of order.lines) {
        for (const recipe of line.menuItem.recipe) {
          await tx.ingredient.update({
            where: { id: recipe.ingredientId },
            data: { stock: { decrement: recipe.quantity * line.quantity } },
          });
        }
      }
    });
    return this.prisma.order.findUniqueOrThrow({ where: { id }, include: { payments: true, lines: { include: { menuItem: true } } } });
  }

  openOrders(user: User) {
    return this.prisma.order.findMany({
      where: { ...this.branchScope(user), status: { notIn: ["PAID", "CANCELLED"] } },
      include: { table: true, lines: { include: { menuItem: true } }, waiter: true },
      orderBy: { createdAt: "desc" },
    });
  }

  inventory(user: User) {
    return this.prisma.ingredient.findMany({
      where: user.restaurantId ? { restaurantId: user.restaurantId } : undefined,
      include: { supplier: true },
      orderBy: { name: "asc" },
    });
  }

  async recommendations() {
    const ingredients = await this.prisma.ingredient.findMany({ include: { supplier: true } });
    return ingredients
      .filter((i) => i.stock <= i.minStock * 1.4)
      .map((i) => {
        const avgDaily = Math.max(1, Math.round((i.minStock + 8) / 2));
        const projected = avgDaily * 7;
        const qty = Math.max(projected - i.stock, i.minStock);
        return {
          ingredientId: i.id,
          name: i.name,
          current: i.stock,
          minimum: i.minStock,
          avgDailyUsage: avgDaily,
          projectedNeed: projected,
          recommendedQty: Math.ceil(qty),
          supplier: i.supplier?.name ?? "Unassigned",
          supplierId: i.supplierId,
          estimatedCost: Math.round(qty * i.costPerUnit),
          unit: i.unit,
        };
      });
  }

  async createPurchase(user: User, ingredientId: string, quantity: number) {
    const ingredient = await this.prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    if (!ingredient.supplierId) throw new AppError(400, "Ingredient has no supplier", "NO_SUPPLIER");
    const number = await this.nextNumber("purchase", "PO-");
    const branchId = await this.resolveBranchId(user);
    return this.prisma.purchaseOrder.create({
      data: {
        number,
        branchId,
        supplierId: ingredient.supplierId,
        status: PurchaseOrderStatus.PENDING_APPROVAL,
        total: Math.round(quantity * ingredient.costPerUnit),
        lines: { create: [{ ingredientId, quantity, unitCost: ingredient.costPerUnit }] },
      },
      include: { supplier: true, lines: { include: { ingredient: true } } },
    });
  }

  purchaseOrders(user: User) {
    return this.prisma.purchaseOrder.findMany({
      where: this.branchScope(user),
      include: { supplier: true, lines: { include: { ingredient: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  suppliers() {
    return this.prisma.supplier.findMany({ include: { _count: { select: { purchaseOrders: true } } } });
  }

  waste(user: User) {
    return this.prisma.wasteEntry.findMany({
      where: this.branchScope(user),
      include: { ingredient: true, branch: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async addWaste(user: User, input: { ingredientId: string; quantity: number; reason: "EXPIRED" | "OVERPRODUCTION" | "DAMAGED" | "PREPARATION_ERROR" | "CUSTOMER_RETURN" | "UNKNOWN" }) {
    const ingredient = await this.prisma.ingredient.findUniqueOrThrow({ where: { id: input.ingredientId } });
    const branchId = await this.resolveBranchId(user);
    await this.prisma.ingredient.update({
      where: { id: ingredient.id },
      data: { stock: { decrement: input.quantity } },
    });
    return this.prisma.wasteEntry.create({
      data: {
        branchId,
        ingredientId: ingredient.id,
        quantity: input.quantity,
        reason: input.reason,
        cost: Math.round(input.quantity * ingredient.costPerUnit),
      },
      include: { ingredient: true },
    });
  }

  staff(user: User) {
    const staffWhere = user.restaurantId
      ? { restaurantId: user.restaurantId, role: { notIn: ["PLATFORM_ADMIN", "CUSTOMER"] as ("PLATFORM_ADMIN" | "CUSTOMER")[] } }
      : user.branchId
        ? { branchId: user.branchId }
        : { id: "__none__" };
    return Promise.all([
      this.prisma.user.findMany({
        where: staffWhere,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          title: true,
          branchId: true,
          restaurantId: true,
          profileImage: true,
          timezone: true,
          language: true,
          createdAt: true,
          accountStatus: true,
          mustChangePassword: true,
          phone: true,
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.shift.findMany({ where: this.branchScope(user), include: { user: true } }),
      this.prisma.attendance.findMany({
        where: { ...this.branchScope(user), date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        include: { user: true },
      }),
    ]).then(([users, shifts, attendance]) => ({ users, shifts, attendance }));
  }

  async inviteStaff(actor: User, input: { name: string; email: string; role: "MANAGER" | "CASHIER" | "WAITER" | "CHEF" | "KITCHEN" | "INVENTORY_MANAGER" | "ACCOUNTANT"; branchId?: string }) {
    if (actor.role === "PLATFORM_ADMIN") throw new AppError(403, "Use the platform console to create owners", "FORBIDDEN");
    if (!["OWNER", "ADMIN", "MANAGER"].includes(actor.role)) throw new AppError(403, "Only owners and managers can invite staff", "FORBIDDEN");
    if (!actor.restaurantId) throw new AppError(400, "Set up your restaurant first", "NO_RESTAURANT");
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new AppError(409, "An account with this email already exists", "EMAIL_EXISTS");
    }
    const bcrypt = await import("bcryptjs");
    const temporaryPassword = `Nexora#${Math.floor(1000 + Math.random() * 9000)}`;
    const user = await this.prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash: await bcrypt.hash(temporaryPassword, 12),
        role: input.role,
        restaurantId: actor.restaurantId,
        branchId: input.branchId,
        accountStatus: "INVITED",
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        accountStatus: true,
      },
    });
    return { user, temporaryPassword };
  }

  customers() {
    return this.prisma.customer.findMany({ orderBy: { totalSpent: "desc" } });
  }

  deliveries(user: User) {
    return this.prisma.delivery.findMany({
      where: { order: this.branchScope(user) },
      include: { order: { include: { table: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async analytics(user: User) {
    const scope =
      user.role === "OWNER" || user.role === "ADMIN" || user.role === "ACCOUNTANT"
        ? user.restaurantId
          ? { branch: { restaurantId: user.restaurantId } }
          : this.branchScope(user)
        : this.branchScope(user);
    const paid = await this.prisma.order.findMany({
      where: { ...scope, status: "PAID" },
      include: { payments: true, lines: { include: { menuItem: true } }, branch: true },
    });
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const cogs = paid.reduce(
      (s, o) => s + o.lines.reduce((n, l) => n + l.menuItem.ingredientCost * l.quantity, 0),
      0
    );
    const byMethod: Record<string, number> = { CASH: 0, CARD: 0, MOBILE_MONEY: 0 };
    for (const o of paid) for (const p of o.payments) byMethod[p.method] += p.amount;
    const byBranch: Record<string, { name: string; revenue: number; orders: number }> = {};
    for (const o of paid) {
      const b = byBranch[o.branchId] ?? { name: o.branch.name, revenue: 0, orders: 0 };
      b.revenue += o.total;
      b.orders += 1;
      byBranch[o.branchId] = b;
    }
    const productSales: Record<string, { name: string; qty: number; revenue: number; margin: number }> = {};
    for (const o of paid) {
      for (const l of o.lines) {
        const cur = productSales[l.menuItemId] ?? {
          name: l.menuItem.name,
          qty: 0,
          revenue: 0,
          margin: l.menuItem.price ? (l.menuItem.price - l.menuItem.ingredientCost) / l.menuItem.price : 0,
        };
        cur.qty += l.quantity;
        cur.revenue += l.quantity * l.unitPrice;
        productSales[l.menuItemId] = cur;
      }
    }
    const waste = await this.prisma.wasteEntry.groupBy({
      by: ["branchId"],
      _sum: { cost: true },
    });
    const branches = await this.prisma.branch.findMany();
    const wasteByBranch = waste.map((w) => ({
      branch: branches.find((b) => b.id === w.branchId)?.name ?? "Unknown",
      cost: w._sum.cost ?? 0,
    }));
    const satisfaction = await this.prisma.feedback.aggregate({
      _avg: { food: true, service: true, ambience: true },
    });
    return {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      orders: paid.length,
      customers: paid.length,
      byMethod,
      branches: Object.values(byBranch),
      bestProduct: Object.values(productSales).sort((a, b) => b.revenue - a.revenue)[0] ?? null,
      wasteByBranch,
      products: Object.values(productSales).sort((a, b) => b.revenue - a.revenue),
      satisfaction: {
        food: Number(satisfaction._avg.food?.toFixed(1) ?? 0),
        service: Number(satisfaction._avg.service?.toFixed(1) ?? 0),
        ambience: Number(satisfaction._avg.ambience?.toFixed(1) ?? 0),
      },
    };
  }

  notifications(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 40 });
  }

  markRead(userId: string, id?: string) {
    if (id) return this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return this.prisma.notification.updateMany({ where: { userId }, data: { read: true } });
  }
}
