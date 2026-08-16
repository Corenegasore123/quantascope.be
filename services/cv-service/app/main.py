from dataclasses import asdict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.providers.factory import get_vision_provider
from app.providers.tesseract_provider import TesseractOCRProvider

app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vision = get_vision_provider(settings.ocr_provider)


class HealthResponse(BaseModel):
    status: str
    version: str
    pipeline_version: str
    ocr_provider: str
    tesseract_available: bool


class ProcessResponse(BaseModel):
    measurements: list[dict]
    ocr_tokens: list[dict]
    shapes: list[dict]
    preprocessed: bool
    warnings: list[str]
    metadata: dict


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    tesseract_ok = False
    if settings.ocr_provider != "mock":
        try:
            TesseractOCRProvider()
            tesseract_ok = True
        except Exception:
            tesseract_ok = False

    return HealthResponse(
        status="ok" if tesseract_ok or settings.ocr_provider == "mock" else "degraded",
        version=settings.app_version,
        pipeline_version=settings.pipeline_version,
        ocr_provider=settings.ocr_provider,
        tesseract_available=tesseract_ok,
    )


@app.post("/process", response_model=ProcessResponse)
async def process_image(
    file: UploadFile = File(...),
    image_id: str = "upload",
) -> ProcessResponse:
    if not file.content_type or not _is_allowed(file.content_type, file.filename):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Unable to read image")

    result = vision.process(content, image_id, file.content_type or "image/png")

    metadata = {
        **result.metadata,
        "pipeline_version": settings.pipeline_version,
        "ocr_provider": settings.ocr_provider,
    }

    return ProcessResponse(
        measurements=[asdict(m) for m in result.measurements],
        ocr_tokens=[asdict(t) for t in result.ocr_tokens],
        shapes=[asdict(s) for s in result.shapes],
        preprocessed=result.preprocessed,
        warnings=result.warnings,
        metadata=metadata,
    )


def _is_allowed(content_type: str, filename: str | None) -> bool:
    allowed = set(settings.allowed_extensions.split(","))
    ext = (filename or "").rsplit(".", 1)[-1].lower() if filename else ""
    type_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
    }
    mapped = type_map.get(content_type, ext)
    return mapped in allowed or ext in allowed
