from fastapi import HTTPException, UploadFile
from app.core.config import settings


def validate_image(file: UploadFile) -> None:
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: {settings.ALLOWED_EXTENSIONS}",
        )


def validate_file_size(size_bytes: int) -> None:
    limit = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
    if size_bytes > limit:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.MAX_IMAGE_SIZE_MB} MB limit.",
        )
