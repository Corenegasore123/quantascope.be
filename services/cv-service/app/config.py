from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "QuantScope CV Service"
    app_version: str = "1.1.0"
    pipeline_version: str = "1.1.0"
    host: str = "0.0.0.0"
    port: int = 8000
    ocr_provider: str = "tesseract"  # tesseract | mock
    vision_provider: str = "local"  # local | mock
    max_upload_size_mb: int = 20
    allowed_extensions: str = "jpg,jpeg,png,webp,pdf"
    confidence_auto_accept: float = 0.95
    confidence_flag: float = 0.80
    min_measurement_confidence: float = 0.50
    fallback_preprocessing: bool = True
    tesseract_cmd: str | None = None

    class Config:
        env_file = ".env"
        env_prefix = "CV_"


settings = Settings()
