"""
Загадочник — бэкенд.

Раньше Flask хранил пользователей, чаты и сообщения в SQLite и сам
выдавал сессии. Теперь всем этим занимается Firebase (Auth +
Firestore) на стороне клиента, а Flask отвечает только за одно:
безопасно обращается к нейросети, не раскрывая API-ключ в браузере.

Три эндпоинта:
  POST /api/ai/chat        — обычный ответ бота в личном AI-чате
  POST /api/riddle/generate — сгенерировать новую загадку
  POST /api/riddle/check    — проверить ответ пользователя на загадку
  GET /api/config          — получить безопасный конфиг для клиента
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from functools import wraps
import requests
import os
import logging
from datetime import datetime

load_dotenv()

app = Flask(__name__)

# ===== SECURITY: CORS =====
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"],
        "max_age": 3600
    }
})

# ===== SECURITY: Rate Limiting =====
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# ===== SECURITY: Logging =====
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== CONFIGURATION =====
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY") 
DEEPSEEK_API_URL = os.environ.get("DEEPSEEK_API_URL", "https://arizona-ai.ru/api/v1/chat/completions")

# Firebase config для безопасной передачи клиенту (без критичных данных)
FIREBASE_CONFIG = {
    "apiKey": os.environ.get("FIREBASE_API_KEY", ""),
    "authDomain": os.environ.get("FIREBASE_AUTH_DOMAIN", ""),
    "projectId": os.environ.get("FIREBASE_PROJECT_ID", ""),
    "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", ""),
    "messagingSenderId": os.environ.get("FIREBASE_MESSAGING_SENDER_ID", ""),
    "appId": os.environ.get("FIREBASE_APP_ID", ""),
    "measurementId": os.environ.get("FIREBASE_MEASUREMENT_ID", ""),
}

if not DEEPSEEK_API_KEY:
    logger.warning("⚠️  DEEPSEEK_API_KEY не задан — создай файл .env на основе .env.example")

if not FIREBASE_CONFIG.get("apiKey"):
    logger.warning("⚠️  Firebase конфиг неполный — проверь .env файл")


# ===== SECURITY: Input Validation =====
def validate_input(data, max_length=5000):
    """Валидация входных данных — защита от XSS и других атак."""
    if isinstance(data, str):
        if len(data) > max_length:
            return None
        # Базовая защита от XSS
        data = data.replace("<script", "&lt;script")
        data = data.replace("javascript:", "")
        return data
    return data


def validate_message(f):
    """Декоратор для валидации POST-запросов."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        data = request.get_json(silent=True) or {}
        
        # Валидация размера
        if len(str(data)) > 50000:
            return jsonify({"error": "Размер запроса слишком большой"}), 413
        
        # Валидация типов
        for key in ["message", "riddle", "answer"]:
            if key in data:
                data[key] = validate_input(data[key])
                if data[key] is None:
                    return jsonify({"error": "Невалидные входные данные"}), 400
        
        request.validated_data = data
        return f(*args, **kwargs)
    return decorated_function


# ===== SECURITY: HTTPS Headers (при production) =====
@app.after_request
def set_security_headers(response):
    """Добавляет security headers для защиты от распространённых атак."""
    # Защита от Clickjacking
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    
    # Защита от MIME-type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Защита от XSS
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.googletagmanager.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self' https://*.firebaseio.com https://*.firebaseapp.com https://arizona-ai.ru https://www.gstatic.com; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "frame-ancestors 'self';"
    )
    
    # Защита от Referrer leaks
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Feature Policy / Permissions Policy
    response.headers['Permissions-Policy'] = (
        "geolocation=(), "
        "microphone=(), "
        "camera=(), "
        "payment=()"
    )
    
    return response


def ask_deepseek(messages, temperature=0.8, max_tokens=500):
    """Низкоуровневый запрос к нейросети с защитой."""
    try:
        payload = {
            "model": "deepseek-chat",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        }
        response = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload, timeout=20)

        if response.status_code == 200:
            result = response.json()["choices"][0]["message"]["content"]
            # Валидация ответа
            result = validate_input(result)
            return result, None
        return None, f"Ошибка API: {response.status_code}"
    except requests.exceptions.Timeout:
        logger.error("Timeout при обращении к нейросети")
        return None, "Истёк таймаут подключения к нейросети"
    except Exception as exc:
        logger.error(f"Ошибка соединения с нейросетью: {exc}")
        return None, f"Ошибка соединения с нейросетью"


def generate_riddle():
    """Просит нейросеть придумать новую загадку."""
    messages = [
        {"role": "system", "content": "Ты — мастер загадок. Отвечай только на русском."},
        {
            "role": "user",
            "content": (
                "Придумай одну оригинальную короткую загадку на русском языке. "
                "Она должна быть интересной, не слишком сложной и не иметь "
                "неоднозначного ответа. Выведи строго в формате:\n"
                "ЗАГАДКА: [текст загадки]\n"
                "ОТВЕТ: [правильный ответ]"
            ),
        },
    ]
    text, error = ask_deepseek(messages, temperature=0.95)
    if error:
        return None, None, error

    riddle_text, answer = None, None
    for line in text.split("\n"):
        line = line.strip()
        if line.upper().startswith("ЗАГАДКА:"):
            riddle_text = line.split(":", 1)[1].strip()
        elif line.upper().startswith("ОТВЕТ:"):
            answer = line.split(":", 1)[1].strip()

    if not riddle_text:
        return None, None, "Не удалось разобрать загадку, попробуйте ещё раз"
    return riddle_text, answer, None


def check_riddle_answer(riddle_text, user_answer):
    """Просит нейросеть оценить ответ пользователя на конкретную загадку."""
    messages = [
        {"role": "system", "content": "Ты строгий, но справедливый проверяющий загадок. Отвечай только на русском."},
        {
            "role": "user",
            "content": (
                f"Загадка: {riddle_text}\n"
                f"Ответ пользователя: {user_answer}\n\n"
                "Определи, правильный ли это ответ по смыслу (учитывай синонимы, "
                "падежи и разные формулировки одного и того же ответа). "
                "Ответь строго одним словом: ПРАВИЛЬНО или НЕПРАВИЛЬНО."
            ),
        },
    ]
    text, error = ask_deepseek(messages, temperature=0.1, max_tokens=20)
    if error:
        return None, error

    verdict = text.upper()
    if "НЕПРАВИЛЬНО" in verdict:
        return False, "Неправильно, попробуйте ещё раз"
    if "ПРАВИЛЬНО" in verdict:
        return True, "Правильно!"
    return None, "Не удалось однозначно проверить ответ, попробуйте переформулировать"


def chat_with_deepseek(message):
    """Chat с нейросетью."""
    messages = [
        {"role": "system", "content": "Ты дружелюбный ассистент в чате. Отвечай кратко и по делу, на русском."},
        {"role": "user", "content": message},
    ]
    text, error = ask_deepseek(messages, temperature=0.7)
    return text if text else f"⚠️ {error}"


# ===== ROUTES =====

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/config", methods=["GET"])
@limiter.limit("100 per hour")
def api_config():
    """Безопасно передаёт Firebase конфиг клиенту."""
    try:
        logger.info("Firebase config requested from " + get_remote_address())
        
        if not all([FIREBASE_CONFIG.get(k) for k in ["apiKey", "projectId"]]):
            logger.error("Firebase configuration incomplete")
            return jsonify({"error": "Firebase configuration incomplete"}), 500
        
        return jsonify(FIREBASE_CONFIG)
    except Exception as e:
        logger.error(f"Error in api_config: {e}")
        return jsonify({"error": "Server error"}), 500


@app.route("/api/ai/chat", methods=["POST"])
@limiter.limit("20 per hour")
@validate_message
def api_ai_chat():
    """Ответ AI в чате."""
    data = request.validated_data
    message = (data.get("message") or "").strip()
    
    if not message or len(message) < 1:
        return jsonify({"error": "Пустое сообщение"}), 400
    
    if len(message) > 2000:
        return jsonify({"error": "Сообщение слишком длинное"}), 400

    logger.info(f"AI chat request from {get_remote_address()}")
    reply = chat_with_deepseek(message)
    return jsonify({"response": reply})


@app.route("/api/riddle/generate", methods=["POST"])
@limiter.limit("30 per hour")
def api_riddle_generate():
    """Генерация новой загадки."""
    logger.info(f"Riddle generation request from {get_remote_address()}")
    
    riddle_text, _answer, error = generate_riddle()
    if error:
        return jsonify({"error": error}), 502
    return jsonify({"riddle": riddle_text})


@app.route("/api/riddle/check", methods=["POST"])
@limiter.limit("50 per hour")
@validate_message
def api_riddle_check():
    """Проверка ответа на загадку."""
    data = request.validated_data
    riddle_text = (data.get("riddle") or "").strip()
    user_answer = (data.get("answer") or "").strip()

    if not riddle_text or not user_answer:
        return jsonify({"error": "Недостаточно данных"}), 400
    
    if len(riddle_text) > 5000 or len(user_answer) > 5000:
        return jsonify({"error": "Данные слишком большие"}), 413

    logger.info(f"Riddle check request from {get_remote_address()}")
    is_correct, message = check_riddle_answer(riddle_text, user_answer)
    return jsonify({"is_correct": is_correct, "message": message})


# ===== ERROR HANDLERS =====
@app.errorhandler(429)
def ratelimit_handler(e):
    """Обработка превышения лимита запросов."""
    logger.warning(f"Rate limit exceeded from {get_remote_address()}")
    return jsonify({"error": "Слишком много запросов, попробуйте позже"}), 429


@app.errorhandler(400)
def bad_request(e):
    """Обработка некорректных запросов."""
    logger.warning(f"Bad request from {get_remote_address()}: {e}")
    return jsonify({"error": "Некорректный запрос"}), 400


@app.errorhandler(404)
def not_found(e):
    """Обработка несуществующих маршрутов."""
    return jsonify({"error": "Эндпоинт не найден"}), 404


@app.errorhandler(500)
def server_error(e):
    """Обработка внутренних ошибок."""
    logger.error(f"Server error: {e}")
    return jsonify({"error": "Внутренняя ошибка сервера"}), 500


if __name__ == "__main__":
    # ВАЖНО: В production используй gunicorn вместо встроенного сервера
    # gunicorn -w 4 -b 0.0.0.0:5000 app:app
    app.run(debug=False, host="0.0.0.0", port=5000)
