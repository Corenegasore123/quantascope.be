import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators";
import { CONSENT_COOKIE, setConsentCookie } from "../../common/cookies";

@ApiTags("consent")
@Controller("consent")
export class ConsentController {
  @Public()
  @Get("cookies")
  get(@Req() req: Request) {
    return { accepted: req.cookies?.[CONSENT_COOKIE] === "accepted" };
  }

  @Public()
  @Post("cookies")
  post(@Body() body: { accepted?: boolean }, @Res({ passthrough: true }) res: Response) {
    if (body?.accepted) setConsentCookie(res);
    return { ok: true, accepted: Boolean(body?.accepted) };
  }
}
