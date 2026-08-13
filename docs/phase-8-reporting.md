# Reporting Polish (Phase 8)

## Export templates

`GET /api/calculations/:id/report?format=json|pdf|csv&template=full|summary|audit|client`

| Template | Purpose |
|----------|---------|
| `full` | Complete report (default) |
| `summary` | Filename, result, confidence only |
| `audit` | Full audit trail with OCR provenance, corrections, versions |
| `client` | Client-facing deliverable — no internal IDs |

## Comparison view

`GET /api/calculations/:id/compare?format=json|csv`

Returns baseline result vs what-if scenarios and version history with delta and delta %.

## Batch project export

`GET /api/projects/:id/report?format=csv|pdf|json&template=summary|client`

Exports all completed calculations in a project as a single file.

## Frontend

- **ReportExportMenu** — template + format picker on calculation detail
- **ComparisonView** — side-by-side scenario/version comparison table
- **Batch export** — button on project calculations tab
