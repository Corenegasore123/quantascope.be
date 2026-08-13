# Computer Vision Architecture

## Design Principle

CV/AI is used **only** for interpretation. All numeric calculations happen in the deterministic TypeScript engine.

## Provider Interfaces

Located in `services/cv-service/app/providers/base.py`:

| Interface | Responsibility |
|-----------|---------------|
| `OCRProvider` | Text extraction with bounding boxes |
| `ImageProcessingProvider` | Preprocessing pipeline |
| `GeometryDetectionProvider` | Shape/line detection |
| `VisionProvider` | Orchestrates all providers |

## Current Implementations

### Tesseract OCR (Production Default)

- **Config:** `CV_OCR_PROVIDER=tesseract`
- **Requires:** Tesseract binary installed
- **Windows:** Set `CV_TESSERACT_CMD` if not in PATH

### Mock Provider (Development Only)

- **Config:** `CV_OCR_PROVIDER=mock`
- Returns empty results with explicit warning
- Never mixed into production calculation path

## Preprocessing Pipeline

Two modes:

### Standard
1. Grayscale conversion
2. Contrast enhancement (if dark) or brightness reduction (if overexposed)
3. Noise reduction (fastNlMeans)
4. Sharpening

### Aggressive (automatic fallback)
1. Upscale small images
2. CLAHE contrast
3. Adaptive Gaussian threshold
4. Morphological close

Triggered when standard OCR yields no measurements or average confidence < `CV_CONFIDENCE_FLAG`.

## Measurement Extraction

Regex pattern matches:
- `5 m`, `3.5 m`, `20 cm`
- `L = 5m`, `W = 3m`, `H = 2m`

Each match produces:
```json
{
  "value": 5,
  "unit": "m",
  "rawText": "5 m",
  "confidence": 0.98,
  "boundingBox": { "x": 120, "y": 80, "width": 60, "height": 25 }
}
```

## Adding a Production Provider

1. Create `app/providers/google_vision.py`
2. Implement `OCRProvider` interface
3. Register in `factory.py`
4. Add credentials to `.env`:
   ```
   GOOGLE_VISION_API_KEY=...
   CV_OCR_PROVIDER=google_vision
   ```

## Geometry Detection

Basic contour detection identifies rectangles/polygons. Future enhancements:
- Dimension line detection
- Arrow association
- Label-to-geometry spatial mapping

These are architecturally supported via the `GeometryDetectionProvider` interface.
