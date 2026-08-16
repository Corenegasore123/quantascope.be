"""Tests for FastAPI endpoints."""

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def _make_diagram_image() -> bytes:
    img = Image.new("RGB", (400, 300), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 350, 200], outline="black", width=2)
    draw.text((150, 20), "6.00 m", fill="black")
    draw.text((10, 120), "5.00 m", fill="black")
    draw.text((200, 220), "0.70 m", fill="black")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "ocr_provider" in data


def test_rejects_empty_upload(client):
    response = client.post(
        "/process",
        files={"file": ("empty.png", b"", "image/png")},
    )
    assert response.status_code == 400


def test_rejects_unsupported_type(client):
    response = client.post(
        "/process",
        files={"file": ("test.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400


def test_processes_diagram_image(client):
    image_bytes = _make_diagram_image()
    response = client.post(
        "/process?image_id=test-001",
        files={"file": ("diagram.png", image_bytes, "image/png")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "measurements" in data
    assert "warnings" in data
    assert isinstance(data["measurements"], list)
