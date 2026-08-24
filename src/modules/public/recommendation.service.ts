import { Injectable } from "@nestjs/common";
import type { PublicCard } from "./public.util";

type ScoreInput = {
  rating: number;
  reviewCount: number;
  hasAvailability: boolean;
  nextSlot?: string;
  publishedAt?: Date | null;
  createdAt: Date;
  reservations14d: number;
};

@Injectable()
export class RecommendationService {
  score(input: ScoreInput): { score: number; reasons: string[] } {
    const rating = Math.min(1, Math.max(0, input.rating / 5));
    const reviews = Math.min(1, Math.log1p(input.reviewCount) / Math.log1p(400));
    const availability = input.hasAvailability ? 1 : 0.25;
    const published = input.publishedAt ?? input.createdAt;
    const ageDays = Math.max(0, (Date.now() - published.getTime()) / 86400000);
    const recency = ageDays <= 14 ? 1 : ageDays <= 45 ? 0.65 : 0.3;
    const popularity = Math.min(1, input.reservations14d / 12);

    const score =
      0.35 * rating + 0.2 * reviews + 0.2 * availability + 0.1 * recency + 0.15 * popularity;

    const reasons: string[] = [];
    if (input.rating >= 4.5) reasons.push(`${input.rating.toFixed(1)} rating`);
    if (input.reviewCount >= 80) reasons.push(`${input.reviewCount} reviews`);
    if (input.nextSlot) reasons.push(`table at ${input.nextSlot}`);
    else if (input.hasAvailability) reasons.push("tables tonight");
    if (ageDays <= 14) reasons.push("new on Nexora");
    if (popularity >= 0.5) reasons.push("booked often this week");
    return { score: Math.round(score * 1000) / 1000, reasons: reasons.slice(0, 3) };
  }

  rank(cards: PublicCard[]) {
    return [...cards].sort((a, b) => b.score - a.score || b.rating - a.rating);
  }
}
