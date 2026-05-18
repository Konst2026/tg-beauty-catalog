# Architecture.md — TG Beauty Marketplace

> Версия: 1.0 | Дата: 2026-05-18  
> Продукт: Telegram Mini App — маркетплейс бьюти-мастеров  
> Код пишется ИИ → архитектура проектировалась под AI-разработку

---

## Оглавление

1. [Исследование: реальные платформы](#1-исследование-реальные-платформы)
2. [Анализ сильных и слабых сторон](#2-анализ-сильных-и-слабых-сторон)
3. [Ответы на 5 вопросов проектирования](#3-ответы-на-5-вопросов-проектирования)
4. [Финальная архитектура проекта](#4-финальная-архитектура-проекта)
5. [Схема базы данных](#5-схема-базы-данных)
6. [Backend: структура и слои](#6-backend-структура-и-слои)
7. [Frontend: структура и слои](#7-frontend-структура-и-слои)
8. [Движок бронирований](#8-движок-бронирований)
9. [Система уведомлений](#9-система-уведомлений)
10. [Tech Stack](#10-tech-stack)
11. [Структура папок](#11-структура-папок)
12. [Правила для AI-разработки (CLAUDE.md шаблон)](#12-правила-для-ai-разработки)

---

## 1. Исследование: реальные платформы

Проанализировано 7 платформ: 4 реальных маркетплейса + 3 паттерна из схожих ниш.

---

### 1.1 Fresha (fresha.com) — бьюти-маркетплейс, 120+ стран

**Stack:** Elixir/Phoenix (основной backend), Ruby on Rails (legacy), React (frontend), PostgreSQL (200+ баз), RabbitMQ, Redis, Kafka, AWS EKS.

**Архитектурный путь:**  
Начинали с Rails-монолита → мигрировали на Elixir-микросервисы. Сейчас: "модульный монолит" + отдельные сервисы. 200+ PostgreSQL-баз — по одной на сервис.

**Мультитенантность:** Shared schema с `business_id` в монолитную эпоху. После миграции — database-per-service.

**API:** REST / JSON:API (OpenAPI 3.0 spec-first, code generation).

**Роли:** Клиент → Сотрудник → Рецепционист → Управление → Владелец бизнеса → Платформ Админ.

**Двойные бронирования:** PostgreSQL ACID + pessimistic locking (SELECT FOR UPDATE). PgBouncer для connection pooling.

---

### 1.2 Booksy (booksy.com) — 10 млн записей/мес

**Stack:** Python/Django (backend), React (frontend), PostgreSQL, event-driven microservices, AWS, Stripe.

**Мультитенантность:** Shared schema с `business_id` (стандартный Django SaaS паттерн).

**API:** REST. Event-driven architecture для async событий.

**Роли:** Клиент → Специалист → Владелец бизнеса → Платформ Админ.

**Особенность:** ML (scikit-learn) для рекомендаций и матчинга мастеров.

---

### 1.3 Vagaro (vagaro.com) — 63 000+ бизнесов, оценка $1B

**Stack:** ASP.NET + PHP (backend), Bootstrap/JS (frontend), Amazon RDS + DynamoDB, Elasticsearch, **Apache Ignite** (in-memory grid), CloudFront, Redis.

**Мультитенантность:** Shared schema с `business_id` (классика ASP.NET SaaS).

**Движок слотов:** Apache Ignite для real-time кэша доступности + RDS для записи с ACID.

**Особенность:** Вертикально-интегрированные платежи — встроили свою платёжную инфраструктуру.

---

### 1.4 StyleSeat (styleseat.com) — независимые мастера

**Stack:** Python/Django, React (миграция с AngularJS), RDS + DynamoDB, Elasticsearch, Stripe Connect, AWS Lambda.

**Мультитенантность:** Shared schema с `stylist_id`/`provider_id`.

**API:** REST, модульный монолит.

**Особенность:** Stripe Connect для выплат мастерам — каждый мастер как отдельный merchant.

---

### 1.5 Cal.com (open-source, GitHub)

**Stack:** TypeScript/Next.js, PostgreSQL (Prisma), tRPC.

**Модель доступности:** Двухуровневая:
- `Schedule` → `Availability[]` — недельный шаблон (days: Int[], start/end_time)
- `date` поле в записи = date override (отпуск, праздник)

**Движок слотов:** Вычисляются on-demand из расписания минус уже занятые бронирования. Сетка 15 минут.

**Бронирования:** `uid` (UUID) как публичный идентификатор. `end_time` хранится явно.

---

### 1.6 MedSync TMA (open-source, GitHub: Latand/MedSyncWebApp)

**Stack:** React + SCSS (frontend), FastAPI + aiogram + SQLAlchemy (backend).

**Структура:** `frontend/` + `backend/` + `docker-compose.yml`. Telegram бот + WebApp.

**Вывод:** Лучший open-source пример booking TMA. Подтверждает паттерн FastAPI + aiogram для Python-стека.

---

### 1.7 Salon Booking Bot (open-source, GitHub: nazgool97)

**Stack:** Node.js/TypeScript, PostgreSQL, Grammy (Telegram bot).

**Архитектура:** Роли Client/Master/Admin, dual interface (Mini App + chat buttons), PostgreSQL Advisory Locks для конкурентности.

**Вывод:** Подтверждает трёхшаговый flow: услуга → мастер → дата/время.

---

## 2. Анализ сильных и слабых сторон

| Платформа | Сильная сторона | Слабая сторона | Урок для нас |
|---|---|---|---|
| **Fresha** | OpenAPI spec-first, модульный монолит | Elixir — редкая экспертиза, сложно для ИИ | Взять spec-first подход; использовать TypeScript |
| **Booksy** | Event-driven, ML-матчинг | Нет публичной документации архитектуры | Взять event-driven для уведомлений (BullMQ) |
| **Vagaro** | Apache Ignite для real-time слотов | ASP.NET — legacy-стек, дорого | Взять идею кэша доступности → Redis |
| **StyleSeat** | Stripe Connect для выплат мастерам | AngularJS → React миграция (технический долг) | Сразу React + TS, не откладывать |
| **Cal.com** | Двухуровневая модель доступности, open-source | Next.js — избыточен для TMA | Взять схему availability целиком |
| **MedSync TMA** | FastAPI + aiogram — проверенная связка для TMA | JavaScript, нет TypeScript | Взять структуру проекта, добавить TypeScript |
| **Salon Bot** | Три роли, dual interface | Нет портфолио, нет отзывов | Взять роли и структуру БД, добавить недостающее |

**Ключевые паттерны, подтверждённые всеми платформами:**
1. Все начинали с shared schema + tenant_id → не изобретать сложность с нуля
2. PostgreSQL EXCLUSION constraint — стандарт двойного бронирования
3. Слоты генерируются on-demand, не хранятся заранее
4. Роли: Client / Provider / Admin — у всех одинаково
5. UUID как публичные идентификаторы (не integer id)

---

## 3. Ответы на 5 вопросов проектирования

### Вопрос 1: Какие сущности есть в системе?

```
User        — базовая запись (telegram_id, name, role)
Master      — профиль мастера (расширяет User)
Client      — профиль клиента (расширяет User)
Service     — услуга мастера (название, цена, длительность)
Category    — категория услуг (ногти, ресницы, брови, волосы)
Schedule    — шаблон расписания мастера
Availability — строки недельного расписания (day_of_week, start, end)
Override    — переопределение конкретной даты (выходной, другие часы)
Booking     — запись клиента к мастеру
Review      — отзыв клиента после визита
Gallery     — фото работ мастера
Notification — лог отправленных уведомлений
```

### Вопрос 2: Какие между ними связи?

```
User (role=master) ──1:1──> Master
User (role=client) ──1:1──> Client

Master ──1:N──> Service
Master ──1:N──> Schedule ──1:N──> Availability
                          └──1:N──> Override
Master ──1:N──> Gallery
Master ──1:N──> Booking <──N:1── Client
Service ──1:N──> Booking
Booking ──1:1──> Review
Category ──1:N──> Service
Booking ──1:N──> Notification (лог)
```

### Вопрос 3: Где границы модулей?

**Backend модули (вертикальные срезы):**

| Модуль | Ответственность | Файлы |
|---|---|---|
| `auth` | Telegram initData верификация, JWT, роли | auth.handler, auth.schema, auth.service |
| `masters` | CRUD профилей мастеров, поиск, фильтры | masters.handler, masters.service, masters.repo |
| `services` | CRUD услуг мастера | services.handler, services.service, services.repo |
| `catalog` | Публичный каталог (мастера + услуги для клиентов) | catalog.handler, catalog.service |
| `schedules` | Управление расписанием, вычисление слотов | schedules.handler, schedules.service, slots.calculator |
| `bookings` | Создание/отмена/перенос записей | bookings.handler, bookings.service, bookings.repo |
| `reviews` | Создание и чтение отзывов | reviews.handler, reviews.service, reviews.repo |
| `notifications` | Очередь и отправка уведомлений через бота | notification.worker, notification.queue |
| `gallery` | Загрузка и хранение фото работ | gallery.handler, gallery.service |

**Frontend модули (Feature-Sliced Design):**

| Слой | Что входит |
|---|---|
| `app/` | Провайдеры, роутер, инициализация Telegram SDK |
| `pages/` | Экраны: CatalogPage, ServicePage, BookingPage, MasterDashboard... |
| `features/` | Действия: create-booking, cancel-booking, filter-catalog, master-schedule |
| `entities/` | Типы + API: master, service, booking, review |
| `shared/` | API client, telegram.ts wrapper, UI примитивы |

### Вопрос 4: Где будет изменчивость?

| Область | Тип изменений | Как изолировано |
|---|---|---|
| **Цены и услуги** | Мастер меняет в любое время | `services` модуль, `price_snapshot` в booking |
| **Расписание** | Мастер меняет часто | `schedules` + `overrides`, не затрагивают bookings |
| **Статусы записи** | Расширяются (например, RESCHEDULED) | PostgreSQL enum, status machine в `bookings.service` |
| **Telegram API** | Обновления TG WebApp SDK | Обёрнут в `shared/lib/telegram.ts`, меняем в одном месте |
| **Провайдер оплаты** | Смена ЮKassa → Stripe | Изолирован в `shared/lib/payment.ts` |
| **Тип уведомлений** | Новые триггеры (отзыв, лояльность) | Новый job type в `notification.worker`, без изменений остальных |
| **UI-компоненты** | Редизайн | `shared/ui/`, не затрагивают бизнес-логику |

### Вопрос 5: Где возможен рост нагрузки?

| Точка роста | Текущее решение | Путь масштабирования |
|---|---|---|
| **Запросы доступных слотов** | Вычисление on-demand из БД | Redis-кэш по `master_id + date` (TTL 60 сек) |
| **Booking flood** (все записываются к популярному мастеру) | SELECT FOR UPDATE + EXCLUDE constraint | Очередь через BullMQ — сериализовать writes |
| **Изображения галереи** | Загрузка на Object Storage (S3/R2) | CDN CloudFront, не нагружает бэкенд |
| **Bot уведомления** | BullMQ worker, concurrency=5 | Несколько workers, rate limiting по Telegram 30/сек |
| **Поиск мастеров** | PostgreSQL + trigram index | Meilisearch или Elasticsearch при 10k+ мастеров |

---

## 4. Финальная архитектура проекта

### Применение 5 признаков AI-архитектуры

**1. Простые модули — один модуль = одна ответственность**
- Каждый файл backend: один handler, одна функция бизнес-логики
- Каждый файл frontend: один компонент или один хук
- Правило: файл > 150 строк → сигнал разбить

**2. Предсказуемая структура — стабильные patterns**
- Именование: `[entity].[type].ts` → `bookings.handler.ts`, `bookings.service.ts`, `bookings.repo.ts`
- Все API routes в `/src/features/[name]/[name].route.ts`
- Все запросы к БД в `/src/entities/[name]/[name].repo.ts`
- AI знает где искать без поиска по всему проекту

**3. Минимальные зависимости — меньше связей**
- Frontend layers не импортируют вниз по иерархии FSD
- Backend features не импортируют друг друга напрямую
- Shared модули — только через `@/shared/...` алиас
- Telegram API — только через `shared/lib/telegram.ts`

**4. Изоляция изменений**
- Изменение расписания мастера → затрагивает только `schedules` модуль
- Изменение типа уведомления → затрагивает только `notification.worker`
- Изменение компонента карточки → затрагивает только `entities/service/ui/ServiceCard.tsx`

**5. Явные границы — никакой магии**
- Нет auto-discovery роутов (все роуты регистрируются явно в `app.ts`)
- Нет рефлексии и декораторов с side-effects
- Зависимости передаются явно через параметры функций
- `initData` верифицируется явно в `auth.middleware.ts` — не скрытый плагин

---

### Общая схема системы

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram                                  │
│   ┌──────────────┐         ┌──────────────────────────┐    │
│   │  TG Bot       │         │   TG Mini App (WebApp)   │    │
│   │  (grammy)     │         │   React + TypeScript      │    │
│   └──────┬───────┘         └────────────┬─────────────┘    │
└──────────┼──────────────────────────────┼──────────────────┘
           │ Bot API                      │ HTTPS REST API
           ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js / TypeScript)            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Fastify HTTP Server                                  │   │
│  │  features/: auth | catalog | masters | services |    │   │
│  │             bookings | schedules | reviews | gallery  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────┐  ┌────▼──────────────┐  ┌───────────┐  │
│  │  BullMQ       │  │   PostgreSQL       │  │  Redis    │  │
│  │  (уведомления)│  │   (основные данные)│  │  (кэш/    │  │
│  │  Worker       │  │   + EXCLUDE GIST   │  │   queue)  │  │
│  └───────────────┘  └───────────────────┘  └───────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Object Storage (S3/R2) — фото галереи мастеров      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Схема базы данных

### Полная DDL

```sql
-- ============================================================
-- РАСШИРЕНИЯ
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- для EXCLUDE GIST

-- ============================================================
-- ПОЛЬЗОВАТЕЛИ (единая таблица, роль через поле)
-- ============================================================
CREATE TYPE user_role AS ENUM ('client', 'master', 'admin');

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id  BIGINT UNIQUE NOT NULL,
  username     VARCHAR(100),
  full_name    VARCHAR(200) NOT NULL,
  phone        VARCHAR(30),
  role         user_role NOT NULL DEFAULT 'client',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ПРОФИЛИ МАСТЕРОВ
-- ============================================================
CREATE TABLE masters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio          TEXT,
  salon_name   VARCHAR(200),
  city         VARCHAR(100),
  address      TEXT,
  timezone     VARCHAR(50) NOT NULL DEFAULT 'Europe/Moscow',
  rating       NUMERIC(3,2) DEFAULT 0.00,   -- денормализованный, пересчитывается
  review_count INTEGER DEFAULT 0,            -- денормализованный
  is_verified  BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,  -- виден в каталоге
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
CREATE INDEX idx_masters_city ON masters(city);
CREATE INDEX idx_masters_rating ON masters(rating DESC) WHERE is_published = true;

-- ============================================================
-- КАТЕГОРИИ
-- ============================================================
CREATE TABLE categories (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  VARCHAR(100) NOT NULL UNIQUE,
  slug  VARCHAR(100) NOT NULL UNIQUE,
  icon  VARCHAR(50),
  sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- УСЛУГИ МАСТЕРА
-- ============================================================
CREATE TABLE services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id        UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES categories(id),
  name             VARCHAR(200) NOT NULL,
  description      TEXT,
  duration_min     INTEGER NOT NULL CHECK (duration_min > 0),
  buffer_after_min INTEGER NOT NULL DEFAULT 0,  -- уборка/перерыв после
  price            NUMERIC(10,2) NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_master ON services(master_id) WHERE is_active = true;
CREATE INDEX idx_services_category ON services(category_id);

-- ============================================================
-- РАСПИСАНИЕ: шаблон (именованный, у мастера может быть несколько)
-- ============================================================
CREATE TABLE schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL DEFAULT 'Default',
  timezone    VARCHAR(50) NOT NULL DEFAULT 'Europe/Moscow',
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(master_id, name)
);
-- Только одно дефолтное расписание на мастера
CREATE UNIQUE INDEX idx_schedules_one_default ON schedules(master_id) WHERE is_default = true;

-- ============================================================
-- НЕДЕЛЬНЫЙ ШАБЛОН (0=Вс, 1=Пн, ..., 6=Сб)
-- ============================================================
CREATE TABLE availability_weekly (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE(schedule_id, day_of_week)
);
CREATE INDEX idx_avail_weekly ON availability_weekly(schedule_id, day_of_week);

-- ============================================================
-- ПЕРЕОПРЕДЕЛЕНИЯ ДАТ (выходные, особые часы)
-- ============================================================
CREATE TABLE availability_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_available  BOOLEAN NOT NULL DEFAULT true,  -- false = выходной
  start_time    TIME,  -- NULL + is_available=false = полный выходной
  end_time      TIME,
  note          VARCHAR(255),
  UNIQUE(schedule_id, override_date)
);
CREATE INDEX idx_avail_overrides ON availability_overrides(schedule_id, override_date);

-- ============================================================
-- БРОНИРОВАНИЯ
-- ============================================================
CREATE TYPE booking_status AS ENUM (
  'PENDING',       -- создана, ждёт подтверждения
  'CONFIRMED',     -- подтверждена мастером
  'COMPLETED',     -- состоялась (автоматически через cron)
  'CANCELLED',     -- отменена (клиентом/мастером/системой)
  'NO_SHOW',       -- клиент не пришёл
  'RESCHEDULED'    -- перенесена (терминальный статус, указывает на новую запись)
);

CREATE TABLE bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- публичный ID
  client_id           UUID NOT NULL REFERENCES users(id),
  master_id           UUID NOT NULL REFERENCES masters(id),
  service_id          UUID NOT NULL REFERENCES services(id),
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,   -- явно: start + duration + buffer
  status              booking_status NOT NULL DEFAULT 'PENDING',
  rescheduled_from_id UUID REFERENCES bookings(id),  -- цепочка переносов
  rescheduled_to_id   UUID REFERENCES bookings(id),
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        VARCHAR(10) CHECK (cancelled_by IN ('client','master','system')),
  cancel_reason       TEXT,
  price_snapshot      NUMERIC(10,2) NOT NULL,  -- цена на момент записи
  client_telegram_id  BIGINT,
  master_telegram_id  BIGINT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),

  -- ЗАЩИТА ОТ ДВОЙНОГО БРОНИРОВАНИЯ (уровень БД, абсолютная)
  EXCLUDE USING GIST (
    master_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status IN ('CONFIRMED', 'PENDING'))
);

-- Индексы для горячего пути (запрос доступных слотов)
CREATE INDEX idx_bookings_master_active
  ON bookings(master_id, start_time, end_time)
  WHERE status IN ('CONFIRMED', 'PENDING');

-- История клиента
CREATE INDEX idx_bookings_client ON bookings(client_id, created_at DESC);

-- Cron auto-complete (CONFIRMED → COMPLETED после end_time)
CREATE INDEX idx_bookings_status_time
  ON bookings(status, start_time)
  WHERE status NOT IN ('CANCELLED', 'COMPLETED', 'RESCHEDULED', 'NO_SHOW');

-- ============================================================
-- ОТЗЫВЫ (один на запись, после завершения)
-- ============================================================
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) UNIQUE,
  master_id   UUID NOT NULL REFERENCES masters(id),
  client_id   UUID NOT NULL REFERENCES users(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_master ON reviews(master_id, created_at DESC);

-- ============================================================
-- ГАЛЕРЕЯ РАБОТ МАСТЕРА
-- ============================================================
CREATE TABLE gallery (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  caption     TEXT,
  category_id UUID REFERENCES categories(id),
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gallery_master ON gallery(master_id, sort_order);

-- ============================================================
-- ЛОГ УВЕДОМЛЕНИЙ
-- ============================================================
CREATE TABLE notification_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID REFERENCES bookings(id),
  telegram_id  BIGINT NOT NULL,
  type         VARCHAR(50) NOT NULL,   -- 'confirmed', 'reminder_24h', 'cancelled'
  message_id   INTEGER,               -- Telegram message_id
  status       VARCHAR(20) NOT NULL DEFAULT 'sent',
  error        TEXT,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_failed ON notification_log(status, sent_at) WHERE status = 'failed';
```

---

## 6. Backend: структура и слои

### Принцип слоёв

```
Route → Handler → Service → Repository → Database
                     ↓
                   libs/        (telegram-bot, redis, storage)
```

| Слой | Ответственность | Что знает |
|---|---|---|
| **Route** | HTTP метод + путь + middleware | Только handler + middlewares |
| **Handler** | Парсит req, вызывает service, отправляет res | Только service + validator |
| **Service** | Вся бизнес-логика | Только repositories + libs |
| **Repository** | SQL-запросы к БД | Только db/pool |
| **libs/** | Сторонние интеграции | Только свой домен |

### Правила

- Нет circular dependencies между слоями
- Нет прямых SQL-запросов вне repositories
- Нет HTTP-объектов (req/res) вне handlers
- Нет cross-feature импортов (bookings не импортирует schedules напрямую)

### RBAC Middleware

```
Публичные роуты:      GET /catalog, GET /masters, GET /masters/:id
Клиентские роуты:     authenticate → requireRole('client')
Мастерские роуты:     authenticate → requireRole('master') → requireOwner()
Админские роуты:      authenticate → requireRole('admin')
```

JWT payload: `{ userId, role, masterId? (только для master) }`

**Правило безопасности:** Никогда не доверять `master_id` из тела запроса — брать из `req.user.masterId`.

### API Routes

```
# Публичные
GET  /catalog/masters          ?category=&city=&rating_min=&page=&limit=
GET  /catalog/masters/:id      профиль + услуги + отзывы
GET  /masters/:id/availability ?date=YYYY-MM-DD
GET  /categories

# Авторизованные (любая роль)
GET  /me
PUT  /me

# Клиент
POST   /bookings                 { master_id, service_id, start_time }
GET    /bookings                 свои записи
GET    /bookings/:id
POST   /bookings/:id/cancel
POST   /bookings/:id/review      только после COMPLETED

# Мастер
POST   /services
PUT    /services/:id
DELETE /services/:id
GET    /schedules                своё расписание
PUT    /schedules                обновить шаблон
POST   /schedule-overrides       заблокировать дату
DELETE /schedule-overrides/:id
GET    /bookings                 свои записи (тот же endpoint, фильтр по роли)
PUT    /bookings/:id/confirm
PUT    /bookings/:id/no-show
POST   /gallery                  загрузить фото
DELETE /gallery/:id

# Админ
GET    /admin/masters
PUT    /admin/masters/:id/verify
PUT    /admin/masters/:id/publish
GET    /admin/bookings
GET    /admin/users
```

---

## 7. Frontend: структура и слои

### Архитектура: Feature-Sliced Design (4-слойная, прагматичная)

```
app/          — Инициализация, провайдеры, роутер
pages/        — Экраны (один экран = одна папка)
features/     — Пользовательские действия + блоки
entities/     — Бизнес-объекты (типы + API + UI-примитивы)
shared/       — Без бизнес-логики (API client, tg wrapper, UI atoms)
```

**Правило импортов (строго):**
```
app  →  pages  →  features  →  entities  →  shared
Нельзя импортировать в обратную сторону.
Нельзя импортировать между файлами одного слоя (features/A не импортирует features/B).
```

### Роли в одном приложении: RoleGate

Одна TMA-ссылка → роль определяется по Telegram user ID через бэкенд:

```
App start → initApp() → fetch /me →
  role === 'master' → <MasterApp />
  role === 'client' → <ClientApp />
  role === 'admin'  → <AdminApp />
```

Отдельные деревья роутов для каждой роли. Без смешивания.

### State Management

```
TanStack Query  — весь серверный стейт (каталог, записи, профиль)
Zustand         — клиентский стейт:
  bookingFlowStore    — текущий booking flow (selectedService, selectedSlot)
  telegramStore       — данные Telegram user
  filtersStore        — фильтры каталога (активны пока юзер в сессии)
```

**Правило:** Данные с сервера — только через TanStack Query. Zustand — только для UI-стейта без TTL.

### Telegram API: только через обёртку

```typescript
// shared/lib/telegram.ts — единственный файл с window.Telegram.WebApp
export const tg = {
  expand:           () => viewport.expand(),
  ready:            () => miniApp.ready(),
  setMainButton:    (text, fn) => { ... },
  hideMainButton:   () => mainButton.hide(),
  showBackButton:   () => backButton.show(),
  hideBackButton:   () => backButton.hide(),
  hapticLight:      () => hapticFeedback.impactOccurred('light'),
  hapticSuccess:    () => hapticFeedback.notificationOccurred('success'),
  hapticError:      () => hapticFeedback.notificationOccurred('error'),
  showConfirm:      (msg) => popup.open({ message: msg, ... }),
  getUser:          () => initData.user(),
  getInitDataRaw:   () => retrieveLaunchParams().initDataRaw,
  enableClosingConfirmation: () => miniApp.enableClosingConfirmation(),
};
```

**Никогда** не вызывать `window.Telegram.WebApp` напрямую в компонентах.

### Навигация

```
MemoryRouter (react-router-dom v6)
+ initNavigator(@telegram-apps/sdk) → управляет BackButton автоматически

Bottom Tab Bar (4 вкладки):
  [Каталог] [Записи] [Избранное] [Профиль]

Stack внутри вкладки:
  Catalog → Category → ServiceDetail → MasterProfile → DateTimePicker
  → BookingSummary → Success

Правила:
- Tab Bar скрывается во время booking flow (шаги 3-7)
- BackButton: show() на всех экранах кроме корневых вкладок
- MainButton: текст меняется по шагу, disabled до выбора слота
```

---

## 8. Движок бронирований

### Алгоритм вычисления доступных слотов

```
GET /masters/:id/availability?date=2026-06-15

1. Найти дефолтное расписание мастера
2. Проверить availability_overrides для этой даты
   - is_available = false → вернуть [] (выходной)
   - is_available = true + время → использовать это время
   - Нет override → взять availability_weekly для day_of_week
3. Если нет рабочих часов → вернуть []
4. Загрузить все CONFIRMED/PENDING записи мастера на эту дату
5. Сгенерировать сетку слотов (15 мин) в рабочих часах
6. Отфильтровать слоты, перекрывающиеся с существующими записями
   (учитывая duration + buffer_after)
7. Вернуть свободные слоты
```

### Защита от двойного бронирования

**Уровень 1 — База данных (абсолютная гарантия):**
```sql
EXCLUDE USING GIST (
  master_id WITH =,
  tstzrange(start_time, end_time, '[)') WITH &&
) WHERE (status IN ('CONFIRMED', 'PENDING'))
```
Структурно невозможно создать два перекрывающихся бронирования. Error code `23P01` при нарушении.

**Уровень 2 — Транзакция с блокировкой:**
```typescript
// bookings.service.ts
async function createBooking(data) {
  return await db.transaction(async (trx) => {
    // Блокировка строк мастера в целевом окне
    await trx.raw(
      `SELECT id FROM bookings
       WHERE master_id = ? AND status IN ('CONFIRMED','PENDING')
       AND tstzrange(start_time, end_time,'[)') && tstzrange(?,?,'[)')
       FOR UPDATE`,
      [data.masterId, data.startTime, data.endTime]
    );
    // EXCLUDE сработает при INSERT если блокировка не успела
    return await trx('bookings').insert(data).returning('*');
  });
}
```

### Машина состояний бронирования

```
PENDING ──(мастер подтверждает)──> CONFIRMED ──(время прошло)──> COMPLETED
   │                                    │
   │(клиент/мастер отменяет)            │(клиент/мастер отменяет)
   ▼                                    ▼
CANCELLED                            CANCELLED
                                        │
                                        ▼(мастер отмечает)
                                     NO_SHOW
PENDING/CONFIRMED ──(перенос)──> RESCHEDULED → [новая запись PENDING]
```

**Перенос = отмена старой + новая запись.** Цепочка через `rescheduled_from_id` / `rescheduled_to_id`. Старые напоминания удаляются, новые планируются.

---

## 9. Система уведомлений

### Архитектура: BullMQ + Redis

```
Событие (booking confirmed/cancelled/rescheduled)
  │
  ▼
notificationQueue.add(jobType, data, { delay, jobId })
  │
  ▼
Redis (персистентная очередь)
  │
  ▼
NotificationWorker (concurrency=5, retries=3)
  │
  ▼
bot.sendMessage(telegramId, text)
  │
  ▼
notification_log (INSERT)
```

### Типы событий и их планирование

| Job | Задержка | jobId (для отмены) |
|---|---|---|
| `booking_confirmed` | 0 (немедленно) | — |
| `reminder_24h` | start_time − 24h | `reminder_24h_{bookingId}` |
| `reminder_2h` | start_time − 2h | `reminder_2h_{bookingId}` |
| `booking_cancelled` | 0 (немедленно) | — |
| `booking_rescheduled` | 0 (немедленно) | — |

При отмене/переносе записи — удалять `reminder_24h_{id}` и `reminder_2h_{id}` из очереди.

### Rate limiting

Telegram Bot API: максимум 30 сообщений/сек.
BullMQ `concurrency: 5` + `limiter: { max: 25, duration: 1000 }` — безопасный лимит.

---

## 10. Tech Stack

```
┌────────────────────────────────────────────────────────────────┐
│  Frontend (Telegram Mini App)                                   │
├────────────────────────────────────────────────────────────────┤
│  React 18 + TypeScript + Vite                                  │
│  @telegram-apps/sdk + @telegram-apps/sdk-react                 │
│  @telegram-apps/telegram-ui  (нативные компоненты)             │
│  react-router-dom v6 + MemoryRouter                            │
│  TanStack Query v5  (серверный стейт)                          │
│  Zustand  (клиентский стейт)                                   │
│  CSS Modules + Telegram themeParams                            │
│  Хостинг: Vercel (HTTPS из коробки)                            │
├────────────────────────────────────────────────────────────────┤
│  Backend                                                        │
├────────────────────────────────────────────────────────────────┤
│  Node.js + TypeScript                                          │
│  Fastify  (HTTP-сервер, быстрее Express, хорошие плагины)      │
│  Grammy  (Telegram Bot framework для Node.js)                  │
│  Zod  (валидация запросов)                                     │
│  jsonwebtoken  (JWT)                                           │
│  BullMQ  (очередь уведомлений)                                 │
│  node-postgres (pg)  (raw SQL → полный контроль)               │
│  Хостинг: Railway или VPS                                      │
├────────────────────────────────────────────────────────────────┤
│  База данных и инфраструктура                                  │
├────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16  (основная БД + btree_gist для EXCLUDE)         │
│  Redis 7  (BullMQ queue + кэш слотов)                          │
│  Object Storage S3/R2  (фото галереи)                          │
│  docker-compose  (локальная разработка)                        │
└────────────────────────────────────────────────────────────────┘
```

**Почему Fastify вместо Express:** встроенная TypeScript-поддержка, schema-based validation, в 2× быстрее под нагрузкой, лучший plugin lifecycle.

**Почему Grammy вместо Telegraf:** полная поддержка TypeScript, лучше документирован, активно поддерживается в 2025-2026.

**Почему raw SQL вместо ORM:** AI легче читает и изменяет явный SQL чем ORM magic. Нет скрытых N+1. Полный контроль над EXCLUDE constraint.

---

## 11. Структура папок

### Backend

```
backend/
├── src/
│   ├── features/              # Вертикальные срезы — по одному на use case
│   │   ├── auth/
│   │   │   ├── auth.route.ts          # GET/POST /auth/...
│   │   │   ├── auth.handler.ts        # парсит req → вызывает service
│   │   │   ├── auth.service.ts        # верификация initData, JWT
│   │   │   └── auth.schema.ts         # Zod-схемы валидации
│   │   │
│   │   ├── catalog/
│   │   │   ├── catalog.route.ts
│   │   │   ├── catalog.handler.ts
│   │   │   └── catalog.service.ts     # поиск мастеров + фильтры
│   │   │
│   │   ├── masters/
│   │   │   ├── masters.route.ts
│   │   │   ├── masters.handler.ts
│   │   │   ├── masters.service.ts
│   │   │   ├── masters.schema.ts
│   │   │   └── masters.repo.ts        # SQL-запросы к masters + users
│   │   │
│   │   ├── services/                  # Услуги мастера (не путать с /src/services/)
│   │   │   ├── services.route.ts
│   │   │   ├── services.handler.ts
│   │   │   ├── services.service.ts
│   │   │   ├── services.schema.ts
│   │   │   └── services.repo.ts
│   │   │
│   │   ├── schedules/
│   │   │   ├── schedules.route.ts
│   │   │   ├── schedules.handler.ts
│   │   │   ├── schedules.service.ts   # вычисление доступных слотов
│   │   │   ├── slots.calculator.ts    # generateAvailableSlots() — изолирован
│   │   │   └── schedules.repo.ts
│   │   │
│   │   ├── bookings/
│   │   │   ├── bookings.route.ts
│   │   │   ├── bookings.handler.ts
│   │   │   ├── bookings.service.ts    # createBooking, cancel, reschedule
│   │   │   ├── bookings.schema.ts
│   │   │   └── bookings.repo.ts
│   │   │
│   │   ├── reviews/
│   │   │   ├── reviews.route.ts
│   │   │   ├── reviews.handler.ts
│   │   │   ├── reviews.service.ts
│   │   │   └── reviews.repo.ts
│   │   │
│   │   ├── gallery/
│   │   │   ├── gallery.route.ts
│   │   │   ├── gallery.handler.ts
│   │   │   ├── gallery.service.ts     # upload → storage
│   │   │   └── gallery.repo.ts
│   │   │
│   │   └── notifications/
│   │       ├── notification.queue.ts  # BullMQ Queue setup
│   │       ├── notification.worker.ts # BullMQ Worker, handlers по типу
│   │       └── notification.repo.ts   # INSERT в notification_log
│   │
│   ├── shared/
│   │   ├── db/
│   │   │   ├── pool.ts                # pg Pool singleton
│   │   │   └── migrations/
│   │   │       ├── 001_initial.sql
│   │   │       ├── 002_indexes.sql
│   │   │       └── 003_rls.sql
│   │   │
│   │   ├── lib/
│   │   │   ├── telegram-bot.ts        # Grammy bot instance
│   │   │   ├── redis.ts               # Redis client
│   │   │   ├── storage.ts             # S3/R2 upload
│   │   │   └── telegram-auth.ts      # verifyInitData() HMAC
│   │   │
│   │   ├── middleware/
│   │   │   ├── authenticate.ts        # JWT → req.user
│   │   │   ├── rbac.ts                # requireRole(), requireOwner()
│   │   │   └── error-handler.ts
│   │   │
│   │   ├── errors/
│   │   │   └── app-errors.ts          # NotFoundError, ConflictError, ForbiddenError
│   │   │
│   │   ├── types/
│   │   │   ├── user.types.ts
│   │   │   ├── booking.types.ts
│   │   │   └── fastify.d.ts           # augments request.user
│   │   │
│   │   └── config/
│   │       └── env.ts                 # валидация всех env vars через Zod
│   │
│   └── app.ts                         # Fastify instance + регистрация роутов
│
├── server.ts                          # только app.listen()
├── tsconfig.json
├── .env.example
├── package.json
└── docker-compose.yml                 # postgres + redis
```

### Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── providers/
│   │   │   ├── QueryProvider.tsx      # TanStack Query
│   │   │   └── TelegramProvider.tsx   # SDK init + theme sync
│   │   ├── styles/
│   │   │   └── global.css             # Telegram CSS vars override
│   │   ├── router.tsx                 # Routes + RoleGate
│   │   └── init.ts                    # tg.expand(), tg.ready()
│   │
│   ├── pages/
│   │   ├── catalog/
│   │   │   └── ui/CatalogPage.tsx
│   │   ├── category/
│   │   │   └── ui/CategoryPage.tsx
│   │   ├── service-detail/
│   │   │   └── ui/ServiceDetailPage.tsx
│   │   ├── master-profile/
│   │   │   └── ui/MasterProfilePage.tsx
│   │   ├── booking/
│   │   │   └── ui/BookingPage.tsx     # datetime picker + summary
│   │   ├── booking-success/
│   │   │   └── ui/BookingSuccessPage.tsx
│   │   ├── my-bookings/
│   │   │   └── ui/MyBookingsPage.tsx
│   │   ├── profile/
│   │   │   └── ui/ProfilePage.tsx
│   │   └── master/
│   │       ├── dashboard/ui/MasterDashboardPage.tsx
│   │       ├── orders/ui/MasterOrdersPage.tsx
│   │       ├── schedule/ui/MasterSchedulePage.tsx
│   │       ├── services/ui/MasterServicesPage.tsx
│   │       └── gallery/ui/MasterGalleryPage.tsx
│   │
│   ├── features/
│   │   ├── create-booking/
│   │   │   ├── ui/TimeSlotPicker.tsx
│   │   │   ├── ui/BookingSummarySheet.tsx
│   │   │   ├── model/bookingFlowStore.ts     # Zustand
│   │   │   └── model/useCreateBooking.ts     # useMutation
│   │   ├── cancel-booking/
│   │   │   ├── ui/CancelButton.tsx
│   │   │   └── model/useCancelBooking.ts
│   │   ├── catalog-filters/
│   │   │   ├── ui/FilterBar.tsx
│   │   │   └── model/filtersStore.ts
│   │   └── master-manage-schedule/
│   │       ├── ui/WeekScheduleEditor.tsx
│   │       └── model/useUpdateSchedule.ts
│   │
│   ├── entities/
│   │   ├── master/
│   │   │   ├── model/master.types.ts
│   │   │   ├── api/mastersApi.ts
│   │   │   └── ui/MasterCard.tsx
│   │   ├── service/
│   │   │   ├── model/service.types.ts
│   │   │   ├── api/servicesApi.ts
│   │   │   └── ui/ServiceCard.tsx
│   │   ├── booking/
│   │   │   ├── model/booking.types.ts
│   │   │   ├── api/bookingsApi.ts
│   │   │   └── ui/BookingStatusBadge.tsx
│   │   └── review/
│   │       ├── model/review.types.ts
│   │       ├── api/reviewsApi.ts
│   │       └── ui/ReviewCard.tsx
│   │
│   └── shared/
│       ├── api/
│       │   └── client.ts              # fetch wrapper + X-Telegram-Init-Data header
│       ├── lib/
│       │   ├── telegram.ts            # tg wrapper (единственный файл с TG API)
│       │   └── formatters.ts          # formatPrice, formatDate, formatDuration
│       ├── ui/
│       │   ├── BottomSheet/
│       │   ├── Skeleton/
│       │   ├── EmptyState/
│       │   └── Avatar/
│       └── config/
│           ├── env.ts                 # VITE_ переменные
│           └── queryClient.ts        # TanStack Query config
│
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 12. Шаблоны файлов для AI-разработки

Агент по AI-архитектуре создал подробный файл с принципами и примерами: [ai-friendly-architecture.md](ai-friendly-architecture.md)  
Ниже — конкретные шаблоны которые нужно соблюдать при каждом новом файле.

### Почему вертикальные срезы лучше горизонтальных слоёв для ИИ

```
❌ Горизонтальные слои (классика, плохо для ИИ):
   controllers/masterController.ts
   services/masterService.ts
   repositories/masterRepository.ts
   models/Master.ts
   → добавить одну фичу = трогать 5 файлов в 5 папках

✅ Вертикальные срезы (хорошо для ИИ):
   features/master-profile/update-working-hours/
     update-working-hours.handler.ts   (40 строк)
     update-working-hours.schema.ts    (20 строк)
     update-working-hours.route.ts     (15 строк)
   → добавить одну фичу = создать одну папку с 3 файлами
```

### Шаблон: Handler

```typescript
// features/booking/create-booking/create-booking.handler.ts
import type { IBookingRepository } from '@/entities/booking';
import type { IMasterRepository } from '@/entities/master';
import type { CreateBookingInput, CreateBookingResult } from './create-booking.schema';

// Зависимости явно видны в сигнатуре — ИИ понимает что нужно функции
export async function createBookingHandler(
  input: CreateBookingInput,
  deps: {
    bookingRepo: IBookingRepository;
    masterRepo: IMasterRepository;
  }
): Promise<CreateBookingResult> {
  const master = await deps.masterRepo.findById(input.masterId);
  if (!master) return { success: false, reason: 'master_not_found' };

  const booking = await deps.bookingRepo.create(input);
  // Error 23P01 от EXCLUDE GIST → будет поймана в route как ConflictError

  return { success: true, booking };
}
```

### Шаблон: Schema (Zod)

```typescript
// features/booking/create-booking/create-booking.schema.ts
import { z } from 'zod';
import type { Booking } from '@/entities/booking';

export const CreateBookingInputSchema = z.object({
  masterId:        z.string().uuid(),
  serviceId:       z.string().uuid(),
  scheduledAt:     z.string().datetime().transform((s) => new Date(s)),
});

export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;

// Результат — union type, не throw. ИИ видит все исходы явно
export type CreateBookingResult =
  | { success: true;  booking: Booking }
  | { success: false; reason: 'master_not_found' | 'slot_taken' | 'service_not_found' };
```

### Шаблон: Route

```typescript
// features/booking/create-booking/create-booking.route.ts
import type Fastify from 'fastify';
import { CreateBookingInputSchema } from './create-booking.schema';
import { createBookingHandler } from './create-booking.handler';
import { BookingRepository } from '@/entities/booking';
import { MasterRepository } from '@/entities/master';
import { db } from '@/shared/db';
import { ConflictError } from '@/shared/errors/app-errors';

export function createBookingRoute(app: ReturnType<typeof Fastify>) {
  app.post('/api/bookings', {
    preHandler: [app.authenticate],
    schema: { body: CreateBookingInputSchema },
    handler: async (request, reply) => {
      try {
        const result = await createBookingHandler(request.body, {
          bookingRepo: new BookingRepository(db),
          masterRepo:  new MasterRepository(db),
        });
        if (!result.success) return reply.status(400).send({ error: result.reason });
        return reply.status(201).send(result.booking);
      } catch (err: any) {
        if (err.code === '23P01') throw new ConflictError('Slot is no longer available');
        throw err;
      }
    },
  });
}
```

### Правило добавления новой фичи

```
Новая фича = новая папка. Существующие файлы НЕ трогаются.

До:
  features/booking/create-booking/   ← не трогать
  features/booking/cancel-booking/   ← не трогать

После добавления "get-available-slots":
  features/booking/create-booking/   ← не тронуто
  features/booking/cancel-booking/   ← не тронуто
  features/booking/get-available-slots/  ← новая папка

  app/routes.ts  ← добавить ОДНУ строку регистрации
```

### Лимиты размера файлов

| Тип файла | Рекомендуемый | Жёсткий |
|---|---|---|
| `*.handler.ts` | 80 строк | 150 строк |
| `*.schema.ts` | 50 строк | 100 строк |
| `*.route.ts` | 30 строк | 60 строк |
| `*.repo.ts` | 80 строк | 150 строк |
| `*.types.ts` | 60 строк | 120 строк |

Файл > 150 строк → сигнал разбить на два.

---

## 13. CLAUDE.md — файл контекста для AI

Создаётся в корне проекта. Claude Code читает его автоматически в начале каждой сессии.  
Готовый файл: [CLAUDE.md](CLAUDE.md)

---

## Итоговые решения (Decision Log)

| Решение | Выбор | Обоснование |
|---|---|---|
| Мультитенантность | Shared DB + `master_id` FK | 100–1000 мастеров, единые миграции, Fresha/Booksy/StyleSeat так начинали |
| Защита от двойного бронирования | EXCLUDE GIST (первичная) + SELECT FOR UPDATE (вторичная) | Database-enforced, 100% надёжно, без доп. инфраструктуры |
| Вычисление слотов | On-demand из расписания минус бронирования | Нет миллиона строк pre-generated slots; Cal.com-паттерн |
| Расписание | Двухуровневое: weekly_template + overrides | Cal.com доказал; чисто обрабатывает исключения |
| Уведомления | BullMQ + Redis с delayed jobs | Персистентно, jobId для отмены, выживает перезапуск |
| Backend структура | Вертикальные срезы (feature folders) | AI находит нужный файл с первого раза |
| Frontend структура | Feature-Sliced Design 4-слойный | Изолированные фичи, AI может добавить без риска регрессии |
| Клиент/Мастер в одном приложении | RoleGate (один TMA URL, роль с бэкенда) | Один деплой, одна ссылка, роль через JWT |
| ORM vs raw SQL | Raw SQL в repositories | AI читает SQL лучше ORM-магии, нет hidden N+1 |
| HTTP-фреймворк | Fastify | Лучше TypeScript, быстрее Express, schema validation встроена |
| Bot-фреймворк | Grammy | Лучшая TypeScript поддержка 2025-2026 |
| Навигация TMA | MemoryRouter + initNavigator SDK | Нет проблем с WebView history API |
