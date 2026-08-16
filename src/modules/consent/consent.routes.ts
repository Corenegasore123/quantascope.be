import { Router } from "express";
import { z } from "zod";
import {
  clearAuthCookies,
  clearConsentCookie,
  setConsentCookie,
} from "../../lib/cookies.js";

export const consentRouter = Router();

const bodySchema = z.object({
  accepted: z.boolean(),
});

consentRouter.post("/cookies", (req, res, next) => {
  try {
    const body = bodySchema.parse(req.body);

    if (body.accepted) {
      setConsentCookie(res);
      res.json({ ok: true, status: "accepted" });
      return;
    }

    clearConsentCookie(res);
    clearAuthCookies(res);
    res.json({ ok: true, status: "declined" });
  } catch (error) {
    next(error);
  }
});
