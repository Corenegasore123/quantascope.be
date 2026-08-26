import { Controller, Get, Header, Inject, Param, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators";
import { PublicService } from "./public.service";
import { StorageService } from "../../common/storage.service";
import { AppError } from "../../common/app-error";
import { ReviewsService } from "../reviews/reviews.service";

@ApiTags("public")
@Controller("public")
export class PublicController {
  constructor(
    @Inject(PublicService) private readonly pub: PublicService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(ReviewsService) private readonly reviewsSvc: ReviewsService
  ) {}

  @Public()
  @Get("media/menu/:file")
  @Header("Cache-Control", "public, max-age=86400")
  async menuPhoto(@Param("file") file: string, @Res() res: Response) {
    if (!/^[0-9a-f-]{36}\.jpg$/i.test(file)) throw new AppError(400, "Invalid photo", "BAD_FILE");
    try {
      const buf = await this.storage.read(this.storage.pathFor("menu", file));
      res.setHeader("Content-Type", "image/jpeg");
      res.send(buf);
    } catch {
      throw new AppError(404, "Photo not found", "NOT_FOUND");
    }
  }

  @Public()
  @Get("media/reviews/:file")
  @Header("Cache-Control", "public, max-age=86400")
  async reviewPhoto(@Param("file") file: string, @Res() res: Response) {
    if (!/^[0-9a-f-]{36}-\d+\.jpg$/i.test(file)) throw new AppError(400, "Invalid photo", "BAD_FILE");
    try {
      const buf = await this.storage.read(this.storage.pathFor("reviews", file));
      res.setHeader("Content-Type", "image/jpeg");
      res.send(buf);
    } catch {
      throw new AppError(404, "Photo not found", "NOT_FOUND");
    }
  }

  @Public()
  @Get("restaurants/:slug/reviews")
  listReviews(
    @Param("slug") slug: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.reviewsSvc.listPublic(slug, Number(page || 1), Number(pageSize || 8));
  }

  @Public()
  @Get("home")
  home(@Query("city") city?: string) {
    return this.pub.home(city?.trim() || undefined);
  }

  @Public()
  @Get("cities")
  cities() {
    return this.pub.cities();
  }

  @Public()
  @Get("cities/:slug")
  city(@Param("slug") slug: string) {
    return this.pub.cityPage(slug);
  }

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
      city, q, cuisine, neighborhood, price, rating, feature, openNow, available, date, time, guests, sort, page, pageSize,
    });
  }

  @Public()
  @Get("search")
  search(
    @Query("q") q?: string,
    @Query("city") city?: string,
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
    return this.pub.search({
      q, city, cuisine, neighborhood, price, rating, feature, openNow, available, date, time, guests, sort, page, pageSize,
    });
  }

  @Public()
  @Get("search/suggest")
  suggest(@Query("q") q?: string) {
    return this.pub.suggest(q);
  }

  @Public()
  @Get("restaurants/:slug/availability")
  availability(
    @Param("slug") slug: string,
    @Query("date") date: string,
    @Query("guests") guests: string,
    @Query("branchId") branchId?: string
  ) {
    return this.pub.availability(slug, date || new Date().toISOString().slice(0, 10), Number(guests || 2), branchId);
  }

  @Public()
  @Get("restaurants/:slug")
  one(@Param("slug") slug: string) {
    return this.pub.restaurant(slug);
  }
}
