import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    OUTPUT_DIR: str = os.getenv("OUTPUT_DIR", "outputs")
    MAX_IMAGE_SIZE_MB: int = int(os.getenv("MAX_IMAGE_SIZE_MB", 10))
    STYLE_ITERATIONS: int = int(os.getenv("STYLE_ITERATIONS", 300))
    STYLE_WEIGHT: float = float(os.getenv("STYLE_WEIGHT", 1_000_000))
    CONTENT_WEIGHT: float = float(os.getenv("CONTENT_WEIGHT", 1))
    ALLOWED_EXTENSIONS: set = {"jpg", "jpeg", "png", "webp"}

    def ensure_dirs(self):
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)
        os.makedirs(self.OUTPUT_DIR, exist_ok=True)


settings = Settings()
