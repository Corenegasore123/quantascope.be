# Authentication

QuantScope uses **database-backed sessions** with **httpOnly cookies** (not JWT in localStorage).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account + session |
| POST | `/api/auth/login` | No | Sign in |
| POST | `/api/auth/logout` | Yes | Revoke session |
| GET | `/api/auth/me` | Yes | Current user profile |
| GET | `/api/auth/check` | Yes | Lightweight session validation |
| PATCH | `/api/auth/password` | Yes | Change password (revokes other sessions) |
| POST | `/api/auth/forgot-password` | No | Stub (no email provider yet) |
| POST | `/api/auth/verify-email` | Yes | Not implemented (501) |

## Session model

- Token: 32 random bytes (hex), stored as SHA-256 hash in `Session` table
- Cookie name: `quantscope_session`
- Default lifetime: 7 hours (`SESSION_MAX_AGE_HOURS`)
- Supports `Authorization: Bearer <token>` for API clients

## Password security

- bcrypt with 12 rounds
- Minimum 8 characters
- Plaintext passwords never stored or logged

## Roles

- `USER` — default; access own projects and calculations
- `ADMIN` — platform administration (panel in a later milestone)

## Security

- Redis-backed rate limiting (global, auth, upload)
- Login lockout after repeated failures (`AUTH_MAX_FAILURES`, `AUTH_LOCKOUT_MINUTES`)
- Session cache in Redis for fast validation; PostgreSQL remains source of truth
- Password change revokes all other active sessions
- Configurable cookie domain / SameSite for production split-domain setups

## Frontend integration

The Next.js dev server proxies `/api/*` to the backend so session cookies are same-origin on `localhost:3000`. The frontend `proxy.ts` validates sessions via `/api/auth/check` before allowing `/app/*` routes.

Protected routes redirect unauthenticated users to `/sign-in`.

## Future providers

Auth is isolated in `src/modules/auth/`. Social login (Google, Microsoft, GitHub, Apple) can be added without changing calculation or document modules.
