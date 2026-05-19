from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import style, health

app = FastAPI(
    title="Neural Style Transfer API",
    description="Apply artistic styles to images using a VGG19-based neural style transfer pipeline.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(style.router)

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
