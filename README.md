# Nexora Campus API

NestJS backend for university requests, configurable workflows, approvals, SLA, assets, and audit.

Frontend: [nexora.fe](https://github.com/Corenegasore123/nexora.fe)

## Stack

- NestJS / TypeScript
- PostgreSQL / Prisma
- Redis (health checks and optional job infrastructure)

## Setup

```bash
docker compose up -d postgres redis
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run start:dev
```

- API: http://localhost:4000/health
- Swagger: http://localhost:4000/api/docs

Postgres is on **host port 5433**. Redis is optional if you set `REDIS_ENABLED=false`.

## Demo accounts

Password: `Campus#2026`

| Email | Role |
|---|---|
| student@nexora.campus | Student |
| registrar@nexora.campus | Staff |
| finance@nexora.campus | Staff |
| admin@nexora.campus | Admin |
