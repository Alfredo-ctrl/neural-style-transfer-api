import torch
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/", summary="Service health check")
async def health_check():
    return JSONResponse(content={
        "status": "ok",
        "cuda_available": torch.cuda.is_available(),
        "device": "cuda" if torch.cuda.is_available() else "cpu",
    })
