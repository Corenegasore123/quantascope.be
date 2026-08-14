# Deployment Guide

## Local Development

See [README.md](../README.md).

## Production Checklist

- [x] Session-based auth with bcrypt
- [x] User-scoped data isolation
- [x] Role-based access (USER / ADMIN)
- [x] Security headers and rate limiting
- [x] File size limits enforced (`MAX_UPLOAD_SIZE_MB`)
- [x] Docker images for API, worker, CV service, frontend
- [x] CI pipeline (typecheck, tests, build)
- [ ] PostgreSQL provisioned with connection pooling (PgBouncer)
- [ ] Object storage configured (S3/R2 instead of local `STORAGE_PATH`)
- [ ] HTTPS termination (reverse proxy / load balancer)
- [ ] Secrets in environment (never committed)
- [ ] Redis for horizontal worker scaling
- [ ] Monitoring and alerting (logs, metrics, uptime)

## Docker

### Development (Redis only)

```bash
docker compose up -d
```

### Production stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Services: PostgreSQL, Redis, CV service, API, background worker.

```bash
# Initialise database
docker compose -f docker-compose.prod.yml exec api npx prisma db push
```

Create the first admin user through registration, then promote the account in the database if platform admin access is required.

### Individual builds

```bash
docker build -t quantscope-api .
docker build -t quantscope-worker -f Dockerfile.worker .
docker build -t quantscope-cv services/cv-service
```

Frontend (from `frontend/`):

```bash
docker build -t quantscope-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
```

## Environment Variables

Copy `.env.example` and configure all values for your environment.

Key production variables:

| Variable | Description |
|----------|-------------|
| `DB_*` | PostgreSQL connection |
| `REDIS_URL` | Job queue |
| `CV_SERVICE_URL` | OCR/CV microservice |
| `CORS_ORIGIN` | Frontend origin |
| `NODE_ENV` | `production` |
| `GLOBAL_RATE_LIMIT_PER_MIN` | Default 120 |
| `UPLOAD_RATE_LIMIT_PER_HOUR` | Default 30 |

## Database Migrations

```bash
npm run db:generate
npm run db:push          # dev
npx prisma migrate deploy # production with migrations
```

## CI

Push to `develop` or `main` triggers GitHub Actions:

- Backend: typecheck → engine tests → build
- Frontend: typecheck → build

## Load Testing

```bash
npm run load-test
```

## Monitoring

- API health: `GET /health`
- Readiness: `GET /api/ready` (DB + Redis + CV)
- Admin panel: `/admin` (stats + service health)
- Job failures: `CalculationJob` where `status = FAILED`
- Low confidence: jobs where validation status = `needs_review`
