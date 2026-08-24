# Nexora API

NestJS backend for the restaurant operating system: reservations, tables, POS, kitchen display, inventory, procurement, staff, and analytics.

Frontend: [nexora.fe](https://github.com/Corenegasore123/nexora.fe)

## Stack

- NestJS / TypeScript
- PostgreSQL / Prisma
- Redis (health checks)

## Setup

Create a `.env` in this folder (same values work with the Docker Compose database):

```
DATABASE_URL=postgresql://nexora:nexora@localhost:5433/nexora
REDIS_URL=redis://localhost:6380
REDIS_ENABLED=true
API_PORT=4000
CORS_ORIGIN=http://localhost:3000
SESSION_MAX_AGE_HOURS=12
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
STORAGE_PATH=./storage
MAX_UPLOAD_SIZE_MB=20
```

Then:

```bash
docker compose up -d postgres redis
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run start:dev
```

- API: http://localhost:4000/health
- Swagger: http://localhost:4000/api/docs

Postgres is on **host port 5433**. Redis is on **host port 6380**. Redis is optional if you set `REDIS_ENABLED=false`.

## Demo accounts

Password: `Nexora#2026`

| Email | Role |
|---|---|
| owner@nexora.rw | Owner |
| manager@nexora.rw | Manager |
| waiter@nexora.rw | Waiter |
| chef@nexora.rw | Chef |
| cashier@nexora.rw | Cashier |
| inventory@nexora.rw | Inventory manager |
