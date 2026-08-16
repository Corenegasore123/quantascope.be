# Reports & Dashboard (Phase 6)

## Enhanced reports

`GET /api/calculations/:id/report?format=json|pdf|csv` now includes:

- Version metadata (`version`, `scenarioName`, `parentJobId`)
- Manual corrections (`corrections` array with original → corrected values)
- Version history from `CalculationRevision`
- What-if scenarios (child jobs)
- OCR provenance from validation payload

Report building lives in `src/lib/report-builder.ts`.

## Dashboard API

`GET /api/dashboard` returns extended stats:

| Field | Description |
|-------|-------------|
| `needsReview` | Completed jobs with low-confidence validation |
| `revisedCalculations` | Jobs with `version > 1` |
| `correctedMeasurements` | Measurements flagged `userCorrected` |
| `needsReview` (list) | Up to 5 jobs needing review |
| `recentDocuments` | Latest uploaded files |

## Mobile upload

Frontend route `/upload` — camera-first flow with `capture="environment"`, auto project selection, SSE/poll status. Dashboard shows a floating action button on mobile.
