import { Router } from "express";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  logoutUser,
  changePassword,
  PUBLIC_USER_SELECT,
} from "./auth.service.js";
import { prisma } from "../../lib/db.js";
import { requireAuth, SESSION_COOKIE, clientMeta } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";

export const authRouter = Router();

const SESSION_DAYS = parseInt(process.env.SESSION_MAX_AGE_DAYS ?? "30", 10);
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  path: "/",
};

function setSessionCookie(res: import("express").Response, token: string) {
  res.cookie(SESSION_COOKIE, token, COOKIE_OPTS);
}

function clearSessionCookie(res: import("express").Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    if (body.password !== body.confirmPassword) {
      throw new AppError(400, "Passwords do not match", "PASSWORD_MISMATCH");
    }
    const { user, token } = await registerUser(
      { name: body.name, email: body.email, password: body.password },
      clientMeta(req)
    );
    setSessionCookie(res, token);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const { user, token } = await loginUser(body, clientMeta(req));
    setSessionCookie(res, token);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    if (req.sessionToken) {
      await logoutUser(req.sessionToken, req.user!.id);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new AppError(404, "User not found");
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.patch("/password", requireAuth, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    await changePassword(req.user!.id, body.currentPassword, body.newPassword);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Architecture stubs — email provider not wired yet
authRouter.post("/forgot-password", async (req, res) => {
  const email = z.string().email().safeParse(req.body?.email);
  if (!email.success) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  // Always return success to prevent email enumeration
  res.json({
    ok: true,
    message: "If an account exists, password reset instructions will be sent.",
  });
});

authRouter.post("/verify-email", requireAuth, async (_req, res) => {
  res.status(501).json({
    error: "Email verification is not yet configured. Contact administrator.",
    code: "NOT_IMPLEMENTED",
  });
});
