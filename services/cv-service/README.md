# CV Service

Python FastAPI service for image preprocessing, OCR, measurement extraction, and geometry detection.

## Prerequisites

- Python 3.11+ with project virtual environment activated
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) installed on the host

## Run locally

```bash
# From repository root with venv activated
cd services/cv-service
python -m uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

## Configuration

Environment variables (prefix `CV_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `CV_OCR_PROVIDER` | `tesseract` | `tesseract` or `mock` |
| `CV_MAX_UPLOAD_SIZE_MB` | `20` | Max upload size |
| `CV_TESSERACT_CMD` | — | Path to tesseract binary (Windows) |

## Tests

```bash
python -m pytest tests/ -q
```

## Providers

- **Tesseract** — default production OCR provider
- **Mock** — returns empty results; for development only (`CV_OCR_PROVIDER=mock`)

See [docs/computer-vision.md](../../docs/computer-vision.md) for extending providers.
