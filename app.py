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
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import os

load_dotenv()  # подхватывает переменные из .env рядом с этим файлом

app = Flask(__name__)
CORS(app)

# ===== КОНФИГУРАЦИЯ =====
# Ключ и URL теперь живут в .env (см. .env.example) и НЕ хранятся в
# коде — это важно, потому что этот файл может уйти в открытый
# репозиторий. .env добавлен в .gitignore, поэтому наружу не утечёт.
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = os.environ.get("DEEPSEEK_API_URL", "https://arizona-ai.ru/api/v1/chat/completions")

if not DEEPSEEK_API_KEY:
    print("⚠️  DEEPSEEK_API_KEY не задан — создай файл .env на основе .env.example")


def ask_deepseek(messages, temperature=0.8, max_tokens=500):
    """Низкоуровневый запрос к нейросети."""
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
            return response.json()["choices"][0]["message"]["content"], None
        return None, f"Ошибка API: {response.status_code}"
    except Exception as exc:  # noqa: BLE001
        return None, f"Ошибка соединения с нейросетью: {exc}"


def generate_riddle():
    """Просит нейросеть придумать новую загадку. Ответ (разгадку)
    мы намеренно не отдаём клиенту и нигде не сохраняем — проверка
    ответа пользователя (см. check_riddle_answer) каждый раз заново
    рассуждает над текстом загадки, поэтому хранить эталонный ответ
    не нужно, и его нельзя подсмотреть через консоль браузера."""
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
    messages = [
        {"role": "system", "content": "Ты дружелюбный ассистент в чате. Отвечай кратко и по делу, на русском."},
        {"role": "user", "content": message},
    ]
    text, error = ask_deepseek(messages, temperature=0.7)
    return text if text else f"⚠️ {error}"


# ===== МАРШРУТЫ =====

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/ai/chat", methods=["POST"])
def api_ai_chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Пустое сообщение"}), 400

    reply = chat_with_deepseek(message)
    return jsonify({"response": reply})


@app.route("/api/riddle/generate", methods=["POST"])
def api_riddle_generate():
    riddle_text, _answer, error = generate_riddle()
    if error:
        return jsonify({"error": error}), 502
    return jsonify({"riddle": riddle_text})


@app.route("/api/riddle/check", methods=["POST"])
def api_riddle_check():
    data = request.get_json(silent=True) or {}
    riddle_text = (data.get("riddle") or "").strip()
    user_answer = (data.get("answer") or "").strip()

    if not riddle_text or not user_answer:
        return jsonify({"error": "Недостаточно данных"}), 400

    is_correct, message = check_riddle_answer(riddle_text, user_answer)
    return jsonify({"is_correct": is_correct, "message": message})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
