import io
import re
from uuid import uuid4

from PIL import Image, ImageDraw

from app.providers.base import (
    BoundingBox,
    DetectedMeasurement,
    GeometryShape,
    OCRToken,
    ProcessingResult,
    VisionProvider,
)
from app.providers.tesseract_provider import (
    LocalImageProcessingProvider,
    TesseractOCRProvider,
    extract_measurements_from_tokens,
)


class MockVisionProvider(VisionProvider):
    """Development mock — returns empty results. NOT used in production path when real provider configured."""

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
        self.image_processor = LocalImageProcessingProvider()

    def process(self, image_bytes: bytes, image_id: str, mime_type: str) -> ProcessingResult:
        warnings: list[str] = []

        if mime_type == "application/pdf":
            warnings.append("PDF converted to first page image for processing")
            image_bytes = self._pdf_first_page(image_bytes)

        processed_bytes, ops = self.image_processor.preprocess(image_bytes)
        tokens = self.ocr.extract_text(processed_bytes, image_id)
        measurements = extract_measurements_from_tokens(tokens, image_id)
        shapes = self._detect_basic_geometry(processed_bytes)

        if not measurements:
            warnings.append("No measurements detected in image")

        return ProcessingResult(
            measurements=measurements,
            ocr_tokens=tokens,
            shapes=shapes,
            preprocessed=len(ops) > 0,
            warnings=warnings,
        )

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
