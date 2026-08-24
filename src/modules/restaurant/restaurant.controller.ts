import { Body, Controller, Get, Inject, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser, Roles } from "../../common/decorators";
import { RESTAURANT_STAFF_ROLES } from "../../shared/types";
import { RestaurantService } from "./restaurant.service";
import {
  createOrderSchema,
  feedbackSchema,
  inviteStaffSchema,
  payOrderSchema,
  reservationSchema,
  wasteSchema,
} from "../../shared/validation";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("restaurant")
@Controller()
@Roles(...RESTAURANT_STAFF_ROLES)
export class RestaurantController {
  constructor(
    @Inject(RestaurantService) private readonly ops: RestaurantService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  @Get("command-center")
  command(@CurrentUser() user: User) {
    return this.ops.commandCenter(user);
  }

  @Get("branches")
  branches(@CurrentUser() user: User) {
    return this.ops.branches(user);
  }

  @Get("tables")
  tables(@CurrentUser() user: User) {
    return this.ops.tables(user);
  }

  @Post("tables/:id/status")
  setTable(@Param("id") id: string, @Body() body: { status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" }) {
    return this.ops.setTableStatus(id, body.status);
  }

  @Get("reservations")
  reservations(@CurrentUser() user: User) {
    return this.ops.reservations(user);
  }

  @Post("reservations")
  createReservation(@Body() body: unknown) {
    return this.ops.createReservation(reservationSchema.parse(body));
  }

  @Post("reservations/:id/confirm")
  confirm(@Param("id") id: string) {
    return this.ops.confirmReservation(id);
  }

  @Post("reservations/:id/arrive")
  arrive(@Param("id") id: string) {
    return this.ops.arriveReservation(id);
  }

  @Post("reservations/:id/seat")
  seat(@Param("id") id: string) {
    return this.ops.seatReservation(id);
  }

  @Post("reservations/:id/cancel")
  cancel(@Param("id") id: string) {
    return this.ops.cancelReservation(id);
  }

  @Get("menu")
  menu(@CurrentUser() user: User) {
    return this.ops.menu(user);
  }

  @Roles("OWNER", "ADMIN", "MANAGER")
  @Post("menu/:id/photo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  setMenuPhoto(@CurrentUser() user: User, @Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.ops.setMenuPhoto(user, id, file);
  }

  @Get("orders")
  orders(@CurrentUser() user: User) {
    return this.ops.openOrders(user);
  }

  @Post("orders")
  createOrder(@CurrentUser() user: User, @Body() body: unknown) {
    return this.ops.createOrder(user, createOrderSchema.parse(body));
  }

  @Post("orders/:id/send")
  send(@Param("id") id: string) {
    return this.ops.sendToKitchen(id);
  }

  @Post("orders/:id/pay")
  pay(@Param("id") id: string, @Body() body: unknown) {
    const input = payOrderSchema.parse(body);
    return this.ops.payOrder(id, input.method, input.discount ?? 0);
  }

  @Get("kitchen")
  kitchen(@CurrentUser() user: User) {
    return this.ops.kitchen(user);
  }

  @Post("kitchen/:id/:action")
  ticket(@Param("id") id: string, @Param("action") action: "START" | "READY" | "SERVE") {
    return this.ops.advanceTicket(id, action);
  }

  @Get("inventory")
  inventory(@CurrentUser() user: User) {
    return this.ops.inventory(user);
  }

  @Get("procurement/recommendations")
  recs() {
    return this.ops.recommendations();
  }

  @Get("procurement")
  pos(@CurrentUser() user: User) {
    return this.ops.purchaseOrders(user);
  }

  @Post("procurement")
  createPo(@CurrentUser() user: User, @Body() body: { ingredientId: string; quantity: number }) {
    return this.ops.createPurchase(user, body.ingredientId, body.quantity);
  }

  @Get("suppliers")
  suppliers() {
    return this.ops.suppliers();
  }

  @Get("waste")
  waste(@CurrentUser() user: User) {
    return this.ops.waste(user);
  }

  @Post("waste")
  addWaste(@CurrentUser() user: User, @Body() body: unknown) {
    return this.ops.addWaste(user, wasteSchema.parse(body));
  }

  @Get("staff")
  staff(@CurrentUser() user: User) {
    return this.ops.staff(user);
  }

  @Post("staff/invite")
  invite(@CurrentUser() user: User, @Body() body: unknown) {
    return this.ops.inviteStaff(user, inviteStaffSchema.parse(body));
  }

  @Get("customers")
  customers() {
    return this.ops.customers();
  }

  @Get("deliveries")
  deliveries(@CurrentUser() user: User) {
    return this.ops.deliveries(user);
  }

  @Get("analytics")
  analytics(@CurrentUser() user: User) {
    return this.ops.analytics(user);
  }

  @Get("notifications")
  notes(@CurrentUser() user: User) {
    return this.ops.notifications(user.id);
  }

  @Post("notifications/read-all")
  readAll(@CurrentUser() user: User) {
    return this.ops.markRead(user.id);
  }

  @Post("notifications/:id/read")
  readOne(@CurrentUser() user: User, @Param("id") id: string) {
    return this.ops.markRead(user.id, id);
  }

  @Post("feedback")
  feedback(@Body() body: unknown) {
    const input = feedbackSchema.parse(body);
    return this.prisma.feedback.create({ data: input });
  }
}
