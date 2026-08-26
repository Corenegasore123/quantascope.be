import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser, Roles } from "../../common/decorators";
import { ReviewsService } from "./reviews.service";
import { dinerReviewSchema, rejectReviewSchema } from "../../shared/validation";

@ApiTags("customer-reviews")
@Controller("customer/reviews")
@Roles("CUSTOMER")
export class CustomerReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Get("eligible")
  eligible(@CurrentUser() user: User, @Query("restaurantId") restaurantId?: string) {
    return this.reviews.eligible(user, restaurantId);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.reviews.listMine(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: unknown) {
    const input = dinerReviewSchema.parse(body);
    return this.reviews.create(user, input);
  }
}

@ApiTags("platform-reviews")
@Controller("platform/reviews")
@Roles("PLATFORM_ADMIN")
export class PlatformReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Get()
  queue(@Query("status") status?: string) {
    return this.reviews.queue(status);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string) {
    return this.reviews.moderate(id, "APPROVED");
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() body: unknown) {
    const input = rejectReviewSchema.parse(body ?? {});
    return this.reviews.moderate(id, "REJECTED", input.reason);
  }
}
