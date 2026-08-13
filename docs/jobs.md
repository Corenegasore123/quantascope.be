# Background Jobs

Analysis jobs run asynchronously via **BullMQ** + **Redis**, processed by a separate worker process.

## Architecture

```text
Upload API
    ↓
Create CalculationJob (QUEUED)
    ↓
BullMQ Queue (Redis)
    ↓
Worker Process
    ↓
processCalculationJob()
    ↓
Status updates → Redis Pub/Sub → SSE stream
```

## Running locally

```bash
# Terminal 1 — Redis
docker compose up -d

# Terminal 2 — API
npm run dev

# Terminal 3 — Worker
npm run worker:dev
```

Without Redis (`REDIS_ENABLED=false`), jobs process inline in the API process (single-user dev only).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `REDIS_ENABLED` | `true` | Set `false` for inline processing |
| `WORKER_CONCURRENCY` | `2` | Parallel jobs per worker |
| `JOB_MAX_ATTEMPTS` | `3` | Retries with exponential backoff |
| `JOB_BACKOFF_MS` | `5000` | Initial backoff delay |

## Real-time status

Jobs publish status to Redis channel `job:status:{jobId}`.

Clients subscribe via SSE:

```http
GET /api/calculations/:id/stream
```

Response is `text/event-stream` with JSON payloads:

```json
{ "status": "EXTRACTING_MEASUREMENTS", "at": "2026-08-13T..." }
```

If Redis is disabled, the stream returns `{ "fallback": "poll" }` and clients should poll `GET /api/calculations/:id`.

## Scaling

Run multiple worker instances — BullMQ distributes jobs automatically. Increase `WORKER_CONCURRENCY` per instance for parallel processing within one worker.

## Idempotency

BullMQ job ID equals `calculationJobId`, preventing duplicate queue entries for the same analysis.
