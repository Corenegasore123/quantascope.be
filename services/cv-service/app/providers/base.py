from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class BoundingBox:
    x: int
    y: int
    width: int
    height: int


@dataclass
class DetectedMeasurement:
    id: str
    value: float
    unit: str
    raw_text: str
    confidence: float
    bounding_box: BoundingBox
    label: str | None = None
    source_image_id: str = ""


@dataclass
class OCRToken:
    text: str
    confidence: float
    bounding_box: BoundingBox


@dataclass
class GeometryShape:
    shape_type: str
    bounding_box: BoundingBox
    confidence: float
    properties: dict = field(default_factory=dict)


@dataclass
class ProcessingResult:
    measurements: list[DetectedMeasurement]
    ocr_tokens: list[OCRToken]
    shapes: list[GeometryShape]
    preprocessed: bool
    warnings: list[str] = field(default_factory=list)


class OCRProvider(ABC):
    @abstractmethod
    def extract_text(self, image_bytes: bytes, image_id: str) -> list[OCRToken]:
        pass


class ImageProcessingProvider(ABC):
    @abstractmethod
    def preprocess(self, image_bytes: bytes) -> tuple[bytes, list[str]]:
        """Return preprocessed image bytes and list of applied operations."""
        pass


class GeometryDetectionProvider(ABC):
    @abstractmethod
    def detect(self, image_bytes: bytes) -> list[GeometryShape]:
        pass


class VisionProvider(ABC):
    """Composite vision provider orchestrating OCR, preprocessing, and geometry."""

    @abstractmethod
    def process(self, image_bytes: bytes, image_id: str, mime_type: str) -> ProcessingResult:
        pass
