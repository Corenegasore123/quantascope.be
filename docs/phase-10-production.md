# Production Hardening (Phase 10)

Final phase — security, containerization, CI, and load testing.

## Security

- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, HSTS (production)
- **Rate limiting** (in-memory, per-instance):
  - Global: 120 req/min (`GLOBAL_RATE_LIMIT_PER_MIN`)
  - Auth: 20 req/15 min per IP
  - Uploads: 30 POST/hour per IP (`UPLOAD_RATE_LIMIT_PER_HOUR`)
- **Trust proxy** enabled for correct client IP behind reverse proxies

## Docker

```bash
# Development — Redis only
docker compose up -d

# Production stack (postgres, redis, cv, api, worker)
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations inside api container
docker compose -f docker-compose.prod.yml exec api npx prisma db push
```

| Image | Dockerfile |
|-------|------------|
| API | `Dockerfile` |
| Worker | `Dockerfile.worker` |
| CV service | `services/cv-service/Dockerfile` |
| Frontend | `../frontend/Dockerfile` (standalone Next.js) |

## CI

GitHub Actions on `develop` and `main`:

- **Backend**: typecheck, engine tests, build
- **Frontend**: typecheck, production build

## Load test

```bash
# API must be running
npm run load-test

# Custom
API_URL=http://localhost:4000 CONCURRENCY=20 REQUESTS=500 node scripts/load-test.mjs
```

Reports success rate and p50/p95/p99 latency for `/health` and `/api/ready`.

## Production checklist

See [deployment.md](./deployment.md) for the full checklist.
