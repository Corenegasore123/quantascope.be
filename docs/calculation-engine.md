# Calculation Engine — Correction & Versioning

The deterministic engine never re-runs OCR when inputs change.

## Recalculation flow

```text
User corrects variable/measurement
    ↓
Archive current state → CalculationRevision
    ↓
Update inputs in database
    ↓
Run deterministic engine only
    ↓
Increment job.version
    ↓
New result + steps stored
```

## API

| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/api/calculations/:id/variables/:name` | Correct variable + recalculate |
| PATCH | `/api/calculations/:id/measurements/:measurementId` | Correct measurement + sync variable + recalculate |
| POST | `/api/calculations/:id/recalculate` | Recalculate from current variables |
| POST | `/api/calculations/:id/scenarios` | What-if: fork job with overrides |
| GET | `/api/calculations/:id/revisions` | Version history |
| GET | `/api/calculations/:id/scenarios` | Child scenarios |

### Scenario example

```json
POST /api/calculations/{id}/scenarios
{
  "name": "Depth increased",
  "overrides": {
    "height_or_depth": { "value": 1.0, "unit": "m" }
  }
}
```

Creates a new calculation job linked via `parentJobId`, copies the image, applies overrides, runs the engine.

## Data model

- `CalculationJob.version` — current version number
- `CalculationRevision` — archived snapshots (variables, measurements, steps, result)
- `CalculationJob.parentJobId` / `scenarioName` — what-if forks
- `DetectedMeasurement.userCorrected` — tracks manual corrections

## Audit

Actions logged: `measurement.corrected`, `variable.corrected`, `calculation.recalculated`, `scenario.created`.
