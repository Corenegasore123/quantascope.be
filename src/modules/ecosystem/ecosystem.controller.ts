import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { User } from "@prisma/client";
import { CurrentUser, Public, Roles } from "../../common/decorators";
import { EcosystemService } from "./ecosystem.service";
import { PublicService } from "../public/public.service";
import {
  businessSettingsSchema,
  createBranchSchema,
  createOwnerSchema,
  lookupReservationSchema,
  publicBookSchema,
  restaurantProfileSchema,
} from "../../shared/validation";
import { SESSION_COOKIE } from "../../common/cookies";
import { AuthService } from "../auth/auth.service";

@ApiTags("platform")
@Controller("platform")
@Roles("PLATFORM_ADMIN")
export class PlatformController {
  constructor(@Inject(EcosystemService) private readonly eco: EcosystemService) {}

  @Get("dashboard")
  dashboard() {
    return this.eco.platformDashboard();
  }

  @Post("owners")
  createOwner(@Body() body: unknown) {
    return this.eco.createOwner(createOwnerSchema.parse(body));
  }
}

@ApiTags("onboarding")
@Controller("onboarding")
@Roles("OWNER")
export class OnboardingController {
  constructor(@Inject(EcosystemService) private readonly eco: EcosystemService) {}

  @Post("restaurant")
  profile(@CurrentUser() user: User, @Body() body: unknown) {
    return this.eco.createRestaurant(user, restaurantProfileSchema.parse(body));
  }

  @Post("settings")
  settings(@CurrentUser() user: User, @Body() body: unknown) {
    return this.eco.updateSettings(user, businessSettingsSchema.parse(body));
  }

  @Post("branches")
  branch(@CurrentUser() user: User, @Body() body: unknown) {
    return this.eco.addBranch(user, createBranchSchema.parse(body));
  }

  @Get("checklist")
  checklist(@CurrentUser() user: User) {
    return this.eco.checklist(user);
  }
}

@ApiTags("discover")
@Controller("discover")
export class DiscoverController {
  constructor(
    @Inject(EcosystemService) private readonly eco: EcosystemService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PublicService) private readonly pub: PublicService
  ) {}

  @Public()
  @Get("restaurants")
  list(
    @Query("city") city?: string,
    @Query("q") q?: string,
    @Query("cuisine") cuisine?: string,
    @Query("neighborhood") neighborhood?: string,
    @Query("price") price?: string,
    @Query("rating") rating?: string,
    @Query("feature") feature?: string,
    @Query("openNow") openNow?: string,
    @Query("available") available?: string,
    @Query("date") date?: string,
    @Query("time") time?: string,
    @Query("guests") guests?: string,
    @Query("sort") sort?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.pub.list({
      city,
      q,
      cuisine,
      neighborhood,
      price,
      rating,
      feature,
      openNow,
      available,
      date,
      time,
      guests,
      sort,
      page,
      pageSize,
    });
  }

  @Public()
  @Get("restaurants/:id")
  one(@Param("id") id: string) {
    return this.pub.restaurant(id);
  }

  @Public()
  @Get("restaurants/:id/availability")
  availability(
    @Param("id") id: string,
    @Query("date") date: string,
    @Query("guests") guests: string,
    @Query("branchId") branchId?: string
  ) {
    return this.pub.availability(id, date || new Date().toISOString().slice(0, 10), Number(guests || 2), branchId);
  }

  @Public()
  @Post("book")
  async book(@Body() body: unknown, @Req() req: Request) {
    const input = publicBookSchema.parse(body);
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const user = token ? await this.auth.findUserBySessionToken(token) : null;
    return this.eco.book(input, user);
  }

  @Public()
  @Post("lookup")
  lookup(@Body() body: unknown) {
    const input = lookupReservationSchema.parse(body);
    return this.eco.lookupReservation(input.number, input.email || undefined, input.phone || undefined);
  }

  @Public()
  @Get("me/favorites")
  async favorites(@Req() req: Request) {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const user = token ? await this.auth.findUserBySessionToken(token) : null;
    if (!user) return { ids: [] as string[], items: [] };
    return this.pub.favorites(user.id);
  }

  @Post("me/favorites/:restaurantId")
  toggleFavorite(@CurrentUser() user: User, @Param("restaurantId") restaurantId: string) {
    return this.pub.toggleFavorite(user.id, restaurantId);
  }

  @Get("me/reservations")
  @Roles("CUSTOMER")
  mine(@CurrentUser() user: User) {
    return this.eco.myReservations(user);
  }

  @Post("me/reservations/:id/cancel")
  @Roles("CUSTOMER")
  cancelMine(@CurrentUser() user: User, @Param("id") id: string) {
    return this.eco.cancelMyReservation(user, id);
  }
}
