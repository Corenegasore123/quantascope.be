import io
import re
from uuid import uuid4

import pytesseract
from PIL import Image

from app.config import settings
from app.preprocessor import ImagePreprocessor
from app.providers.base import BoundingBox, DetectedMeasurement, OCRToken


MEASUREMENT_PATTERN = re.compile(
    r"(?:(?P<label>[A-Za-z])\s*=\s*)?"
    r"(?P<value>\d+(?:\.\d+)?)\s*"
    r"(?P<unit>m|cm|mm|km|ft|in|yd|metre|metres|meter|meters)?",
    re.IGNORECASE,
)

UNIT_NORMALIZE = {
    "m": "m",
    "metre": "m",
    "metres": "m",
    "meter": "m",
    "meters": "m",
    "cm": "cm",
    "mm": "mm",
    "km": "km",
    "ft": "ft",
    "in": "in",
    "yd": "yd",
}


def normalize_unit(raw: str | None) -> str:
    if not raw:
        return "m"
    return UNIT_NORMALIZE.get(raw.lower(), raw.lower())


class TesseractOCRProvider:
    def __init__(self) -> None:
        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    def extract_text(self, image_bytes: bytes, image_id: str) -> list[OCRToken]:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)

        tokens: list[OCRToken] = []
        n = len(data["text"])
        for i in range(n):
            text = (data["text"][i] or "").strip()
            conf = float(data["conf"][i])
            if not text or conf < 0:
                continue
            tokens.append(
                OCRToken(
                    text=text,
                    confidence=conf / 100.0,
                    bounding_box=BoundingBox(
                        x=int(data["left"][i]),
                        y=int(data["top"][i]),
                        width=int(data["width"][i]),
                        height=int(data["height"][i]),
                    ),
                )
            )
        return tokens


def extract_measurements_from_tokens(
    tokens: list[OCRToken],
    image_id: str,
    min_confidence: float | None = None,
) -> list[DetectedMeasurement]:
    """Parse OCR tokens into measurement objects."""
    floor = min_confidence if min_confidence is not None else settings.min_measurement_confidence
    measurements: list[DetectedMeasurement] = []
    full_text = " ".join(t.text for t in tokens)

    for match in MEASUREMENT_PATTERN.finditer(full_text):
        value = float(match.group("value"))
        unit = normalize_unit(match.group("unit"))
        label = match.group("label")
        raw = match.group(0).strip()

        bbox = _find_bbox_for_text(tokens, raw.split()[0])
        confidence = bbox[1] if bbox else 0.75
        if confidence < floor:
            continue

        measurements.append(
            DetectedMeasurement(
                id=f"measurement-{uuid4().hex[:8]}",
                value=value,
                unit=unit,
                raw_text=raw,
                confidence=confidence,
                bounding_box=bbox[0] if bbox else BoundingBox(0, 0, 0, 0),
                label=label,
                source_image_id=image_id,
            )
        )

    return _deduplicate_measurements(measurements)


def _find_bbox_for_text(
    tokens: list[OCRToken], search: str
) -> tuple[BoundingBox, float] | None:
    for token in tokens:
        if search in token.text or token.text in search:
            return token.bounding_box, token.confidence
    return None


def _deduplicate_measurements(
    measurements: list[DetectedMeasurement],
) -> list[DetectedMeasurement]:
    seen: set[tuple[float, str]] = set()
    unique: list[DetectedMeasurement] = []
    for m in measurements:
        key = (m.value, m.unit)
        if key not in seen:
            seen.add(key)
            unique.append(m)
    return unique


class LocalImageProcessingProvider:
    def __init__(self) -> None:
        self._preprocessor = ImagePreprocessor()

    def preprocess(self, image_bytes: bytes) -> tuple[bytes, list[str]]:
        return self._preprocessor.preprocess_standard(image_bytes)

    def preprocess_aggressive(self, image_bytes: bytes) -> tuple[bytes, list[str]]:
        return self._preprocessor.preprocess_aggressive(image_bytes)
