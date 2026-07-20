# Загадочник

Чат с личными и общим каналом, где можно отвечать на сообщения других
пользователей и вызывать AI-загадку командой `!загадка`.

## Архитектура

- **Firebase Auth** — регистрация/вход по email и паролю.
- **Firestore** — все чаты и сообщения в реальном времени (без своей БД).
- **Flask** — только прокси к нейросети (генерация и проверка загадок,
  обычный AI-чат), ключ API остаётся на сервере и не попадает в браузер.

```
project/
├── app.py                  Flask-бэкенд (3 AI-эндпоинта)
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── css/style.css
    └── js/
        ├── firebase-config.js
        └── app.js
```

## 1. Настройка Firebase

Конфиг из твоего проекта `zadaka` уже вставлен в
`static/js/firebase-config.js`. Нужно включить два продукта в консоли
Firebase (console.firebase.google.com → проект **zadaka**):

1. **Authentication → Sign-in method → Email/Password** — включить.
2. **Firestore Database → Создать базу** — режим "production".

### Правила безопасности Firestore

Открой **Firestore → Правила** и вставь:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    match /chats/{chatId} {
      allow read: if request.auth != null &&
        (resource.data.type == 'global' ||
         request.auth.uid in resource.data.participants);
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        (resource.data.type == 'global' ||
         request.auth.uid in resource.data.participants);

      match /messages/{messageId} {
        allow read, create: if request.auth != null;
        allow update: if request.auth != null; // разрешить отметку "решено"
      }
    }
  }
}
```

Это открывает общий чат всем авторизованным, а личные — только его
участникам. Если хочешь строже (например, запретить читать чужие DM
через прямой запрос по id), можно дополнительно проверять
`request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants`
внутри правил для `messages` — оставил проще для скорости запуска.

## 2. API-ключ нейросети

Ключ и URL теперь лежат в файле `.env` (уже создан и заполнен твоим
ключом) и подхватываются через `python-dotenv` — в коде `app.py`
секрета больше нет:

```
DEEPSEEK_API_KEY=8d6033c37f1d957f9c59e28eb13cea3e
DEEPSEEK_API_URL=https://arizona-ai.ru/api/v1/chat/completions
```

`.env` добавлен в `.gitignore`, поэтому при заливке проекта на GitHub
он не попадёт в репозиторий — в него уходит только `.env.example` с
пустым шаблоном. Раз ключ уже был показан в переписке, всё равно
стоит когда-нибудь перевыпустить его в личном кабинете arizona-ai.ru
и просто вписать новый в `.env` — код трогать не придётся.

## 3. Запуск

```bash
pip install -r requirements.txt
python app.py
```

Открой `http://localhost:5000`.

## Как это работает

- **AI-помощник** — личный чат один на один с нейросетью, отвечает на
  каждое сообщение.
- **Общий чат** — видят и пишут все зарегистрированные пользователи.
- **+ Новый** — открыть личный чат с другим пользователем по email.
- **`!загадка`** — в любом чате (общем, личном, с ботом) отправляет
  запрос нейросети и публикует карточку загадки.
- **Ответить** — у любого сообщения при наведении появляется кнопка
  «↩ Ответить»; у карточки загадки — кнопка «Ответить на загадку».
  Если это ответ на нерешённую загадку, текст уходит на проверку в
  `/api/riddle/check`, и в чат приходит вердикт нейросети; при
  правильном ответе карточка помечается решённой.

## Ограничения текущей версии (что можно улучшить дальше)

- Правильный ответ на загадку нигде не хранится — при проверке
  нейросеть каждый раз заново рассуждает над текстом загадки. Это
  защищает от подсматривания ответа через консоль браузера, но если
  нужен режим «сдаться и увидеть ответ» — это отдельный небольшой
  эндпоинт.
- Список сообщений грузится целиком (лимит 300) без пагинации —
  достаточно для чата с друзьями, но не для тысяч сообщений.
- Онлайн/оффлайн статус пользователей не отслеживается.
