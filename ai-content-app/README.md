# AI Content Generator

MVP веб-приложения для AI-генерации видео с Telegram Bot и Telegram Web App.

## Быстрый старт

```bash
# 1. Скопируй .env (если не копировал)
cp .env.example .env

# 2. Добавь в .env реальный Telegram Bot Token и OpenAI API Key

# 3. Запусти
docker-compose up --build
```

Откроется:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Архитектура

```
Frontend (Next.js)       → http://localhost:3000
       ↓
Backend API (FastAPI)    → http://localhost:8000
       ↓
Redis Queue (RQ)         → http://localhost:6379
       ↓
Worker (Python)          → обрабатывает задачи в фоне
       ↓
Telegram Bot API         → отправляет готовые видео
       ↓
PostgreSQL               → http://localhost:5432
```

---

## Сервисы

| Сервис        | Технология             | Порт  |
|---------------|------------------------|-------|
| frontend      | Next.js + Tailwind     | 3000  |
| backend       | FastAPI + SQLAlchemy   | 8000  |
| worker        | Python + RQ            | —     |
| telegram-bot  | python-telegram-bot    | —     |
| postgres      | PostgreSQL 15          | 5432  |
| redis         | Redis 7                | 6379  |

---

## Telegram Web App

Для работы Web App в Telegram, фронтенд **должен быть доступен по HTTPS**.

**Для разработки** используй ngrok:

```bash
ngrok http 3000
# Скопируй HTTPS URL → вставь в .env как WEBAPP_URL
```

Затем в @BotFather → `/mybots` → `Bot Settings` → `Menu Button` → вставь URL.

---

## .env переменные

| Переменная            | Описание                                 |
|-----------------------|------------------------------------------|
| `TELEGRAM_BOT_TOKEN`  | Токен от @BotFather                      |
| `WEBAPP_URL`          | Публичный HTTPS URL фронтенда            |
| `OPENAI_API_KEY`      | API ключ OpenAI (опционально, иначе мок) |
| `ACCESS_VAULT_KEY`    | Ключ для шифрования сохраненных доступов |
| `POSTGRES_USER`       | Пользователь PostgreSQL                  |
| `POSTGRES_PASSWORD`   | Пароль PostgreSQL                        |
| `POSTGRES_DB`         | Имя базы данных                          |
| `NEXT_PUBLIC_API_URL` | URL backend для фронтенда                |

---

## Пользовательский сценарий

1. Пользователь пишет `/start` боту
2. Бот присылает кнопку «Открыть приложение»
3. Открывается Web App — **Dashboard** (статистика)
4. Нажимает «Погнали» → страница персонажей
5. Выбирает персонажа → страница генерации
6. Выбирает формат
7. Выбирает количество видео: `1`, `2`, `5` или вводит свое число
8. Нажимает «Генерировать концепт» → GPT генерирует (или мок)
9. Редактирует концепт (по желанию)
10. Нажимает «Утвердить и запустить»
11. Получает подтверждение «Задача принята» + оценку стоимости
12. **Бот присылает видео когда готово** ✅

---

## Экономика и доступы

- `GET /economy` возвращает сводку затрат и объема генераций
- Для каждой задачи сохраняются: `requested_video_count`, `actual_video_count`, `estimated_cost_usd`, `actual_cost_usd`
- Раздел **Доступы** в Telegram Web App хранит логины/пароли от сервисов
- Пароли в БД хранятся **в зашифрованном виде** (Fernet)

---

## Персонажи

Отредактируй `frontend/src/lib/characters.ts`:

```ts
export const characters: Character[] = [
  {
    id: 1,
    name: 'Настоящее имя',
    niche: 'Ниша',
    instagram: 'https://instagram.com/username',
    avatarUrl: 'URL фото',
    color: 'from-pink-500 to-rose-500',
  },
  // ...
]
```

---

## Подключение OpenAI

1. Получи ключ на https://platform.openai.com
2. Добавь в `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```
3. Перезапусти: `docker-compose restart backend`

Используется модель `gpt-4o-mini` для генерации концептов.

---

## ⚠️ Безопасность

- **Не пушь `.env` в публичный репозиторий** — в нём токены и пароли
- Если токен бота утёк — отзови через @BotFather командой `/revoke`
- В продакшне используй переменные окружения сервера, а не `.env` файл
