# Deployment

Nexora Campus is four managed services. None of them need GPUs or native CV libraries.

```
Frontend (Next.js)     → Vercel
Backend (NestJS)       → Render / Railway / Fly.io
PostgreSQL             → Neon / Render Postgres / Railway
Redis                  → Upstash / Redis Cloud
Files                  → local disk in development, S3/R2 in production
```

## Frontend (Vercel)

Root directory: repository root of `frontend/`

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

The Next.js config proxies `/api/*` to the NestJS origin so session cookies work on one site URL. For a split domain, also set backend `CORS_ORIGIN` and `COOKIE_DOMAIN`.

## Backend (Render / Railway / Fly.io)

Build from `backend/` using `Dockerfile`, or:

```
npm install
npx prisma generate
npx tsx src/main.ts
```

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
REDIS_ENABLED=true
CORS_ORIGIN=https://your-app.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
API_PORT=4000
STORAGE_PATH=/var/data/storage
```

```
npx prisma db push
npx tsx prisma/seed.ts
```

## Docker Compose

From the parent folder that contains `frontend/` and `backend/`:

```bash
docker compose up --build
```

Then seed:

```bash
docker compose exec api npx prisma db push
docker compose exec api npx tsx prisma/seed.ts
```

## Production notes

- Uploads currently use disk (`STORAGE_PATH`). Swap in S3/R2 behind `StorageService` before running multiple API instances.
- SLA checks run every 60 seconds.
- API documentation is served at `/api/docs`.
- Health: `GET /health`. Readiness: `GET /api/ready`.
