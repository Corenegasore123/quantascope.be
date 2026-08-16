# System Architecture

## Overview

QuantScope is split into **frontend** and **backend** services plus a Python CV microservice.

```
apps/web (Frontend)     →  apps/api (Backend)  →  services/cv-service
   Next.js UI               Express REST            OCR / CV / Geometry
   Port 3000                Port 4000               Port 8000
                            PostgreSQL
                            Calculation Engine
```

## Components

### Frontend (`apps/web`)

- Next.js 15 — UI only, no API routes
- Calls backend via `NEXT_PUBLIC_API_URL`
- Pages: calculator, history, results, rules, settings

### Backend (`apps/api`)

- Express + TypeScript
- Prisma ORM + PostgreSQL
- Image upload, job pipeline, reports
- Integrates `@auto-measure/calculation-engine`
- Calls CV service for OCR/measurement extraction

### CV Service (`services/cv-service`)

- FastAPI Python service
- Tesseract OCR, OpenCV preprocessing, geometry detection
- Swappable provider pattern

### Calculation Engine (`packages/calculation-engine`)

- Shared deterministic formula registry
- Used exclusively by the backend — never by the frontend for math

## Data Flow

1. User uploads image via **frontend**
2. Frontend POSTs to **backend** `/api/calculations`
3. Backend stores image, creates job, calls **CV service**
4. Backend maps measurements → variables → runs **calculation engine**
5. Frontend polls job status and displays results

## Security

- CORS restricted to frontend origin
- File type and size validation on upload
- Secrets in environment variables only

## Extensibility

- New API routes → `apps/api/src/routes/`
- New calculation rules → `packages/calculation-engine`
- New OCR provider → `services/cv-service/app/providers/`
