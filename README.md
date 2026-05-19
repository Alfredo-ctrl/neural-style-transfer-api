# Neural Style Transfer API

A production-ready REST API that applies artistic styles to photographs using a VGG19-based neural style transfer pipeline built with FastAPI and PyTorch.

## Overview

Neural Style Transfer (NST) optimizes a generated image to simultaneously match the content of one photograph and the artistic texture of another. This implementation uses Gram-matrix-based style loss across five VGG19 convolutional layers and minimizes the combined loss using the L-BFGS second-order optimizer.

The project ships with a premium web frontend for interactive use and a fully documented REST API for programmatic integration.

## Architecture

```
neural-style-transfer-api/
├── app/
│   ├── core/
│   │   ├── config.py          # Environment-driven settings
│   │   └── validators.py      # File type and size validation
│   ├── routers/
│   │   ├── style.py           # /style/* endpoints
│   │   └── health.py          # /health endpoint
│   ├── services/
│   │   └── style_transfer.py  # VGG19 NST engine, async job queue
│   └── main.py                # FastAPI application factory
├── frontend/
│   ├── index.html             # Single-page application
│   ├── style.css              # Dark-mode premium UI
│   └── app.js                 # Drag-and-drop + job polling client
├── server.py                  # Development server entrypoint
├── Dockerfile
├── requirements.txt
└── .env.example
```

## Technical Details

### Style Transfer Engine

- Model: VGG19 pre-trained on ImageNet (frozen weights, used as a feature extractor only)
- Content layers: `conv_4`
- Style layers: `conv_1` through `conv_5`
- Loss function: weighted MSE between Gram matrices (style) and feature activations (content)
- Optimizer: L-BFGS with analytic gradient (superior convergence over Adam for this task)
- Device: CUDA if available, CPU fallback

### API Design

The transfer endpoint is non-blocking. It accepts a multipart form submission, enqueues the job as an async background task, and returns a `job_id` immediately with HTTP 202. Clients poll the status endpoint and fetch the result when the job reaches `completed` state.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health, CUDA status |
| POST | `/style/transfer` | Submit a style transfer job |
| GET | `/style/status/{job_id}` | Poll job status |
| GET | `/style/result/{job_id}` | Download stylized PNG |
| GET | `/docs` | Interactive Swagger UI |

## Requirements

- Python 3.11+
- PyTorch 2.3+ (CUDA optional but recommended for speed)

## Setup

```bash
git clone https://github.com/Alfredo-ctrl/neural-style-transfer-api
cd neural-style-transfer-api

python -m venv venv
source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
python server.py
```

Open `http://localhost:8000` in your browser.

## Docker

```bash
docker build -t nst-api .
docker run -p 8000:8000 nst-api
```

## Configuration

All parameters are configurable via environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8000` | Bind port |
| `STYLE_ITERATIONS` | `300` | L-BFGS optimization steps |
| `STYLE_WEIGHT` | `1000000` | Weight of style loss term |
| `CONTENT_WEIGHT` | `1` | Weight of content loss term |
| `MAX_IMAGE_SIZE_MB` | `10` | Maximum upload size |

## Code Standards

- No comments in source code
- No emojis anywhere
- Type annotations throughout
- Senior-level architecture: clean separation of configuration, validation, service, and transport layers

## Author

Alfredo Oliva — [GitHub](https://github.com/Alfredo-ctrl)
