# Единый расчетный центр (ЕПД)

Полноценный проект: публичный поиск ЕПД и админ-панель для загрузки/обработки больших PDF.

## Стек
- Backend: Node.js + Express + Prisma + SQLite
- Frontend: React + Vite + pdf.js viewer
- Хранение: локальные volumes (`storage/uploads`, `storage/receipts`, SQLite DB)
- Оркестрация: Docker Compose

## Быстрый старт
```bash
cp .env.example .env
docker compose up -d --build
```

> Важно: перенос проекта через «вставку patch в блокнот» не является надежным способом доставки кода.
> Корректный способ — `git clone`/`git pull` из репозитория и проверка команд ниже.

Откройте:
- Публичный сайт: `http://localhost:5173`
- API health: `http://localhost:5173/api/health` (через Vite proxy)

## Демо-данные (end-to-end)
```bash
# 1) локально сгенерировать demo PDF
cd backend
npm install
npm run demo:pdf

# 2) выполнить миграцию и загрузить demo в БД
npx prisma db push
npm run seed:admin
npm run seed:demo
```

После этого ищите:
- Лицевой счет: `123456789`
- Адрес: `Пример / Ленина / 10 / 5`

## Переменные окружения
См. `.env.example`:
- `ACCOUNT_REGEX` — regex(ы) для распознавания лицевого счета (через `||`)
- `ADDRESS_REGEX` — regex(ы) для распознавания адреса (через `||`)
- `STICKY_GROUPING=true` — липкая группировка страниц без ЛС к предыдущему комплекту
- `VITE_API_URL=` — оставьте пустым для относительных запросов (`/api/...`) через единый домен
- `CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://85.239.35.245,https://85.239.35.245` — белый список origin для dev+prod (добавьте домен при подключении SSL)

## Как подстроить regex под реальный ЕПД
1. Загрузите реальный файл в админке.
2. Проверьте раздел «Проверка распознавания» и список неопознанных страниц.
3. Скорректируйте `ACCOUNT_REGEX`/`ADDRESS_REGEX` в `.env`.
4. Перезапустите backend: `docker compose restart backend`.
5. Нажмите «Перепроцессить» для нужной загрузки.


## CI / Проверки качества
В репозиторий добавлен GitHub Actions workflow `.github/workflows/ci.yml`, который на каждый push/PR выполняет:
- установку зависимостей backend/frontend,
- синтаксические проверки backend (`node --check`),
- production-сборку frontend (`npm run build`).

### Локальная проверка после клонирования
```bash
# backend
cd backend
npm ci
node --check src/index.js
node --check src/routes/admin.js
node --check src/routes/public.js

# frontend
cd ../frontend
npm ci
npm run build
```

Если все команды завершаются без ошибок, значит локальная копия проекта собрана корректно.

## API
Формат периода для API и админки: `YYYY-MM`.
- `GET /api/health`
- `POST /api/public/search-by-account` (возвращает список совпадений по нескольким загруженным PDF в периоде)
- `POST /api/public/search-by-address` (возвращает список совпадений)
- `GET /api/public/periods` (список доступных расчетных периодов)
- `GET /api/public/receipt/:id/view`
- `GET /api/public/receipt/:id/download`
- `POST /api/admin/auth/login`
- `GET /api/public/ad`
- `GET /api/admin/ads`
- `PUT /api/admin/ads/:id`
- `POST /api/admin/ads/:id/media` (multipart, png/jpg/webp/gif)
- `GET /api/public/contacts`
- `GET /api/public/suppliers`
- `GET /api/admin/contacts`
- `PUT /api/admin/contacts/:id`
- `GET /api/admin/suppliers`
- `POST /api/admin/suppliers`
- `PUT /api/admin/suppliers/:id`
- `DELETE /api/admin/suppliers/:id`
- `POST /api/admin/suppliers/:id/services`
- `PUT /api/admin/services/:id`
- `DELETE /api/admin/services/:id`
- `POST /api/admin/uploads` (multipart + `period`)
- `GET /api/admin/uploads`
- `GET /api/admin/uploads/:id/source`
- `DELETE /api/admin/uploads/:id`
- `DELETE /api/admin/uploads?period=YYYY-MM` (удаление всех загрузок и квитанций за период)
- `POST /api/admin/uploads/:id/reprocess`
- `GET /api/admin/unassigned-pages?uploadId=...`
- `POST /api/admin/unassigned-pages/assign`

## Deploy на Ubuntu (кратко)
1. Установить Docker + Compose plugin.
2. Открыть порты (только входная точка Nginx + SSH):
   ```bash
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```
3. Клонировать репозиторий и заполнить `.env` (`VITE_API_URL=` оставить пустым).
4. Запуск: `docker compose up -d --build`.
5. В `docker-compose.yml` сервисы опубликованы только на loopback:
   - `127.0.0.1:4000:4000` (backend)
   - `127.0.0.1:5173:5173` (frontend)
6. Настроить Nginx reverse-proxy:
   - `/api/*` -> `http://127.0.0.1:4000/api/*`
   - `/` -> `http://127.0.0.1:5173/`

## Админ доступ при первом запуске
Создается автоматически из переменных:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Функции админки
- JWT авторизация
- Загрузка 1+ PDF за период
- Автообработка: распознавание, sticky grouping, сборка персональных PDF
- Список загрузок: статус, статистика, удаление, перепроцессинг, скачать исходник
- Проверка распознавания: неопознанные страницы + ручная привязка диапазона
- Управление рекламой: RU/KZ текст, ссылка, загрузка изображения/гифки, включение/выключение показа
- Поддерживаются разные форматы рекламных изображений (квадратные, прямоугольные, длинные) и несколько креативов с ротацией в публичном блоке. Интервал ротации задается через админку
- Управление контактами и поставщиками услуг через админку (телефон, email, адрес, режим, список поставщиков)
- Каталог поставщиков и услуг: на публичной странице выбирается поставщик из списка и показывается полная информация + услуги


## Улучшения качества
- Нормализация лицевого счета (очистка от лишних символов) для более надежного поиска и сопоставления.
- Добавлено распознавание 2 квитанций на одном листе (верх/низ, A5-на-странице) при обработке исходных PDF.
- Добавлена базовая валидация входных данных для ID/URL/обязательных полей в admin/public API.
- Добавлены защитные сообщения об ошибках загрузки (в том числе ошибок Multer).
- В админке добавлены подтверждения удаления и блокировка кнопок во время операций.
- На странице контактов добавлен быстрый поиск по поставщикам.


## Как создать/изменить админ-учетку
1. В `.env` задайте `ADMIN_EMAIL` и `ADMIN_PASSWORD`.
2. При старте backend автоматически вызовет `ensureAdmin` и создаст запись, если админа с таким email нет.
3. Если нужно сменить пароль существующего админа — обновите `.env` и выполните вручную:
   ```bash
   cd backend
   npm run seed:admin
   ```

По умолчанию (если переменные не заданы): `admin@example.com / Admin12345` — обязательно поменяйте в продакшене.
