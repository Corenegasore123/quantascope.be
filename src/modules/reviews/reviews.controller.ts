import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser, Public, Roles } from "../../common/decorators";
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
  @UseInterceptors(
    FilesInterceptor("photos", 4, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  create(
    @CurrentUser() user: User,
    @Body() body: Record<string, string>,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const input = dinerReviewSchema.parse({
      reservationId: body.reservationId,
      rating: Number(body.rating),
      food: Number(body.food),
      service: Number(body.service),
      ambience: Number(body.ambience),
      comment: body.comment,
    });
    return this.reviews.create(user, input, files ?? []);
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
