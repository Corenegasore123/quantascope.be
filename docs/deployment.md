# Deployment Guide

## Local Development

See [README.md](../README.md).

## Production Checklist

- [ ] PostgreSQL provisioned with connection pooling
- [ ] Database configured (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, etc.)
- [ ] Object storage configured (replace local `STORAGE_PATH`)
- [ ] Tesseract installed on CV service host
- [ ] `CV_OCR_PROVIDER=tesseract` (not mock)
- [ ] HTTPS termination (reverse proxy)
- [ ] Rate limiting on upload endpoints
- [ ] File size limits enforced
- [ ] Secrets in environment (never committed)

## Docker (Recommended)

Build and run each service:

```bash
# CV Service
docker build -t automeasure-cv services/cv-service
docker run -p 8000:8000 automeasure-cv

# Web App
docker build -t automeasure-web apps/web
docker run -p 3000:3000 -e DB_HOST=... -e DB_USER=... -e DB_PASSWORD=... -e DB_NAME=... automeasure-web
```

## Environment Variables

Copy `.env.example` and configure all values for your environment.

## Database Migrations

```bash
npm run db:generate
npx prisma migrate deploy
```

## Monitoring

- CV service: `GET /health`
- Job failures: query `CalculationJob` where `status = FAILED`
- Confidence review: query jobs where `overallConfidence < 0.80`
