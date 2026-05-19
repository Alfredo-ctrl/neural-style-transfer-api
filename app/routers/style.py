import os
import uuid
import aiofiles

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from app.core.config import settings
from app.core.validators import validate_image, validate_file_size
from app.services.style_transfer import launch_style_transfer_job, get_job

router = APIRouter(prefix="/style", tags=["Neural Style Transfer"])


async def _save_upload(file: UploadFile, directory: str) -> str:
    ext = file.filename.rsplit(".", 1)[-1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(directory, filename)
    content = await file.read()
    validate_file_size(len(content))
    async with aiofiles.open(path, "wb") as f:
        await f.write(content)
    return path


@router.post("/transfer", summary="Submit a style transfer job")
async def submit_transfer(
    content_image: UploadFile = File(..., description="Content image to stylize"),
    style_image: UploadFile = File(..., description="Reference style image"),
):
    validate_image(content_image)
    validate_image(style_image)

    settings.ensure_dirs()
    content_path = await _save_upload(content_image, settings.UPLOAD_DIR)
    style_path = await _save_upload(style_image, settings.UPLOAD_DIR)

    job_id = await launch_style_transfer_job(
        content_path=content_path,
        style_path=style_path,
        output_dir=settings.OUTPUT_DIR,
        iterations=settings.STYLE_ITERATIONS,
        style_weight=settings.STYLE_WEIGHT,
        content_weight=settings.CONTENT_WEIGHT,
    )

    return JSONResponse(
        status_code=202,
        content={"job_id": job_id, "status": "queued"},
    )


@router.get("/status/{job_id}", summary="Check job status")
async def job_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {
        "job_id": job_id,
        "status": job["status"],
        "error": job.get("error"),
    }


@router.get("/result/{job_id}", summary="Download stylized image")
async def download_result(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["status"] != "completed":
        raise HTTPException(status_code=409, detail=f"Job is not completed. Current status: {job['status']}")

    output_path = job["output_path"]
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=500, detail="Output file missing.")

    return FileResponse(
        path=output_path,
        media_type="image/png",
        filename=f"stylized_{job_id}.png",
    )
