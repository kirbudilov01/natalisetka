import json
import os
import pathlib
import random
import subprocess
import time
import uuid

import requests
import toml
from sqlalchemy import Column, DateTime, Float, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.sql import func

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/aicontentdb",
)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
DATA_ROOT = pathlib.Path(os.getenv("DATA_ROOT", "/data"))
KOHYA_SCRIPT = os.getenv(
    "KOHYA_SCRIPT", "/kohya_ss/sdxl_train_network.py"
)
SDXL_MODEL = os.getenv(
    "SDXL_MODEL", "stabilityai/stable-diffusion-xl-base-1.0"
)

# Economy constants (must match backend)
BASE_PIPELINE_COST_USD = 0.08
COST_PER_VIDEO_USD = 0.35

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True)
    status = Column(String(50), nullable=False, default="pending")
    result = Column(Text, nullable=True)
    chat_id = Column(String(50), nullable=True)
    requested_video_count = Column(Integer, nullable=False, default=2)
    actual_video_count = Column(Integer, nullable=True)
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    actual_cost_usd = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    niche = Column(String(120), nullable=False, default="")
    trigger_word = Column(String(80), nullable=False)
    lora_status = Column(String(20), nullable=False, default="none")
    lora_path = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


MOCK_VIDEOS = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
]


def _actual_cost(video_count: int) -> float:
    return round(BASE_PIPELINE_COST_USD + COST_PER_VIDEO_USD * video_count, 4)


# ---------------------------------------------------------------------------
# Image generation — uses LoRA if available, falls back to mock
# ---------------------------------------------------------------------------

def _generate_image_with_lora(prompt: str, lora_path: str, trigger_word: str) -> str:
    """Generate image using Stable Diffusion XL + LoRA via diffusers."""
    try:
        import torch
        from diffusers import StableDiffusionXLPipeline

        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        pipe = StableDiffusionXLPipeline.from_pretrained(
            SDXL_MODEL,
            torch_dtype=dtype,
            use_safetensors=True,
        )
        if torch.cuda.is_available():
            pipe = pipe.to("cuda")
        pipe.enable_attention_slicing()

        pipe.load_lora_weights(str(pathlib.Path(lora_path).parent), weight_name=pathlib.Path(lora_path).name)
        full_prompt = f"{trigger_word}, {prompt}"

        image = pipe(
            full_prompt,
            num_inference_steps=30,
            guidance_scale=7.5,
        ).images[0]

        output_dir = DATA_ROOT / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4()}.png"
        image.save(str(output_dir / filename))
        return f"/output/{filename}"
    finally:
        # Free VRAM between jobs
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass


def _generate_image_mock(prompt: str) -> str:
    return f"https://picsum.photos/seed/{abs(hash(prompt)) % 1000}/720/1280"


def _generate_video_mock(prompt: str) -> str:
    return random.choice(MOCK_VIDEOS)


# ---------------------------------------------------------------------------
# LoRA training via Kohya_ss
# ---------------------------------------------------------------------------

def _build_kohya_config(character_id: int, trigger_word: str, data_dir: pathlib.Path, output_dir: pathlib.Path) -> dict:
    template_path = pathlib.Path(__file__).parent / "kohya_config_template.toml"
    with open(template_path) as f:
        raw = f.read()

    raw = raw.replace("{data_dir}", str(data_dir))
    raw = raw.replace("{output_dir}", str(output_dir))
    raw = raw.replace("{trigger_word}", trigger_word)
    return toml.loads(raw)


def train_lora(character_id: int) -> None:
    db: Session = SessionLocal()
    try:
        char = db.query(Character).filter(Character.id == character_id).first()
        if not char:
            return

        char.lora_status = "training"
        db.commit()

        data_dir = DATA_ROOT / "characters" / str(character_id)
        output_dir = data_dir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Write per-run config
        config = _build_kohya_config(character_id, char.trigger_word, data_dir, output_dir)
        config_path = data_dir / "training_config.toml"
        with open(config_path, "w") as f:
            toml.dump(config, f)

        # Run Kohya training subprocess
        result = subprocess.run(
            [
                "accelerate", "launch",
                "--mixed_precision=fp16",
                "--num_cpu_threads_per_process=4",
                KOHYA_SCRIPT,
                f"--config_file={config_path}",
            ],
            capture_output=True,
            text=True,
            timeout=7200,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"Kohya training failed (exit {result.returncode}):\n{result.stderr[-2000:]}"
            )

        lora_path = output_dir / "character.safetensors"
        if not lora_path.exists():
            raise FileNotFoundError(f"Expected LoRA file not found: {lora_path}")

        # Re-fetch to avoid stale state after long training
        db.refresh(char)
        char.lora_path = str(lora_path)
        char.lora_status = "ready"
        db.commit()

    except Exception:
        db.rollback()
        try:
            bad = db.query(Character).filter(Character.id == character_id).first()
            if bad:
                bad.lora_status = "error"
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Content generation job
# ---------------------------------------------------------------------------

def process_job(
    job_id: str,
    character_id: int,
    fmt: str,
    video_count: int,
    chat_id: str | None = None,
):
    db: Session = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return

        job.status = "processing"
        db.commit()

        # Check if character has a trained LoRA
        char = db.query(Character).filter(Character.id == character_id).first()
        lora_ready = (
            char is not None
            and char.lora_status == "ready"
            and char.lora_path
            and pathlib.Path(char.lora_path).exists()
        )

        videos: list[str] = []
        for i in range(video_count):
            prompt = f"char{character_id}_{fmt}_frame{i}"
            if lora_ready:
                url = _generate_image_with_lora(prompt, char.lora_path, char.trigger_word)
            else:
                # Fallback: mock until LoRA is trained
                url = _generate_video_mock(prompt)
            videos.append(url)

        job.status = "done"
        job.actual_video_count = len(videos)
        job.actual_cost_usd = _actual_cost(len(videos))
        job.result = json.dumps(
            {
                "videos": videos,
                "video_count": len(videos),
                "cost_usd": job.actual_cost_usd,
                "used_lora": lora_ready,
            }
        )
        db.commit()

        notify_id = chat_id or job.chat_id
        if notify_id and TELEGRAM_BOT_TOKEN:
            _send_telegram_notification(notify_id, videos)

    except Exception:
        db.rollback()
        fallback = db.query(Job).filter(Job.id == job_id).first()
        if fallback:
            fallback.status = "error"
            db.commit()
    finally:
        db.close()



def _send_telegram_notification(chat_id: str, videos: list[str]) -> None:
    base = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
    try:
        requests.post(
            f"{base}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": (
                    f"✅ Готово! Сгенерировано <b>{len(videos)}</b> видео.\n"
                    "Открой приложение для просмотра."
                ),
                "parse_mode": "HTML",
            },
            timeout=10,
        )
        for i, url in enumerate(videos, 1):
            requests.post(
                f"{base}/sendMessage",
                json={"chat_id": chat_id, "text": f"🎬 Видео {i}:\n{url}"},
                timeout=10,
            )
    except Exception:
        pass
