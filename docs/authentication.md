# Authentication

QuantScope uses **database-backed sessions** with **httpOnly cookies** (not JWT in localStorage).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account + session |
| POST | `/api/auth/login` | No | Sign in |
| POST | `/api/auth/logout` | Yes | Revoke session |
| GET | `/api/auth/me` | Yes | Current user profile |
| PATCH | `/api/auth/password` | Yes | Change password |
| POST | `/api/auth/forgot-password` | No | Stub (no email provider yet) |
| POST | `/api/auth/verify-email` | Yes | Not implemented (501) |

## Session model

- Token: 32 random bytes (hex), stored as SHA-256 hash in `Session` table
- Cookie name: `quantscope_session`
- Default lifetime: 30 days (`SESSION_MAX_AGE_DAYS`)
- Supports `Authorization: Bearer <token>` for API clients

## Password security

- bcrypt with 12 rounds
- Minimum 8 characters
- Plaintext passwords never stored or logged

## Roles

- `USER` — default; access own projects and calculations
- `ADMIN` — platform administration (panel in a later milestone)

## Frontend integration

The Next.js dev server proxies `/api/*` to the backend so session cookies are same-origin on `localhost:3000`.

Protected routes redirect unauthenticated users to `/login`.

## Future providers

Auth is isolated in `src/modules/auth/`. Social login (Google, Microsoft, GitHub, Apple) can be added without changing calculation or document modules.

## Dev seed

```bash
npm run seed
```

Creates `admin@quantscope.local` / `Admin123!` when not present.
