"""Tests for measurement extraction and unit normalization."""

import re

import pytest

from app.providers.tesseract_provider import (
    MEASUREMENT_PATTERN,
    extract_measurements_from_tokens,
    normalize_unit,
)
from app.providers.base import BoundingBox, OCRToken


class TestUnitNormalization:
    def test_metre_aliases(self):
        assert normalize_unit("metre") == "m"
        assert normalize_unit("meters") == "m"
        assert normalize_unit("M") == "m"

    def test_centimetre(self):
        assert normalize_unit("cm") == "cm"

    def test_default_without_unit(self):
        assert normalize_unit(None) == "m"


class TestMeasurementPattern:
    @pytest.mark.parametrize(
        "text,expected_value,expected_unit",
        [
            ("5 m", 5.0, "m"),
            ("3.5 m", 3.5, "m"),
            ("20 cm", 20.0, "cm"),
            ("L = 5m", 5.0, "m"),
            ("W = 3m", 3.0, "m"),
            ("H = 2.5m", 2.5, "m"),
        ],
    )
    def test_parses_common_formats(self, text, expected_value, expected_unit):
        match = MEASUREMENT_PATTERN.search(text)
        assert match is not None
        assert float(match.group("value")) == expected_value
        assert normalize_unit(match.group("unit")) == expected_unit


class TestExtractMeasurementsFromTokens:
    def test_extracts_multiple_measurements(self):
        tokens = [
            OCRToken("6.00", 0.95, BoundingBox(10, 10, 40, 20)),
            OCRToken("m", 0.90, BoundingBox(50, 10, 15, 20)),
            OCRToken("5.00", 0.93, BoundingBox(10, 40, 40, 20)),
            OCRToken("m", 0.88, BoundingBox(50, 40, 15, 20)),
            OCRToken("0.70", 0.91, BoundingBox(10, 70, 40, 20)),
            OCRToken("m", 0.87, BoundingBox(50, 70, 15, 20)),
        ]
        measurements = extract_measurements_from_tokens(tokens, "test-image")
        values = sorted(m.value for m in measurements)
        assert 5.0 in values
        assert 6.0 in values
        assert 0.7 in values

    def test_filters_low_confidence_measurements(self):
        tokens = [
            OCRToken("5", 0.95, BoundingBox(0, 0, 10, 10)),
            OCRToken("m", 0.90, BoundingBox(10, 0, 10, 10)),
            OCRToken("3", 0.40, BoundingBox(20, 0, 10, 10)),
            OCRToken("m", 0.35, BoundingBox(30, 0, 10, 10)),
        ]
        measurements = extract_measurements_from_tokens(tokens, "test-image", min_confidence=0.5)
        assert len(measurements) == 1
        assert measurements[0].value == 5.0

    def test_deduplicates_identical_values(self):
        tokens = [
            OCRToken("5", 0.95, BoundingBox(0, 0, 10, 10)),
            OCRToken("m", 0.90, BoundingBox(10, 0, 10, 10)),
            OCRToken("5", 0.85, BoundingBox(20, 0, 10, 10)),
            OCRToken("m", 0.80, BoundingBox(30, 0, 10, 10)),
        ]
        measurements = extract_measurements_from_tokens(tokens, "test-image")
        assert len(measurements) == 1
