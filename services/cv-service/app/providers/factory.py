from app.config import settings
from app.preprocessor import ImagePreprocessor
from app.providers.base import (
    BoundingBox,
    DetectedMeasurement,
    GeometryShape,
    OCRToken,
    ProcessingResult,
    VisionProvider,
)
from app.providers.tesseract_provider import (
    TesseractOCRProvider,
    extract_measurements_from_tokens,
)


class MockVisionProvider(VisionProvider):
    """Development mock — returns empty results."""

    def process(self, image_bytes: bytes, image_id: str, mime_type: str) -> ProcessingResult:
        return ProcessingResult(
            measurements=[],
            ocr_tokens=[],
            shapes=[],
            preprocessed=False,
            warnings=["Mock provider active — configure CV_OCR_PROVIDER=tesseract for real OCR"],
        )


class LocalVisionProvider(VisionProvider):
    def __init__(self) -> None:
        self.ocr = TesseractOCRProvider()
        self.preprocessor = ImagePreprocessor()

    def process(self, image_bytes: bytes, image_id: str, mime_type: str) -> ProcessingResult:
        warnings: list[str] = []

        if mime_type == "application/pdf":
            warnings.append("PDF converted to first page image for processing")
            image_bytes = self._pdf_first_page(image_bytes)

        # Pass 1 — standard preprocessing
        processed_bytes, ops = self.preprocessor.preprocess_standard(image_bytes)
        tokens = self.ocr.extract_text(processed_bytes, image_id)
        measurements = extract_measurements_from_tokens(tokens, image_id)
        fallback_used = False

        # Pass 2 — aggressive preprocessing if needed
        if settings.fallback_preprocessing and self._needs_fallback(measurements):
            warnings.append("Standard OCR yielded poor results — retrying with aggressive preprocessing")
            aggressive_bytes, aggressive_ops = self.preprocessor.preprocess_aggressive(image_bytes)
            fallback_tokens = self.ocr.extract_text(aggressive_bytes, image_id)
            fallback_measurements = extract_measurements_from_tokens(fallback_tokens, image_id)

            if self._is_better(fallback_measurements, measurements):
                measurements = fallback_measurements
                tokens = fallback_tokens
                ops = ops + aggressive_ops
                fallback_used = True
            elif not measurements and fallback_measurements:
                measurements = fallback_measurements
                tokens = fallback_tokens
                ops = ops + aggressive_ops
                fallback_used = True

        shapes = self._detect_basic_geometry(processed_bytes)

        if not measurements:
            warnings.append("No measurements detected in image")
        else:
            low_conf = [m for m in measurements if m.confidence < settings.confidence_flag]
            if low_conf:
                warnings.append(
                    f"{len(low_conf)} measurement(s) below confidence threshold — manual verification recommended"
                )

        return ProcessingResult(
            measurements=measurements,
            ocr_tokens=tokens,
            shapes=shapes,
            preprocessed=len(ops) > 0,
            warnings=warnings,
            metadata={
                "provider": settings.ocr_provider,
                "pipeline_version": settings.pipeline_version,
                "preprocessing_ops": ops,
                "fallback_used": fallback_used,
            },
        )

    def _needs_fallback(self, measurements: list[DetectedMeasurement]) -> bool:
        if not measurements:
            return True
        avg = sum(m.confidence for m in measurements) / len(measurements)
        return avg < settings.confidence_flag

    def _is_better(
        self,
        candidate: list[DetectedMeasurement],
        current: list[DetectedMeasurement],
    ) -> bool:
        if len(candidate) > len(current):
            return True
        if not candidate:
            return False
        if not current:
            return True
        avg_candidate = sum(m.confidence for m in candidate) / len(candidate)
        avg_current = sum(m.confidence for m in current) / len(current)
        return avg_candidate > avg_current

    def _pdf_first_page(self, pdf_bytes: bytes) -> bytes:
        import fitz

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        return pix.tobytes("png")

    def _detect_basic_geometry(self, image_bytes: bytes) -> list[GeometryShape]:
        import cv2
        import numpy as np

        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return []

        edges = cv2.Canny(img, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        shapes: list[GeometryShape] = []

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 1000:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
            shape_type = "rectangle" if len(approx) == 4 else "polygon"
            shapes.append(
                GeometryShape(
                    shape_type=shape_type,
                    bounding_box=BoundingBox(x=x, y=y, width=w, height=h),
                    confidence=min(0.9, area / (img.shape[0] * img.shape[1])),
                )
            )
        return shapes[:10]


def get_vision_provider(provider_name: str) -> VisionProvider:
    if provider_name == "mock":
        return MockVisionProvider()
    return LocalVisionProvider()
