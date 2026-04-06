CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(36) PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result TEXT,
    chat_id VARCHAR(50),
    requested_video_count INTEGER NOT NULL DEFAULT 2,
    actual_video_count INTEGER,
    estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
    actual_cost_usd DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_accesses (
    id VARCHAR(36) PRIMARY KEY,
    service_name VARCHAR(120) NOT NULL,
    account_login VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
