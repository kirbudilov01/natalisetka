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
);

-- Seed default characters.
-- lora_status = 'none'  → LoRA ещё не обучена (обучить через UI или API)
-- lora_status = 'ready' → LoRA готова, укажи lora_path на .safetensors файл
-- Если персонажи уже есть — ничего не меняем (ON CONFLICT DO NOTHING).
INSERT INTO characters (id, name, niche, trigger_word, color, lora_status, lora_path) VALUES
  (1, 'Алиса',  'lifestyle & beauty', 'alisa_lora',   'from-pink-500 to-rose-500',    'none', NULL),
  (2, 'Карина', 'fitness',            'karina_lora',  'from-orange-500 to-amber-500', 'none', NULL),
  (3, 'Вика',   'travel & fashion',   'vika_lora',    'from-violet-500 to-purple-500','none', NULL)
ON CONFLICT (id) DO NOTHING;

-- Чтобы SERIAL не конфликтовал с вручную заданными id:
SELECT setval('characters_id_seq', (SELECT MAX(id) FROM characters));
