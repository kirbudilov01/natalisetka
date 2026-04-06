import json
import os
import random
import time

import requests
from sqlalchemy import Column, DateTime, Float, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.sql import func

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/aicontentdb",
)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

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


MOCK_VIDEOS = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
]


def generate_image(prompt: str) -> str:
    """Stub: returns a mock image URL."""
    return f"https://picsum.photos/seed/{hash(prompt) % 1000}/720/1280"


def generate_video(prompt: str) -> str:
    """Stub: returns a mock video URL."""
    return random.choice(MOCK_VIDEOS)


def _actual_cost(video_count: int) -> float:
    return round(BASE_PIPELINE_COST_USD + COST_PER_VIDEO_USD * video_count, 4)


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

        # Simulate pipeline generation delay scaled by workload
        time.sleep(min(20, max(5, 3 + video_count)))

        videos = [generate_video(f"char{character_id}_{fmt}_video{i}") for i in range(video_count)]

        job.status = "done"
        job.actual_video_count = len(videos)
        job.actual_cost_usd = _actual_cost(len(videos))
        job.result = json.dumps(
            {
                "videos": videos,
                "video_count": len(videos),
                "cost_usd": job.actual_cost_usd,
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
