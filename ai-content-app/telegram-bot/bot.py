import logging
import os

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
WEBAPP_URL = os.getenv("WEBAPP_URL", "http://localhost:3000")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # Persistent keyboard button (always visible at bottom of chat)
    reply_keyboard = ReplyKeyboardMarkup(
        [[KeyboardButton("🚀 Открыть Натали", web_app=WebAppInfo(url=WEBAPP_URL))]],
        resize_keyboard=True,
        input_field_placeholder="Нажми кнопку ниже 👇",
    )
    await update.message.reply_text(
        "👋 Привет! Я <b>Натали</b> — твой AI-генератор контента.\n\n"
        "🎬 Создаю видео для твоих персонажей на автопилоте.\n\n"
        "Нажми кнопку ниже, чтобы начать 👇",
        reply_markup=reply_keyboard,
        parse_mode="HTML",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "ℹ️ <b>Как пользоваться:</b>\n\n"
        "1. Нажми /start для открытия Web App\n"
        "2. На главной — статистика твоих генераций\n"
        "3. Нажми «Погнали» → выбери персонажа\n"
        "4. Задай концепт → запусти генерацию\n"
        "5. Бот пришлёт видео когда будет готово ✅",
        parse_mode="HTML",
    )


def main() -> None:
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    logger.info("Bot started, polling...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
