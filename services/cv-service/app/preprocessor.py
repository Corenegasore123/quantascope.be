"""Image preprocessing pipelines for OCR."""

import cv2
import numpy as np


class ImagePreprocessor:
    """Standard and aggressive preprocessing for measurement extraction."""

    def preprocess_standard(self, image_bytes: bytes) -> tuple[bytes, list[str]]:
        ops: list[str] = []
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes, ops

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        ops.append("grayscale")

        mean_brightness = gray.mean()
        if mean_brightness < 100:
            gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=30)
            ops.append("contrast_enhancement")
        elif mean_brightness > 200:
            gray = cv2.convertScaleAbs(gray, alpha=0.8, beta=-20)
            ops.append("brightness_reduction")

        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        ops.append("noise_reduction")

        sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        sharpened = cv2.filter2D(denoised, -1, sharpen_kernel)
        ops.append("sharpening")

        _, encoded = cv2.imencode(".png", sharpened)
        return encoded.tobytes(), ops

    def preprocess_aggressive(self, image_bytes: bytes) -> tuple[bytes, list[str]]:
        """Stronger pipeline for low-quality scans and photos."""
        ops: list[str] = ["aggressive_mode"]
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes, ops

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        ops.append("grayscale")

        # Upscale small images for better OCR
        h, w = gray.shape
        if max(h, w) < 1200:
            scale = 1200 / max(h, w)
            gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            ops.append("upscale")

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        ops.append("clahe")

        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        binary = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        ops.append("adaptive_threshold")

        kernel = np.ones((2, 2), np.uint8)
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        ops.append("morph_close")

        _, encoded = cv2.imencode(".png", cleaned)
        return encoded.tobytes(), ops
