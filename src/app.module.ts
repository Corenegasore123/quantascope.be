import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthGuard } from "./common/auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { RedisService } from "./common/redis.service";
import { StorageService } from "./common/storage.service";
import { AuthService } from "./modules/auth/auth.service";
import { AuthController } from "./modules/auth/auth.controller";
import { AuditService } from "./modules/audit/audit.service";
import { NotificationsService } from "./modules/notifications/notifications.service";
import { WorkflowEngine } from "./modules/workflows/engine.service";
import { RequestsService } from "./modules/requests/requests.service";
import { RequestsController } from "./modules/requests/requests.controller";
import { TasksController } from "./modules/tasks/tasks.controller";
import { WorkflowsController } from "./modules/workflows/workflows.controller";
import { UsersController } from "./modules/users/users.controller";
import { DepartmentsController, RequestTypesController } from "./modules/org/org.controller";
import { AssetsController } from "./modules/assets/assets.controller";
import { ReportsController, SearchController, AuditController } from "./modules/reports/reports.controller";
import {
  NotificationsController,
  ConsentController,
  AssistantController,
} from "./modules/misc/misc.controller";
import { HealthController } from "./modules/health/health.controller";
import { SlaScheduler } from "./modules/jobs/sla.scheduler";
import { DocumentsController } from "./modules/documents/documents.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    HealthController,
    AuthController,
    RequestsController,
    TasksController,
    WorkflowsController,
    UsersController,
    DepartmentsController,
    RequestTypesController,
    AssetsController,
    ReportsController,
    SearchController,
    AuditController,
    NotificationsController,
    ConsentController,
    AssistantController,
    DocumentsController,
  ],
  providers: [
    RedisService,
    StorageService,
    AuthService,
    AuditService,
    NotificationsService,
    WorkflowEngine,
    RequestsService,
    SlaScheduler,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
