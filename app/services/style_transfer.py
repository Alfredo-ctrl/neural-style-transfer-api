import uuid
import os
import asyncio
import aiofiles
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import transforms, models
from PIL import Image

from app.core.config import settings


_JOB_STATUS: dict[str, dict] = {}


def get_job(job_id: str) -> Optional[dict]:
    return _JOB_STATUS.get(job_id)


def _load_image(path: str, max_size: int = 512) -> torch.Tensor:
    image = Image.open(path).convert("RGB")
    size = min(max(image.size), max_size)
    transform = transforms.Compose([
        transforms.Resize((size, size)),
        transforms.ToTensor(),
    ])
    return transform(image).unsqueeze(0)


def _tensor_to_image(tensor: torch.Tensor) -> Image.Image:
    tensor = tensor.squeeze(0).clamp(0, 1)
    return transforms.ToPILImage()(tensor)


class _GramMatrix(nn.Module):
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        b, c, h, w = x.size()
        features = x.view(b * c, h * w)
        gram = torch.mm(features, features.t())
        return gram.div(b * c * h * w)


class _ContentLoss(nn.Module):
    def __init__(self, target: torch.Tensor):
        super().__init__()
        self.target = target.detach()
        self.loss = torch.tensor(0.0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        self.loss = nn.functional.mse_loss(x, self.target)
        return x


class _StyleLoss(nn.Module):
    def __init__(self, target_feature: torch.Tensor):
        super().__init__()
        self._gram = _GramMatrix()
        self.target = self._gram(target_feature).detach()
        self.loss = torch.tensor(0.0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        self.loss = nn.functional.mse_loss(self._gram(x), self.target)
        return x


def _build_model_and_losses(
    device: torch.device,
    content_img: torch.Tensor,
    style_img: torch.Tensor,
):
    cnn = models.vgg19(weights=models.VGG19_Weights.IMAGENET1K_V1).features.to(device).eval()

    normalization_mean = torch.tensor([0.485, 0.456, 0.406]).to(device)
    normalization_std = torch.tensor([0.229, 0.224, 0.225]).to(device)

    content_layers = ["conv_4"]
    style_layers = ["conv_1", "conv_2", "conv_3", "conv_4", "conv_5"]

    model = nn.Sequential()
    content_losses: list[_ContentLoss] = []
    style_losses: list[_StyleLoss] = []

    class _Normalize(nn.Module):
        def __init__(self, mean, std):
            super().__init__()
            self.mean = mean.view(-1, 1, 1)
            self.std = std.view(-1, 1, 1)

        def forward(self, img):
            return (img - self.mean) / self.std

    model.add_module("normalize", _Normalize(normalization_mean, normalization_std))

    conv_idx = 0
    pool_idx = 0
    relu_idx = 0

    for layer in cnn.children():
        if isinstance(layer, nn.Conv2d):
            conv_idx += 1
            name = f"conv_{conv_idx}"
        elif isinstance(layer, nn.ReLU):
            relu_idx += 1
            name = f"relu_{relu_idx}"
            layer = nn.ReLU(inplace=False)
        elif isinstance(layer, nn.MaxPool2d):
            pool_idx += 1
            name = f"pool_{pool_idx}"
        elif isinstance(layer, nn.BatchNorm2d):
            name = f"bn_{conv_idx}"
        else:
            name = f"unknown_{conv_idx}"

        model.add_module(name, layer)

        if name in content_layers:
            target = model(content_img).detach()
            cl = _ContentLoss(target)
            model.add_module(f"content_loss_{conv_idx}", cl)
            content_losses.append(cl)

        if name in style_layers:
            target_feature = model(style_img).detach()
            sl = _StyleLoss(target_feature)
            model.add_module(f"style_loss_{conv_idx}", sl)
            style_losses.append(sl)

    last_loss_idx = max(
        max(i for i, m in enumerate(model.children()) if isinstance(m, _ContentLoss)),
        max(i for i, m in enumerate(model.children()) if isinstance(m, _StyleLoss)),
    )

    model = model[:last_loss_idx + 1]
    return model, content_losses, style_losses


def _run_style_transfer(
    device: torch.device,
    content_img: torch.Tensor,
    style_img: torch.Tensor,
    iterations: int,
    style_weight: float,
    content_weight: float,
) -> torch.Tensor:
    content_img = content_img.to(device)
    style_img = style_img.to(device)
    input_img = content_img.clone()

    model, content_losses, style_losses = _build_model_and_losses(device, content_img, style_img)
    optimizer = optim.LBFGS([input_img.requires_grad_(True)])

    run = [0]

    while run[0] <= iterations:
        def closure():
            with torch.no_grad():
                input_img.clamp_(0, 1)

            optimizer.zero_grad()
            model(input_img)

            s_loss = sum(sl.loss for sl in style_losses) * style_weight
            c_loss = sum(cl.loss for cl in content_losses) * content_weight
            loss = s_loss + c_loss
            loss.backward()

            run[0] += 1
            return loss

        optimizer.step(closure)

    with torch.no_grad():
        input_img.clamp_(0, 1)

    return input_img


async def launch_style_transfer_job(
    content_path: str,
    style_path: str,
    output_dir: str,
    iterations: int,
    style_weight: float,
    content_weight: float,
) -> str:
    job_id = str(uuid.uuid4())
    _JOB_STATUS[job_id] = {"status": "queued", "output_path": None, "error": None}

    async def _worker():
        _JOB_STATUS[job_id]["status"] = "processing"
        try:
            loop = asyncio.get_event_loop()
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

            content_img = await loop.run_in_executor(None, _load_image, content_path)
            style_img = await loop.run_in_executor(None, _load_image, style_path)

            output_tensor = await loop.run_in_executor(
                None,
                _run_style_transfer,
                device,
                content_img,
                style_img,
                iterations,
                style_weight,
                content_weight,
            )

            output_image = _tensor_to_image(output_tensor)
            output_filename = f"{job_id}.png"
            output_path = os.path.join(output_dir, output_filename)
            output_image.save(output_path)

            _JOB_STATUS[job_id]["status"] = "completed"
            _JOB_STATUS[job_id]["output_path"] = output_path
        except Exception as exc:
            _JOB_STATUS[job_id]["status"] = "failed"
            _JOB_STATUS[job_id]["error"] = str(exc)

    asyncio.create_task(_worker())
    return job_id
