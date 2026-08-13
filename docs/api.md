# REST API Reference

Base URL: `http://localhost:3000/api`

## Calculations

### POST /calculations

Upload an image and start a calculation job.

**Request:** `multipart/form-data` with field `file`

**Response:** `201`
```json
{ "jobId": "uuid", "status": "UPLOADING" }
```

### GET /calculations

List recent calculation jobs.

### GET /calculations/:id

Get full job details including measurements, variables, steps, and result.

### GET /calculations/:id/result

Get calculation result only.

### GET /calculations/:id/report

Export report. Query params:
- `format=json` (default)
- `format=csv`

## Images

### GET /images/:id

Serve uploaded image (by job ID or image ID).

## Rules

### GET /calculation-rules

Return all registered calculation rules from Chapter 3.

## CV Service (Python)

Base URL: `http://localhost:8000`

### GET /health

Service health check.

### POST /process

Process an image for measurement extraction.

**Request:** `multipart/form-data` with field `file`  
**Query:** `image_id` (optional)

**Response:**
```json
{
  "measurements": [{
    "id": "measurement-abc123",
    "value": 5.0,
    "unit": "m",
    "raw_text": "5 m",
    "confidence": 0.98,
    "bounding_box": { "x": 120, "y": 80, "width": 60, "height": 25 },
    "label": null
  }],
  "warnings": []
}
```

## Job Status Values

`UPLOADING` → `PROCESSING_IMAGE` → `EXTRACTING_MEASUREMENTS` → `INTERPRETING_DIAGRAM` → `VALIDATING` → `CALCULATING` → `COMPLETED` | `FAILED`
