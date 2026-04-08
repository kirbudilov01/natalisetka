import uuid

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(String(50), nullable=False, default="pending")
    result = Column(Text, nullable=True)
    chat_id = Column(String(50), nullable=True)
    requested_video_count = Column(Integer, nullable=False, default=2)
    actual_video_count = Column(Integer, nullable=True)
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    actual_cost_usd = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ServiceAccess(Base):
    __tablename__ = "service_accesses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    service_name = Column(String(120), nullable=False)
    account_login = Column(String(255), nullable=False)
    password_encrypted = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    niche = Column(String(120), nullable=False, default="")
    instagram = Column(String(255), nullable=False, default="")
    avatar_url = Column(Text, nullable=False, default="")
    color = Column(String(120), nullable=False, default="from-pink-500 to-rose-500")
    trigger_word = Column(String(80), nullable=False)
    # lora_status: none | training | ready | error
    lora_status = Column(String(20), nullable=False, default="none")
    lora_path = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
