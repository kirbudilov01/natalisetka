import base64
import hashlib
import json
import os
import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import redis as redis_lib
import rq
from cryptography.fernet import Fernet
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import Base, engine, get_db, wait_for_db
from models import Character, Job, ServiceAccess

DATA_ROOT = Path(os.getenv("DATA_ROOT", "/data"))
OUTPUT_DIR = DATA_ROOT / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

try:
    from openai import OpenAI

    _openai_available = True
except ImportError:
    _openai_available = False

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
BALANCE_USD = float(os.getenv("BALANCE_USD", "0.0"))
BALANCE_LABEL = os.getenv("BALANCE_LABEL", "Пополни баланс")

# Economy constants (MVP approximation)
BASE_PIPELINE_COST_USD = 0.08
COST_PER_VIDEO_USD = 0.35


def _get_cipher() -> Fernet:
    raw_key = os.getenv("ACCESS_VAULT_KEY", "")
    if raw_key:
        key_bytes = hashlib.sha256(raw_key.encode("utf-8")).digest()
    else:
        # Dev fallback for MVP local runs. Set ACCESS_VAULT_KEY in production.
        key_bytes = hashlib.sha256(b"dev-only-insecure-vault-key").digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def _estimate_cost(video_count: int) -> float:
    return round(BASE_PIPELINE_COST_USD + COST_PER_VIDEO_USD * video_count, 4)


@asynccontextmanager
async def lifespan(app: FastAPI):
    wait_for_db()
    Base.metadata.create_all(bind=engine)

    # Lightweight migrations for existing DBs without Alembic
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE jobs
                ADD COLUMN IF NOT EXISTS requested_video_count INTEGER NOT NULL DEFAULT 2
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE jobs
                ADD COLUMN IF NOT EXISTS actual_video_count INTEGER
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE jobs
                ADD COLUMN IF NOT EXISTS estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE jobs
                ADD COLUMN IF NOT EXISTS actual_cost_usd DOUBLE PRECISION
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS service_accesses (
                    id VARCHAR(36) PRIMARY KEY,
                    service_name VARCHAR(120) NOT NULL,
                    account_login VARCHAR(255) NOT NULL,
                    password_encrypted TEXT NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS characters (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(120) NOT NULL,
                    niche VARCHAR(120) NOT NULL DEFAULT '',
                    instagram VARCHAR(255) NOT NULL DEFAULT '',
                    avatar_url TEXT NOT NULL DEFAULT '',
                    color VARCHAR(120) NOT NULL DEFAULT 'from-pink-500 to-rose-500',
                    trigger_word VARCHAR(80) NOT NULL,
                    lora_status VARCHAR(20) NOT NULL DEFAULT 'none',
                    lora_path TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )

    yield


app = FastAPI(title="AI Content API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

redis_conn = redis_lib.from_url(REDIS_URL)
task_queue = rq.Queue(connection=redis_conn)

MASTER_PROMPTS = {
    1: (
        "Персонаж — яркая lifestyle & beauty блогер. Снимает Reels про повседневную жизнь, "
        "модные луки и советы по красоте. Стиль: тёплый, женственный, естественный."
    ),
    2: (
        "Персонаж — энергичная фитнес-блогер. Снимает про тренировки, здоровый образ жизни, "
        "мотивацию. Стиль: динамичный, яркий, inspiring."
    ),
    3: (
        "Персонаж — путешественница и fashion-инфлюенсер. Снимает кинематографичные видео "
        "в красивых локациях. Стиль: aesthetic, cinematic, luxurious."
    ),
}

MOCK_POSES = [
    "Стоит вполоборота, смотрит в камеру, лёгкая улыбка",
    "Идёт по улице, взгляд вниз, волосы развеваются",
    "Сидит в кафе с кофе, расслабленная поза",
    "Держит продукт двумя руками, смотрит на него",
    "Full body shot, позирует у стены, одна рука на бедре",
    "Close-up лица, нейтральный фон, прямой взгляд в камеру",
    "Смеётся, голова слегка запрокинута назад",
    "Стоит у окна, свет сбоку, смотрит вдаль",
]


class ConceptRequest(BaseModel):
    character_id: int
    format: str
    video_count: int = Field(default=2, ge=1, le=20)


class VideoRequest(BaseModel):
    character_id: int
    format: str
    prompts: list[dict] = Field(default_factory=list)  # [{scene, pose}]
    concept: str | None = None  # legacy fallback
    video_count: int = Field(default=2, ge=1, le=20)
    chat_id: str | None = None


class ServiceAccessCreate(BaseModel):
    service_name: str = Field(min_length=2, max_length=120)
    account_login: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=1000)
    notes: str | None = Field(default=None, max_length=2000)


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    niche: str = Field(default="", max_length=120)
    instagram: str = Field(default="", max_length=255)
    avatar_url: str = Field(default="", max_length=2048)
    color: str = Field(default="from-pink-500 to-rose-500", max_length=120)
    trigger_word: str = Field(min_length=1, max_length=80)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/balance")
def get_balance():
    return {
        "usd_remaining": BALANCE_USD,
        "label": BALANCE_LABEL,
    }


@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_videos = db.execute(
        text(
            """
            SELECT COALESCE(SUM(COALESCE(actual_video_count, requested_video_count, 0)), 0)
            FROM jobs
            WHERE status = 'done'
            """
        )
    ).scalar() or 0

    total_cost = db.execute(
        text(
            """
            SELECT COALESCE(SUM(COALESCE(actual_cost_usd, estimated_cost_usd, 0)), 0)
            FROM jobs
            """
        )
    ).scalar() or 0

    return {
        "total_videos": int(total_videos),
        "tokens_gpt": 45230,
        "tokens_sd": 120,
        "days_until_payment": 14,
        "total_cost_usd": round(float(total_cost), 2),
    }


@app.get("/economy")
def get_economy(db: Session = Depends(get_db)):
    row = db.execute(
        text(
            """
            SELECT
              COUNT(*) AS total_jobs,
              COALESCE(SUM(CASE WHEN status='done' THEN COALESCE(actual_video_count, requested_video_count, 0) ELSE 0 END), 0) AS done_videos,
              COALESCE(SUM(estimated_cost_usd), 0) AS estimated_total_usd,
              COALESCE(SUM(COALESCE(actual_cost_usd, estimated_cost_usd)), 0) AS spent_total_usd
            FROM jobs
            """
        )
    ).mappings().first()

    return {
        "total_jobs": int(row["total_jobs"]),
        "done_videos": int(row["done_videos"]),
        "estimated_total_usd": round(float(row["estimated_total_usd"]), 2),
        "spent_total_usd": round(float(row["spent_total_usd"]), 2),
        "cost_per_video_usd": COST_PER_VIDEO_USD,
        "base_pipeline_cost_usd": BASE_PIPELINE_COST_USD,
    }


@app.post("/generate-concept")
def generate_concept(req: ConceptRequest):
    import random
    master = MASTER_PROMPTS.get(req.character_id, MASTER_PROMPTS[1])
    prompts: list[dict] = []

    if _openai_available and OPENAI_API_KEY and OPENAI_API_KEY != "sk-replace-me":
        try:
            client = OpenAI(api_key=OPENAI_API_KEY)
            system_msg = (
                f"Ты — AI-режиссёр для Reels/TikTok. Мастер-промт персонажа: {master}"
            )
            user_msg = (
                f"Сгенерируй {req.video_count} уникальных промта для видео. "
                f"Формат ответа — строго JSON-массив объектов: "
                f'[{{"scene": "...", "pose": "..."}}]. '
                f"scene — описание сцены (2-3 предложения), "
                f"pose — конкретная поза/движение персонажа (1 предложение). "
                f"Без markdown, только JSON."
            )
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                max_tokens=600,
                response_format={"type": "json_object"} if False else None,
            )
            import json as _json
            raw = response.choices[0].message.content or ""
            # Strip markdown code blocks if present
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            parsed = _json.loads(raw)
            if isinstance(parsed, list):
                prompts = parsed[:req.video_count]
            elif isinstance(parsed, dict):
                # Some models wrap in {"prompts": [...]}
                for v in parsed.values():
                    if isinstance(v, list):
                        prompts = v[:req.video_count]
                        break
        except Exception:
            pass

    # Fallback: generate mock prompts
    if not prompts:
        poses = random.sample(MOCK_POSES, min(req.video_count, len(MOCK_POSES)))
        while len(poses) < req.video_count:
            poses.append(random.choice(MOCK_POSES))
        for i in range(req.video_count):
            prompts.append({
                "scene": f"{master} Видео {i + 1}: динамичный момент из жизни персонажа.",
                "pose": poses[i],
            })

    return {"prompts": prompts[:req.video_count]}


@app.post("/generate-videos")
def generate_videos(req: VideoRequest, db: Session = Depends(get_db)):
    job_id = str(uuid.uuid4())
    estimate = _estimate_cost(req.video_count)

    job = Job(
        id=job_id,
        status="pending",
        chat_id=req.chat_id,
        requested_video_count=req.video_count,
        estimated_cost_usd=estimate,
    )
    db.add(job)
    db.commit()

    task_queue.enqueue(
        "tasks.process_job",
        job_id,
        req.character_id,
        req.format,
        req.video_count,
        req.chat_id,
        job_timeout=180,
    )

    return {"job_id": job_id, "estimated_cost_usd": estimate}


@app.get("/job/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result = None
    if job.result:
        result = json.loads(job.result)

    return {
        "id": job.id,
        "status": job.status,
        "result": result,
        "requested_video_count": job.requested_video_count,
        "actual_video_count": job.actual_video_count,
        "estimated_cost_usd": job.estimated_cost_usd,
        "actual_cost_usd": job.actual_cost_usd,
        "created_at": job.created_at,
    }


@app.get("/accesses")
def list_accesses(db: Session = Depends(get_db)):
    rows = db.query(ServiceAccess).order_by(ServiceAccess.created_at.desc()).all()
    return [
        {
            "id": row.id,
            "service_name": row.service_name,
            "account_login": row.account_login,
            "password_masked": "*" * 10,
            "notes": row.notes,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@app.post("/accesses")
def create_access(payload: ServiceAccessCreate, db: Session = Depends(get_db)):
    cipher = _get_cipher()
    encrypted = cipher.encrypt(payload.password.encode("utf-8")).decode("utf-8")

    row = ServiceAccess(
        service_name=payload.service_name.strip(),
        account_login=payload.account_login.strip(),
        password_encrypted=encrypted,
        notes=(payload.notes or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {"id": row.id}


@app.get("/accesses/{access_id}/reveal")
def reveal_access(access_id: str, db: Session = Depends(get_db)):
    row = db.query(ServiceAccess).filter(ServiceAccess.id == access_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Access not found")

    cipher = _get_cipher()
    try:
        password = cipher.decrypt(row.password_encrypted.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Cannot decrypt access") from exc

    return {
        "id": row.id,
        "service_name": row.service_name,
        "account_login": row.account_login,
        "password": password,
        "notes": row.notes,
        "created_at": row.created_at,
    }


@app.delete("/accesses/{access_id}")
def delete_access(access_id: str, db: Session = Depends(get_db)):
    row = db.query(ServiceAccess).filter(ServiceAccess.id == access_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Access not found")

    db.delete(row)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Characters
# ---------------------------------------------------------------------------

def _character_to_dict(char: Character) -> dict:
    return {
        "id": char.id,
        "name": char.name,
        "niche": char.niche,
        "instagram": char.instagram,
        "avatar_url": char.avatar_url,
        "color": char.color,
        "trigger_word": char.trigger_word,
        "lora_status": char.lora_status,
        "created_at": char.created_at,
    }


@app.get("/characters")
def list_characters(db: Session = Depends(get_db)):
    chars = db.query(Character).order_by(Character.id).all()
    return [_character_to_dict(c) for c in chars]


@app.post("/characters", status_code=201)
def create_character(payload: CharacterCreate, db: Session = Depends(get_db)):
    char = Character(
        name=payload.name.strip(),
        niche=payload.niche.strip(),
        instagram=payload.instagram.strip(),
        avatar_url=payload.avatar_url.strip(),
        color=payload.color.strip(),
        trigger_word=payload.trigger_word.strip().lower().replace(" ", "_"),
    )
    db.add(char)
    db.commit()
    db.refresh(char)
    return _character_to_dict(char)


@app.get("/characters/{character_id}")
def get_character(character_id: int, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return _character_to_dict(char)


@app.post("/characters/{character_id}/upload-images")
async def upload_training_images(
    character_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    train_dir = (
        DATA_ROOT / "characters" / str(character_id)
        / "train_images" / f"10_{char.trigger_word}"
    )
    train_dir.mkdir(parents=True, exist_ok=True)

    saved: list[str] = []
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    for upload in files:
        ext = Path(upload.filename or "").suffix.lower()
        if ext not in allowed_exts:
            continue
        dest = train_dir / f"{uuid.uuid4()}{ext}"
        with dest.open("wb") as fh:
            shutil.copyfileobj(upload.file, fh)
        saved.append(dest.name)

    return {"saved": len(saved), "files": saved}


@app.post("/characters/{character_id}/train")
def trigger_lora_training(character_id: int, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    train_dir = (
        DATA_ROOT / "characters" / str(character_id)
        / "train_images" / f"10_{char.trigger_word}"
    )
    image_count = len(list(train_dir.glob("*"))) if train_dir.exists() else 0
    if image_count < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 5 training images, got {image_count}",
        )

    if char.lora_status == "training":
        raise HTTPException(status_code=409, detail="Training already in progress")

    char.lora_status = "training"
    db.commit()

    task_queue.enqueue(
        "tasks.train_lora",
        character_id,
        job_timeout=7200,  # 2 hours
    )

    return {"ok": True, "lora_status": "training"}


@app.get("/jobs")
def list_jobs(
    chat_id: str | None = None,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    limit = min(limit, 100)
    q = db.query(Job).order_by(Job.created_at.desc())
    if chat_id:
        q = q.filter(Job.chat_id == chat_id)
    jobs = q.limit(limit).all()

    return [
        {
            "id": job.id,
            "status": job.status,
            "requested_video_count": job.requested_video_count,
            "actual_video_count": job.actual_video_count,
            "estimated_cost_usd": job.estimated_cost_usd,
            "actual_cost_usd": job.actual_cost_usd,
            "result": json.loads(job.result) if job.result else None,
            "created_at": job.created_at,
        }
        for job in jobs
    ]
