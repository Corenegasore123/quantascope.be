# QuantScope Backend

Express REST API for image upload, measurement extraction, and deterministic quantity calculations.

## Stack

- Node.js / Express / TypeScript
- PostgreSQL / Prisma
- Python CV service (Tesseract OCR)

## Setup

```bash
npm install
python -m venv .venv
.\.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env              # configure DB_* credentials
npm run db:generate
npm run db:push
npm run redis:up              # start Redis (required when REDIS_ENABLED=true)
```

## Auth

- Register / login / logout via `/api/auth/*`
- Session cookie: `quantscope_session` (httpOnly)
- Session validation: `GET /api/auth/check`
- Redis-backed rate limits and login lockout
- All calculation and image routes require authentication
- Create accounts via `/api/auth/register` or the frontend sign-up page

See [docs/authentication.md](./docs/authentication.md).

## Run

```bash
# Terminal 1 — API
npm run dev

# Terminal 2 — CV service
cd services/cv-service
../../.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000

# Terminal 3 — Redis (required)
npm run redis:up

# Terminal 4 — Background worker
npm run worker:dev
```

API: http://localhost:4000/health

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with hot reload |
| `npm run db:push` | Sync database schema |
| `npm run redis:up` | Start Redis via Docker Compose |
| `npm run worker` | Start analysis worker |
| `npm run worker:dev` | Worker with hot reload |
| `npm run test:engine` | Run calculation engine tests |
