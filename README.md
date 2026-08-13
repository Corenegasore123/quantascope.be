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
npm run seed                  # optional dev admin user
```

## Auth (Milestone 1)

- Register / login / logout via `/api/auth/*`
- Session cookie: `quantscope_session` (httpOnly)
- All calculation and image routes require authentication
- Dev admin after seed: `admin@quantscope.local` / `Admin123!`

See [docs/authentication.md](./docs/authentication.md).

## Run

```bash
# Terminal 1 — API
npm run dev

# Terminal 2 — CV service
cd services/cv-service
../../.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000

# Terminal 3 — Redis (optional but recommended)
docker compose up -d

# Terminal 4 — Background worker
npm run worker:dev
```

API: http://localhost:4000/health

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with hot reload |
| `npm run db:push` | Sync database schema |
| `npm run seed` | Create dev admin user |
| `npm run worker` | Start analysis worker |
| `npm run worker:dev` | Worker with hot reload |
| `npm run test:engine` | Run calculation engine tests |
