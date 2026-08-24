import { Inject, Injectable } from "@nestjs/common";
import { Prisma, ReviewStatus } from "@prisma/client";
import type { User } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/app-error";
import { StorageService } from "../../common/storage.service";
import { assertRestaurantDishPhoto } from "../../common/menu-photo";
import { RestaurantService } from "../restaurant/restaurant.service";

const APPROVED: ReviewStatus = "APPROVED";

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(RestaurantService) private readonly ops: RestaurantService
  ) {}

  private mapReview(
    r: {
      id: string;
      rating: number;
      food: number;
      service: number;
      ambience: number;
      comment: string;
      author: string;
      status: ReviewStatus;
      rejectReason: string | null;
      createdAt: Date;
      reservationId: string | null;
      images: { url: string; alt: string; sort: number }[];
      restaurant: { id: string; slug: string; name: string; coverUrl: string | null };
    },
    forAuthor: boolean
  ) {
    return {
      id: r.id,
      rating: r.rating,
      food: r.food,
      service: r.service,
      ambience: r.ambience,
      comment: r.comment,
      author: r.author,
      createdAt: r.createdAt,
      reservationId: r.reservationId,
      images: r.images.slice().sort((a, b) => a.sort - b.sort).map((i) => ({ url: i.url, alt: i.alt })),
      restaurant: r.restaurant,
      status: forAuthor ? r.status : undefined,
      rejectReason: forAuthor && r.status === "REJECTED" ? r.rejectReason : undefined,
    };
  }

  async recalculate(restaurantId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { restaurantId, status: APPROVED },
      _avg: { rating: true, food: true, service: true, ambience: true },
      _count: true,
    });
    const round = (n: number | null) => Number((n ?? 0).toFixed(2));
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        rating: round(stats._avg.rating),
        ratingFood: round(stats._avg.food),
        ratingService: round(stats._avg.service),
        ratingAmbience: round(stats._avg.ambience),
        reviewCount: stats._count,
      },
    });
  }

  private async dinerCustomer(user: User) {
    let customer = await this.prisma.customer.findUnique({ where: { userId: user.id } });
    if (!customer) {
      const byEmail = await this.prisma.customer.findFirst({
        where: { email: { equals: user.email, mode: "insensitive" }, userId: null },
      });
      if (byEmail) {
        customer = await this.prisma.customer.update({
          where: { id: byEmail.id },
          data: { userId: user.id, name: user.name, phone: user.phone ?? byEmail.phone },
        });
      } else {
        customer = await this.prisma.customer.create({
          data: { userId: user.id, name: user.name, email: user.email, phone: user.phone },
        });
      }
    }
    return customer;
  }

  private ownsReservation(
    resv: { customerId: string; customer: { userId: string | null; email: string | null; phone: string | null } },
    user: User,
    customerId: string
  ) {
    if (resv.customerId === customerId) return true;
    if (resv.customer.userId === user.id) return true;
    const email = user.email.trim().toLowerCase();
    if (resv.customer.email?.trim().toLowerCase() === email) return true;
    const phone = (user.phone ?? "").replace(/\D/g, "");
    const theirs = (resv.customer.phone ?? "").replace(/\D/g, "");
    if (phone && theirs && phone === theirs) return true;
    return false;
  }

  async eligible(user: User, restaurantId?: string) {
    await this.ops.completeElapsedReservations();
    const customer = await this.dinerCustomer(user);
    const where: Prisma.ReservationWhereInput = {
      status: "COMPLETED",
      review: null,
      OR: [
        { customerId: customer.id },
        { customer: { userId: user.id } },
        { customer: { email: { equals: user.email, mode: "insensitive" } } },
        ...(user.phone ? [{ customer: { phone: user.phone } }] : []),
      ],
    };
    if (restaurantId) {
      where.branch = { restaurant: { OR: [{ id: restaurantId }, { slug: restaurantId }] } };
    }
    const rows = await this.prisma.reservation.findMany({
      where,
      include: {
        branch: { include: { restaurant: { select: { id: true, slug: true, name: true, coverUrl: true } } } },
      },
      orderBy: { date: "desc" },
    });
    return rows.map((r) => ({
      reservationId: r.id,
      number: r.number,
      date: r.date,
      time: r.time,
      restaurant: r.branch.restaurant,
    }));
  }

  async create(
    user: User,
    input: { reservationId: string; rating: number; food: number; service: number; ambience: number; comment?: string },
    files: Express.Multer.File[]
  ) {
    await this.ops.completeElapsedReservations();
    const customer = await this.dinerCustomer(user);
    const resv = await this.prisma.reservation.findFirst({
      where: { id: input.reservationId },
      include: { customer: true, branch: { include: { restaurant: true } }, review: true },
    });
    if (!resv?.branch.restaurant) throw new AppError(404, "Reservation not found", "NOT_FOUND");
    if (!this.ownsReservation(resv, user, customer.id)) {
      throw new AppError(403, "This reservation is not yours", "FORBIDDEN");
    }
    if (resv.status !== "COMPLETED") {
      throw new AppError(403, "You can review after a completed visit", "NOT_ELIGIBLE");
    }
    if (resv.review) throw new AppError(409, "This visit already has a review", "REVIEW_EXISTS");

    const restaurant = resv.branch.restaurant;
    try {
      const review = await this.prisma.review.create({
        data: {
          restaurantId: restaurant.id,
          customerId: customer.id,
          reservationId: resv.id,
          author: user.name,
          rating: input.rating,
          food: input.food,
          service: input.service,
          ambience: input.ambience,
          comment: input.comment?.trim() ?? "",
          status: "PENDING",
        },
        include: { images: true, restaurant: { select: { id: true, slug: true, name: true, coverUrl: true } } },
      });

      const images = [];
      for (const [i, file] of (files ?? []).entries()) {
        if (!file?.buffer?.length) continue;
        assertRestaurantDishPhoto(file);
        const filename = `${review.id}-${i}.jpg`;
        await this.storage.save("reviews", filename, file.buffer);
        const row = await this.prisma.reviewImage.create({
          data: {
            reviewId: review.id,
            url: `/api/public/media/reviews/${filename}`,
            alt: "",
            sort: i,
          },
        });
        images.push(row);
      }

      return this.mapReview({ ...review, images }, true);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(409, "This visit already has a review", "REVIEW_EXISTS");
      }
      throw err;
    }
  }

  async listMine(user: User) {
    const customer = await this.dinerCustomer(user);
    const rows = await this.prisma.review.findMany({
      where: {
        OR: [{ customerId: customer.id }, { customer: { userId: user.id } }],
      },
      include: {
        images: true,
        restaurant: { select: { id: true, slug: true, name: true, coverUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.mapReview(r, true));
  }

  async listPublic(slug: string, page = 1, pageSize = 8) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { OR: [{ slug }, { id: slug }], status: "ACTIVE" },
    });
    if (!restaurant) throw new AppError(404, "Restaurant not found", "NOT_FOUND");
    const take = Math.min(24, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    const [total, items] = await Promise.all([
      this.prisma.review.count({ where: { restaurantId: restaurant.id, status: APPROVED } }),
      this.prisma.review.findMany({
        where: { restaurantId: restaurant.id, status: APPROVED },
        include: {
          images: true,
          restaurant: { select: { id: true, slug: true, name: true, coverUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);
    return {
      restaurant: {
        id: restaurant.id,
        slug: restaurant.slug,
        rating: restaurant.rating,
        ratingFood: restaurant.ratingFood,
        ratingService: restaurant.ratingService,
        ratingAmbience: restaurant.ratingAmbience,
        reviewCount: restaurant.reviewCount,
      },
      page: Math.max(1, page),
      pageSize: take,
      total,
      pages: Math.max(1, Math.ceil(total / take)),
      items: items.map((r) => this.mapReview(r, false)),
    };
  }

  async queue(status?: string) {
    const st = status?.toUpperCase();
    const where: Prisma.ReviewWhereInput =
      st === "APPROVED" || st === "REJECTED" || st === "PENDING" ? { status: st } : { status: "PENDING" };
    return this.prisma.review.findMany({
      where,
      include: {
        images: true,
        restaurant: { select: { id: true, slug: true, name: true } },
        customer: { select: { name: true, email: true } },
        reservation: { select: { number: true, date: true, time: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async moderate(id: string, action: "APPROVED" | "REJECTED", reason?: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new AppError(404, "Review not found", "NOT_FOUND");
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        status: action,
        rejectReason: action === "REJECTED" ? reason?.trim() || "Does not meet community guidelines" : null,
        moderatedAt: new Date(),
      },
    });
    await this.recalculate(review.restaurantId);
    return updated;
  }
}
