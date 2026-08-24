import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthGuard } from "./common/auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { RedisService } from "./common/redis.service";
import { AuthService } from "./modules/auth/auth.service";
import { AuthController } from "./modules/auth/auth.controller";
import { AuditService } from "./modules/audit/audit.service";
import { StorageService } from "./common/storage.service";
import { HealthController } from "./modules/health/health.controller";
import { RestaurantController } from "./modules/restaurant/restaurant.controller";
import { RestaurantService } from "./modules/restaurant/restaurant.service";
import { ConsentController } from "./modules/misc/consent.controller";
import { EcosystemService } from "./modules/ecosystem/ecosystem.service";
import { DiscoverController, OnboardingController, PlatformController } from "./modules/ecosystem/ecosystem.controller";
import { PublicController } from "./modules/public/public.controller";
import { PublicService } from "./modules/public/public.service";
import { RecommendationService } from "./modules/public/recommendation.service";
import { ReviewsService } from "./modules/reviews/reviews.service";
import { CustomerReviewsController, PlatformReviewsController } from "./modules/reviews/reviews.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    HealthController,
    AuthController,
    RestaurantController,
    ConsentController,
    PlatformController,
    OnboardingController,
    DiscoverController,
    PublicController,
    CustomerReviewsController,
    PlatformReviewsController,
  ],
  providers: [
    RedisService,
    AuthService,
    AuditService,
    RestaurantService,
    StorageService,
    EcosystemService,
    PublicService,
    RecommendationService,
    ReviewsService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
