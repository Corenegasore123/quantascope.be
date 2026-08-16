# AI / Vision Pipeline

QuantScope separates **AI interpretation** from **deterministic calculation**.

## Flow

```text
Document upload
    ↓
Background worker
    ↓
Vision service (Python) — OCR + preprocessing + measurement extraction
    ↓
Variable mapping (TypeScript)
    ↓
Deterministic calculation engine (TypeScript)
    ↓
Validation + confidence summary
    ↓
Result stored with provenance
```

## Vision service (`services/cv-service`)

| Stage | Description |
|-------|-------------|
| Preprocess (standard) | Grayscale, contrast, denoise, sharpen |
| Preprocess (aggressive fallback) | Upscale, CLAHE, adaptive threshold |
| OCR | Tesseract with bounding boxes |
| Measurement parse | Regex extraction with confidence filter |
| Geometry | Basic contour detection |

### Fallback logic

If standard OCR yields no measurements or average confidence below `CV_CONFIDENCE_FLAG` (0.80), the service automatically retries with aggressive preprocessing.

### Response metadata

```json
{
  "metadata": {
    "provider": "tesseract",
    "pipeline_version": "1.1.0",
    "preprocessing_ops": ["grayscale", "noise_reduction", "..."],
    "fallback_used": true
  }
}
```

## Backend vision module (`src/modules/vision/`)

- `vision.service.ts` — HTTP client with timeout and retry
- Calls CV service; surfaces provenance to pipeline
- `checkCVServiceHealth()` used in `/api/ready`

## Confidence handling

| Threshold | Env var | Default | Meaning |
|-----------|---------|---------|---------|
| Auto-accept | `CONFIDENCE_AUTO_ACCEPT` | 0.95 | High trust |
| Flag | `CONFIDENCE_FLAG` | 0.80 | Warn user |
| Min OCR | `CV_MIN_MEASUREMENT_CONFIDENCE` | 0.50 | Discard below this |

Results with flagged measurements get `validation.status = "needs_review"`.

## Provider extension

See [computer-vision.md](./computer-vision.md) for adding new OCR providers.

The calculation engine is never modified when swapping vision providers.
