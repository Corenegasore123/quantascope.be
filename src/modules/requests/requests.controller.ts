import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { User } from "@prisma/client";
import { CurrentUser } from "../../common/decorators";
import { RequestsService } from "./requests.service";
import { memoryStorage } from "multer";

@ApiTags("requests")
@Controller("requests")
export class RequestsController {
  constructor(@Inject(RequestsService) private readonly requests: RequestsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query("status") status?: string) {
    return this.requests.list(user, status);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: unknown) {
    return this.requests.create(user, body);
  }

  @Get(":id")
  get(@CurrentUser() user: User, @Param("id") id: string) {
    return this.requests.get(user, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    return this.requests.update(user, id, body);
  }

  @Post(":id/submit")
  submit(@CurrentUser() user: User, @Param("id") id: string) {
    return this.requests.submit(user, id);
  }

  @Post(":id/approve")
  approve(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    return this.requests.decide(user, id, "APPROVE", body);
  }

  @Post(":id/reject")
  reject(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    return this.requests.decide(user, id, "REJECT", body);
  }

  @Post(":id/complete")
  complete(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    return this.requests.decide(user, id, "COMPLETE", body);
  }

  @Post(":id/clear")
  clear(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    return this.requests.decide(user, id, "CLEAR", body);
  }

  @Post(":id/outstanding")
  outstanding(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    return this.requests.decide(user, id, "OUTSTANDING", body);
  }

  @Post(":id/cancel")
  cancel(@CurrentUser() user: User, @Param("id") id: string) {
    return this.requests.cancel(user, id);
  }

  @Post(":id/attachments")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  attach(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.requests.attach(user, id, file);
  }

  @Get(":id/attachments/:attachmentId")
  async download(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Res() res: Response
  ) {
    const { attachment, data } = await this.requests.download(user, id, attachmentId);
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${attachment.filename}"`);
    res.send(data);
  }
}
