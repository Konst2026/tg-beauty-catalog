# Architecture.md — TG Beauty Marketplace

> Версия: 2.0 | Дата: 2026-05-18 (ревизия после архитектурного аудита)
> Продукт: Telegram Mini App — маркетплейс бьюти-мастеров  
> Код пишется ИИ → архитектура проектировалась под AI-разработку  
> Основа: Clean Architecture (Robert C. Martin, 2017) + Feature-Sliced Design

---

## Аудит-отчёт v1.0 → v2.0

Проведён архитектурный аудит по критериям Clean Architecture (Dependency Rule, SOLID), AI-friendly architecture и Operational Excellence.

### Найденные нарушения и исправления

| Severity | Группа | Нарушение | Раздел v1.0 | Статус |
|---|---|---|---|---|
| **CRITICAL** | Dependency Rule | Слои `Route→Handler→Service→Repo` нарушают Dependency Rule: Use Cases знают о Infrastructure напрямую | §6 | ✅ Исправлено в §6 |
| **CRITICAL** | DIP | Нет Port-интерфейсов: Use Cases зависят на конкретные реализации репозиториев и Grammy бота | §6, §11 | ✅ Добавлен §6.2 Ports |
| **CRITICAL** | Clean Arch | Нет слоя Domain (Entities + Use Cases) — бизнес-правила смешаны с инфраструктурой | §4, §11 | ✅ Добавлен §4.1, переработан §11 |
| **CRITICAL** | OCP | `booking_status` как PostgreSQL ENUM: добавление нового статуса = миграция БД + код | §5 | ✅ Исправлено в §5 |
| **HIGH** | API versioning | Роуты без версий (`/bookings`) → breaking change при обновлении | §6 | ✅ Добавлен `/api/v1/` |
| **HIGH** | SRP | `shared/` — God-модуль: db + redis + bot + storage + auth + errors в одной папке | §11 | ✅ Разделён на `infrastructure/` + `shared/` |
| **HIGH** | Domain Events | `bookings.service` напрямую вызывает `notificationQueue` — нарушение изоляции | §6, §9 | ✅ Добавлен §6.3 Domain Events |
| **HIGH** | Observability | Нет стратегии логирования, health checks, error tracking | отсутствовал | ✅ Добавлен §14 |
| **HIGH** | Resilience | Нет стратегии при недоступности Telegram API / Redis / PostgreSQL | отсутствовал | ✅ Добавлен §15 |
| **MEDIUM** | Idempotency | `POST /bookings` без idempotency key → двойная запись при retry | §6 | ✅ Добавлен `Idempotency-Key` header |
| **MEDIUM** | Screaming Arch | Диаграмма "Fastify HTTP Server" в центре — скрим инфраструктуры, не домена | §4 | ✅ Переработана диаграмма |
| **MEDIUM** | Testing | Нет стратегии unit/integration тестов | отсутствовал | ✅ Добавлен §16 |

---

## Оглавление

1. [Исследование: реальные платформы](#1-исследование-реальные-платформы)
2. [Анализ сильных и слабых сторон](#2-анализ-сильных-и-слабых-сторон)
3. [Ответы на 5 вопросов проектирования](#3-ответы-на-5-вопросов-проектирования)
4. [Финальная архитектура проекта (Clean Architecture)](#4-финальная-архитектура-проекта)
5. [Схема базы данных](#5-схема-базы-данных)
6. [Backend: структура и слои](#6-backend-структура-и-слои)
7. [Frontend: структура и слои](#7-frontend-структура-и-слои)
8. [Движок бронирований](#8-движок-бронирований)
9. [Система уведомлений](#9-система-уведомлений)
10. [Tech Stack](#10-tech-stack)
11. [Структура папок (Clean Architecture)](#11-структура-папок)
12. [Шаблоны файлов для AI-разработки](#12-шаблоны-файлов-для-ai-разработки)
13. [CLAUDE.md — файл контекста для AI](#13-claudemd--файл-контекста-для-ai)
14. [Observability](#14-observability)
15. [Resilience](#15-resilience)
16. [Testing Strategy](#16-testing-strategy)

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

### 4.1 Clean Architecture — 4 слоя (Роберт Мартин)

**Главный закон (Dependency Rule):** зависимости указывают ТОЛЬКО внутрь. Внешние слои знают о внутренних. Внутренние слои не знают ничего о внешних.

```
┌─────────────────────────────────────────────────────────────┐
│  FRAMEWORKS & DRIVERS (внешний)                              │
│  Fastify, Grammy Bot, PostgreSQL, BullMQ, Redis, S3/R2      │
│  ↑ зависит от Adapters                                       │
├─────────────────────────────────────────────────────────────┤
│  INTERFACE ADAPTERS                                          │
│  HTTP Controllers, Route Handlers                            │
│  Postgres Repositories (реализации портов)                  │
│  Grammy Notification Adapter (реализация порта)             │
│  ↑ зависит от Use Cases                                      │
├─────────────────────────────────────────────────────────────┤
│  USE CASES (Application Business Rules)                      │
│  CreateBookingUseCase, CancelBookingUseCase                  │
│  GetAvailableSlotsUseCase, ConfirmBookingUseCase             │
│  Зависит только на Port-интерфейсы (НЕ на реализации)       │
│  ↑ зависит от Domain                                         │
├─────────────────────────────────────────────────────────────┤
│  DOMAIN (Enterprise Business Rules) — ядро, без зависимостей │
│  Entities: Booking, Master, Service, Client, Review         │
│  Value Objects: BookingStatus, TimeSlot, Money              │
│  Domain Services: SlotCalculator (чистая функция)           │
│  Port Interfaces: IBookingRepo, INotificationPort, IFilePort │
└─────────────────────────────────────────────────────────────┘
```

**Что это значит на практике:**
- `SlotCalculator` — чистая TypeScript-функция, нет ни Fastify, ни PostgreSQL
- `CreateBookingUseCase` — вызывает `IBookingRepository.save()`, не знает про PostgreSQL
- `PostgresBookingRepository` — реализует `IBookingRepository`, знает про SQL
- Fastify Route — вызывает `CreateBookingUseCase`, переводит HTTP ↔ DTO

**Screaming Architecture:** папки кричат «система бронирования», не «Fastify-приложение»:
```
src/domain/booking/    ← главное место
src/domain/master/
src/use-cases/create-booking/
src/adapters/http/
src/infrastructure/postgres/
```

---

### 4.2 Применение 5 признаков AI-архитектуры

**1. Простые модули — один модуль = одна ответственность**
- Domain entities: только бизнес-правила, нет импортов фреймворков
- Use Cases: только оркестрация через порты, нет SQL/HTTP
- Adapters: только перевод форматов, нет бизнес-логики

**2. Предсказуемая структура — стабильные patterns**
- Именование: `[verb-noun].use-case.ts`, `[entity].repo.ts` (реализация), `I[Entity].repo.ts` (порт)
- ИИ знает: бизнес-логика → `domain/` или `use-cases/`, SQL → `infrastructure/postgres/`

**3. Минимальные зависимости — меньше связей**
- Domain не зависит ни от чего
- Use Cases зависят только на интерфейсы из Domain
- Infrastructure зависит на Use Cases и Domain, не наоборот

**4. Изоляция изменений**
- Смена PostgreSQL → Redis: меняется только `infrastructure/`, Domain и Use Cases не трогаются
- Смена Grammy → другой бот: меняется только `infrastructure/telegram/`, Use Cases не трогаются
- Новый статус бронирования: меняется `domain/booking/booking-status.ts` + миграция, не Use Cases

**5. Явные границы — никакой магии**
- Все зависимости передаются через конструктор Use Case, видны в сигнатуре
- Нет auto-discovery, нет декораторов с side-effects
- Ports (интерфейсы) — явные контракты между слоями

---

### 4.3 Общая схема системы (правильная — домен в центре)

```
                    ┌────────────────────────┐
                    │      DOMAIN (ядро)      │
                    │  Booking, Master,        │
                    │  Service, SlotCalc,      │
                    │  Ports (interfaces)      │
                    └──────────┬─────────────┘
                               │ ← все слои зависят на домен
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                     ▼
  ┌──────────────┐   ┌─────────────────┐   ┌───────────────┐
  │  USE CASES   │   │  USE CASES      │   │  USE CASES    │
  │  CreateBook  │   │  GetSlots       │   │  ManageSvc    │
  └──────┬───────┘   └────────┬────────┘   └──────┬────────┘
         └──────────────────┬─┘                   │
                            ▼                     ▼
              ┌─────────────────────────────────────────┐
              │        INTERFACE ADAPTERS                │
              │  HTTP Controllers  │  Repo Adapters      │
              │  (Fastify Routes)  │  (Postgres impls)   │
              └─────────┬──────────┴──────────┬──────────┘
                        ▼                     ▼
              ┌──────────────────┐  ┌──────────────────────┐
              │   FRAMEWORKS     │  │   INFRASTRUCTURE      │
              │   Fastify 5      │  │   PostgreSQL 16       │
              │   Grammy Bot     │  │   BullMQ + Redis      │
              │   TG Mini App    │  │   S3/R2 Storage       │
              └──────────────────┘  └──────────────────────┘
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
-- booking_status — VARCHAR, не ENUM (OCP: новый статус = только миграция CHECK,
-- не ALTER TYPE; переходы валидируются в Domain слое — BookingStatus value object)

CREATE TABLE bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- публичный ID
  client_id           UUID NOT NULL REFERENCES users(id),
  master_id           UUID NOT NULL REFERENCES masters(id),
  service_id          UUID NOT NULL REFERENCES services(id),
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,   -- явно: start + duration + buffer
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN (
                          'PENDING',      -- создана, ждёт подтверждения
                          'CONFIRMED',    -- подтверждена мастером
                          'COMPLETED',    -- состоялась (автоматически через cron)
                          'CANCELLED',    -- отменена (клиентом/мастером/системой)
                          'NO_SHOW',      -- клиент не пришёл
                          'RESCHEDULED'   -- перенесена (терминальный: указывает на новую запись)
                        )),
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

### 6.1 Clean Architecture — слои и Dependency Rule

Каждый слой зависит ТОЛЬКО на слои ближе к центру. Никогда — наружу.

```
┌──────────────────────────────────────────────────────────────┐
│  FRAMEWORKS & DRIVERS (самый внешний)                         │
│  Fastify routes, Grammy bot handlers, pg Pool, BullMQ        │
│  ↑ импортируют Adapters                                       │
├──────────────────────────────────────────────────────────────┤
│  INTERFACE ADAPTERS                                           │
│  HTTP Controllers   → вызывают Use Cases, возвращают HTTP    │
│  Postgres Repos     → реализуют IRepository интерфейсы       │
│  Grammy Adapter     → реализует INotificationPort            │
│  S3 Adapter         → реализует IFileStoragePort             │
│  ↑ импортируют Use Cases                                      │
├──────────────────────────────────────────────────────────────┤
│  USE CASES (Application Business Rules)                       │
│  CreateBookingUseCase    CancelBookingUseCase                 │
│  GetAvailableSlotsUseCase  ConfirmBookingUseCase              │
│  Зависят ТОЛЬКО на Port-интерфейсы из Domain                 │
│  ↑ импортируют Domain                                         │
├──────────────────────────────────────────────────────────────┤
│  DOMAIN (Enterprise Business Rules — ядро, без зависимостей) │
│  Entities: Booking, Master, Service, Client, Review          │
│  Value Objects: BookingStatus, TimeSlot, Money               │
│  Domain Services: SlotCalculator (чистая функция)            │
│  Port Interfaces: IBookingRepo, INotificationPort, IFilePort  │
└──────────────────────────────────────────────────────────────┘
```

| Слой | Ответственность | Что знает | Что НЕ знает |
|---|---|---|---|
| **Domain** | Бизнес-правила, контракты (Ports) | Только TypeScript | Fastify, Grammy, pg, Redis |
| **Use Cases** | Оркестрация по портам | Domain interfaces | SQL, HTTP, Grammy |
| **Adapters** | Реализации портов + HTTP перевод | Use Cases + Domain | Бизнес-логика |
| **Frameworks** | HTTP, Bot, DB, Queue | Adapters | Use Cases (вызывают через adapters) |

### 6.2 Port Interfaces (контракты между Use Cases и Infrastructure)

```typescript
// src/domain/ports/booking.repo.port.ts
export interface IBookingRepository {
  create(data: CreateBookingData): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  findByMasterAndRange(masterId: string, from: Date, to: Date): Promise<Booking[]>;
  updateStatus(id: string, status: BookingStatus): Promise<Booking>;
  cancel(id: string, by: 'client' | 'master' | 'system', reason?: string): Promise<void>;
}

// src/domain/ports/master.repo.port.ts
export interface IMasterRepository {
  findById(id: string): Promise<Master | null>;
  findPublished(filters: MasterFilters): Promise<Master[]>;
  save(master: Master): Promise<Master>;
}

// src/domain/ports/notification.port.ts
export interface INotificationPort {
  send(telegramId: bigint, message: string): Promise<void>;
  scheduleReminder(bookingId: string, telegramId: bigint, message: string, sendAt: Date): Promise<void>;
  cancelReminders(bookingId: string): Promise<void>;
}

// src/domain/ports/file-storage.port.ts
export interface IFileStoragePort {
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>;  // returns URL
  delete(url: string): Promise<void>;
}

// src/domain/services/slot-calculator.ts — чистая функция, без зависимостей
export function generateAvailableSlots(
  workingHours: WorkingHours,
  existingBookings: BookedRange[],
  serviceDurationMin: number,
  bufferMin: number,
  stepMin: number = 15,
): TimeSlot[] { ... }
```

### 6.3 Domain Events (изоляция уведомлений от Use Cases)

Use Cases не вызывают очередь напрямую — они публикуют события. Infrastructure подписывается.

```typescript
// src/domain/events/booking.events.ts
export type BookingDomainEvent =
  | { type: 'BookingConfirmed';   payload: { booking: Booking } }
  | { type: 'BookingCancelled';   payload: { booking: Booking; by: string } }
  | { type: 'BookingRescheduled'; payload: { old: Booking; newBooking: Booking } }
  | { type: 'BookingCompleted';   payload: { booking: Booking } };

// src/domain/ports/event-bus.port.ts
export interface IEventBus {
  publish(event: BookingDomainEvent): Promise<void>;
  subscribe<T extends BookingDomainEvent['type']>(
    type: T, handler: (event: Extract<BookingDomainEvent, { type: T }>) => Promise<void>
  ): void;
}

// src/use-cases/create-booking/create-booking.use-case.ts
export class CreateBookingUseCase {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly masterRepo: IMasterRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: CreateBookingInput): Promise<CreateBookingResult> {
    const master = await this.masterRepo.findById(input.masterId);
    if (!master) return { ok: false, reason: 'master_not_found' };

    const booking = await this.bookingRepo.create({ ...input });
    await this.eventBus.publish({ type: 'BookingConfirmed', payload: { booking } });
    // Use Case не знает что такое BullMQ или Grammy

    return { ok: true, booking };
  }
}

// src/infrastructure/event-handlers/notification.event-handler.ts
// Подписчик: знает про BullMQ + Grammy
eventBus.subscribe('BookingConfirmed', async ({ payload }) => {
  await notificationQueue.add('booking_confirmed', { booking: payload.booking });
});
eventBus.subscribe('BookingCancelled', async ({ payload }) => {
  await notificationQueue.add('booking_cancelled', { booking: payload.booking });
  await notificationQueue.removeJobs(`reminder_*_${payload.booking.id}`);
});
```

### 6.4 RBAC Middleware

```
Публичные роуты:      GET /api/v1/catalog, GET /api/v1/masters, GET /api/v1/masters/:id
Клиентские роуты:     authenticate → requireRole('client')
Мастерские роуты:     authenticate → requireRole('master') → requireOwner()
Админские роуты:      authenticate → requireRole('admin')
```

JWT payload: `{ userId, role, masterId? (только для master) }`

**Правило безопасности:** Никогда не доверять `master_id` из тела запроса — брать из `req.user.masterId`.

### 6.5 API Routes (версионированные `/api/v1/`)

```
# Публичные
GET  /api/v1/catalog/masters          ?category=&city=&rating_min=&page=&limit=
GET  /api/v1/catalog/masters/:id      профиль + услуги + отзывы
GET  /api/v1/masters/:id/availability ?date=YYYY-MM-DD
GET  /api/v1/categories

# Авторизованные (любая роль)
GET  /api/v1/me
PUT  /api/v1/me

# Клиент
POST   /api/v1/bookings                { master_id, service_id, start_time }
                                        + заголовок Idempotency-Key: <uuid> (защита от двойного retry)
GET    /api/v1/bookings                свои записи
GET    /api/v1/bookings/:id
POST   /api/v1/bookings/:id/cancel
POST   /api/v1/bookings/:id/review     только после COMPLETED

# Мастер
POST   /api/v1/services
PUT    /api/v1/services/:id
DELETE /api/v1/services/:id
GET    /api/v1/schedules               своё расписание
PUT    /api/v1/schedules               обновить шаблон
POST   /api/v1/schedule-overrides      заблокировать дату
DELETE /api/v1/schedule-overrides/:id
GET    /api/v1/bookings                свои записи (тот же endpoint, фильтр по роли)
PUT    /api/v1/bookings/:id/confirm
PUT    /api/v1/bookings/:id/no-show
POST   /api/v1/gallery                 загрузить фото
DELETE /api/v1/gallery/:id

# Админ
GET    /api/v1/admin/masters
PUT    /api/v1/admin/masters/:id/verify
PUT    /api/v1/admin/masters/:id/publish
GET    /api/v1/admin/bookings
GET    /api/v1/admin/users
```

**Idempotency-Key** для `POST /api/v1/bookings`: сервер кэширует ответ в Redis на 24ч по ключу `idem:{key}`. Повторный запрос с тем же ключом возвращает кэшированный результат без создания новой записи.

### Правила слоёв

- Нет circular dependencies между слоями
- Нет прямых SQL-запросов вне `*.repo.ts`
- Нет HTTP-объектов (req/res) вне Controllers/Handlers
- Нет cross-feature импортов между Use Cases
- Use Cases зависят на интерфейсы (Ports), не на конкретные классы

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

Папки отражают Clean Architecture слои (Screaming Architecture):
`domain/` → `use-cases/` → `adapters/` → `infrastructure/`

### Backend

```
backend/
├── src/
│   │
│   ├── domain/                        # DOMAIN — ядро, нет внешних зависимостей
│   │   ├── booking/
│   │   │   ├── booking.entity.ts      # Booking, BookingStatus value object
│   │   │   └── booking.events.ts      # BookingConfirmed, BookingCancelled...
│   │   ├── master/
│   │   │   └── master.entity.ts
│   │   ├── service/
│   │   │   └── service.entity.ts
│   │   ├── client/
│   │   │   └── client.entity.ts
│   │   ├── review/
│   │   │   └── review.entity.ts
│   │   ├── services/                  # Domain Services (чистые функции)
│   │   │   └── slot-calculator.ts     # generateAvailableSlots() — нет I/O
│   │   └── ports/                     # Port-интерфейсы (контракты)
│   │       ├── booking.repo.port.ts   # IBookingRepository
│   │       ├── master.repo.port.ts    # IMasterRepository
│   │       ├── notification.port.ts   # INotificationPort
│   │       ├── file-storage.port.ts   # IFileStoragePort
│   │       └── event-bus.port.ts      # IEventBus
│   │
│   ├── use-cases/                     # USE CASES — оркестрация через Ports
│   │   ├── create-booking/
│   │   │   ├── create-booking.use-case.ts
│   │   │   └── create-booking.types.ts
│   │   ├── cancel-booking/
│   │   │   └── cancel-booking.use-case.ts
│   │   ├── confirm-booking/
│   │   │   └── confirm-booking.use-case.ts
│   │   ├── get-available-slots/
│   │   │   └── get-available-slots.use-case.ts
│   │   ├── reschedule-booking/
│   │   │   └── reschedule-booking.use-case.ts
│   │   ├── manage-service/
│   │   │   ├── create-service.use-case.ts
│   │   │   └── update-service.use-case.ts
│   │   └── manage-schedule/
│   │       └── update-schedule.use-case.ts
│   │
│   ├── adapters/                      # INTERFACE ADAPTERS — перевод форматов
│   │   ├── http/                      # HTTP Controllers (Fastify route handlers)
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── auth.schema.ts     # Zod валидация
│   │   │   ├── catalog/
│   │   │   │   ├── catalog.controller.ts
│   │   │   │   └── catalog.routes.ts
│   │   │   ├── bookings/
│   │   │   │   ├── bookings.controller.ts
│   │   │   │   ├── bookings.routes.ts
│   │   │   │   └── bookings.schema.ts
│   │   │   ├── masters/
│   │   │   │   ├── masters.controller.ts
│   │   │   │   ├── masters.routes.ts
│   │   │   │   └── masters.schema.ts
│   │   │   ├── services/
│   │   │   │   ├── services.controller.ts
│   │   │   │   ├── services.routes.ts
│   │   │   │   └── services.schema.ts
│   │   │   ├── schedules/
│   │   │   │   ├── schedules.controller.ts
│   │   │   │   └── schedules.routes.ts
│   │   │   ├── reviews/
│   │   │   │   ├── reviews.controller.ts
│   │   │   │   └── reviews.routes.ts
│   │   │   ├── gallery/
│   │   │   │   ├── gallery.controller.ts
│   │   │   │   └── gallery.routes.ts
│   │   │   └── admin/
│   │   │       ├── admin.controller.ts
│   │   │       └── admin.routes.ts
│   │   └── repositories/              # Реализации IRepository портов
│   │       ├── postgres-booking.repo.ts   # implements IBookingRepository
│   │       ├── postgres-master.repo.ts    # implements IMasterRepository
│   │       ├── postgres-service.repo.ts
│   │       ├── postgres-review.repo.ts
│   │       └── postgres-gallery.repo.ts
│   │
│   ├── infrastructure/                # FRAMEWORKS & DRIVERS — внешние системы
│   │   ├── postgres/
│   │   │   ├── pool.ts                # pg Pool singleton
│   │   │   └── migrations/
│   │   │       ├── 001_initial.sql
│   │   │       ├── 002_indexes.sql
│   │   │       └── 003_rls.sql
│   │   ├── redis/
│   │   │   └── client.ts              # Redis client singleton
│   │   ├── telegram/
│   │   │   ├── bot.ts                 # Grammy bot instance
│   │   │   ├── telegram-auth.ts       # verifyInitData() HMAC
│   │   │   └── notification-adapter.ts  # implements INotificationPort
│   │   ├── storage/
│   │   │   └── s3-adapter.ts          # implements IFileStoragePort
│   │   ├── queue/
│   │   │   ├── notification.queue.ts  # BullMQ Queue setup
│   │   │   └── notification.worker.ts # BullMQ Worker
│   │   └── event-handlers/
│   │       └── notification.event-handler.ts  # подписчик на Domain Events
│   │
│   └── shared/                        # Утилиты без бизнес-логики
│       ├── middleware/
│       │   ├── authenticate.ts        # JWT → req.user
│       │   ├── rbac.ts                # requireRole(), requireOwner()
│       │   └── error-handler.ts
│       ├── errors/
│       │   └── app-errors.ts          # NotFoundError, ConflictError, ForbiddenError
│       ├── types/
│       │   ├── user.types.ts
│       │   └── fastify.d.ts           # augments request.user
│       └── config/
│           └── env.ts                 # валидация всех env vars через Zod
│
├── app.ts                             # Fastify instance + регистрация роутов + DI
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

### Почему Clean Architecture + вертикальные срезы лучше горизонтальных слоёв для ИИ

```
❌ Горизонтальные слои (нарушают Dependency Rule, плохо для ИИ):
   controllers/masterController.ts
   services/masterService.ts
   repositories/masterRepository.ts
   models/Master.ts
   → добавить одну фичу = трогать файлы в 5 разных папках

✅ Clean Architecture + вертикальные срезы (хорошо для ИИ):
   use-cases/manage-schedule/
     update-working-hours.use-case.ts  (40 строк — чистая оркестрация)
   adapters/http/schedules/
     schedules.controller.ts           (20 строк — HTTP ↔ Use Case)
     schedules.schema.ts               (15 строк — Zod-валидация)
   → добавить одну фичу = 1 use-case файл + 1 строка в controller
```

### Шаблон: Use Case (`use-cases/verb-noun/verb-noun.use-case.ts`)

```typescript
// use-cases/create-booking/create-booking.use-case.ts
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';
import type { IMasterRepository }   from '@/domain/ports/master.repo.port';
import type { IEventBus }           from '@/domain/ports/event-bus.port';
import type { Booking }             from '@/domain/booking/booking.entity';

export type CreateBookingInput = {
  masterId:  string;
  serviceId: string;
  startTime: Date;
  clientId:  string;
};

// Результат — union type, не throw. ИИ видит все исходы явно.
export type CreateBookingResult =
  | { ok: true;  booking: Booking }
  | { ok: false; reason: 'master_not_found' | 'slot_taken' | 'service_not_found' };

export class CreateBookingUseCase {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly masterRepo:  IMasterRepository,
    private readonly eventBus:    IEventBus,
  ) {}

  async execute(input: CreateBookingInput): Promise<CreateBookingResult> {
    const master = await this.masterRepo.findById(input.masterId);
    if (!master) return { ok: false, reason: 'master_not_found' };

    const booking = await this.bookingRepo.create(input);
    // Error 23P01 (EXCLUDE GIST) пробрасывается наверх, ловится в Controller

    await this.eventBus.publish({ type: 'BookingConfirmed', payload: { booking } });
    return { ok: true, booking };
  }
}
```

### Шаблон: Schema (`adapters/http/bookings/create-booking.schema.ts`)

```typescript
// adapters/http/bookings/create-booking.schema.ts
import { z } from 'zod';

export const CreateBookingBodySchema = z.object({
  masterId:  z.string().uuid(),
  serviceId: z.string().uuid(),
  startTime: z.string().datetime().transform((s) => new Date(s)),
});

export type CreateBookingBody = z.infer<typeof CreateBookingBodySchema>;
```

### Шаблон: Controller (`adapters/http/bookings/bookings.controller.ts`)

```typescript
// adapters/http/bookings/bookings.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { CreateBookingUseCase }         from '@/use-cases/create-booking/create-booking.use-case';
import { PostgresBookingRepository }    from '@/adapters/repositories/postgres-booking.repo';
import { PostgresMasterRepository }     from '@/adapters/repositories/postgres-master.repo';
import { pool }                         from '@/infrastructure/postgres/pool';
import { eventBus }                     from '@/infrastructure/event-bus';
import { ConflictError }                from '@/shared/errors/app-errors';
import type { CreateBookingBody }        from './create-booking.schema';

export async function createBookingController(
  req: FastifyRequest<{ Body: CreateBookingBody }>,
  reply: FastifyReply,
) {
  const useCase = new CreateBookingUseCase(
    new PostgresBookingRepository(pool),
    new PostgresMasterRepository(pool),
    eventBus,
  );

  try {
    const result = await useCase.execute({ ...req.body, clientId: req.user.userId });
    if (!result.ok) return reply.status(400).send({ error: result.reason });
    return reply.status(201).send(result.booking);
  } catch (err: any) {
    if (err.code === '23P01') throw new ConflictError('Slot is no longer available');
    throw err;
  }
}
```

### Шаблон: Routes (`adapters/http/bookings/bookings.routes.ts`)

```typescript
// adapters/http/bookings/bookings.routes.ts
import type { FastifyInstance }    from 'fastify';
import { CreateBookingBodySchema } from './create-booking.schema';
import { createBookingController } from './bookings.controller';

export async function bookingsRoutes(app: FastifyInstance) {
  app.post('/api/v1/bookings', {
    preHandler: [app.authenticate],
    schema: { body: CreateBookingBodySchema },
    handler: createBookingController,
  });
}
```

### Правило добавления новой фичи

```
Новая фича = новый Use Case + при необходимости endpoint в Controller.
Существующие файлы НЕ трогаются.

До:
  use-cases/create-booking/   ← не трогать
  use-cases/cancel-booking/   ← не трогать

После добавления "get-available-slots":
  use-cases/create-booking/        ← не тронуто
  use-cases/cancel-booking/        ← не тронуто
  use-cases/get-available-slots/   ← новая папка

  adapters/http/schedules/schedules.routes.ts  ← добавить ОДНУ строку роута
  app.ts  ← зарегистрировать plugin если новый routes-файл
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

## 14. Observability

### Логирование (Pino)

```typescript
// shared/logger.ts
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['req.headers.authorization', 'body.token'],  // не логировать секреты
});

// Структурированный лог каждого запроса:
// { level: 'info', reqId: 'abc123', method: 'POST', url: '/api/v1/bookings',
//   userId: 'uuid', duration: 42, statusCode: 201 }
```

**Правила логирования:**
- Каждый Use Case логирует `{ useCase, userId, input summary }` на уровне `info`
- Ошибки логируются с `err.stack` + контекст запроса
- Нет PII в логах (имена, телефоны, telegram_id — только хэш или `[redacted]`)

### Health Endpoints

```
GET /health   → { status: 'ok', uptime: 123 }
              (без проверки зависимостей — для load balancer liveness probe)

GET /ready    → { status: 'ok' | 'degraded', checks: {
                  postgres: 'ok' | 'fail',
                  redis: 'ok' | 'fail',
                } }
              (проверяет зависимости — для Kubernetes readiness probe)
```

### Error Tracking

Структурированные ошибки — единый формат HTTP ответа:
```json
{ "error": { "code": "SLOT_TAKEN", "message": "Slot is no longer available" } }
```

Уровни: `AppError` (ожидаемые) vs `UnexpectedError` (500, алёртинг).

---

## 15. Resilience

### Telegram API — retry с exponential backoff

Grammy встроенный retry для временных ошибок (rate limit, network).  
Дополнительно: при `429 Too Many Requests` — читать `Retry-After` header.

```typescript
// infrastructure/telegram/bot.ts
bot.catch((err) => {
  logger.error({ err }, 'Grammy unhandled error');
  // Не крашить процесс — Grammy сам retry-ит временные ошибки
});
```

### PostgreSQL — connection pool exhaustion

```typescript
// infrastructure/postgres/pool.ts
const pool = new Pool({
  max: 20,            // максимум соединений
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,  // не ждать вечно → 503 быстро
});
// При connectionTimeoutMillis истёк → PoolError → HTTP 503 Service Unavailable
```

### Redis — graceful degradation

Redis используется для:
1. BullMQ очереди уведомлений — при падении Redis уведомления буферизируются в памяти (BullMQ default), при reconnect обрабатываются
2. Idempotency-Key кэш — при недоступности Redis: пропускать idempotency check (допустить повтор) вместо отказа в обслуживании
3. Кэш доступных слотов — при недоступности Redis: fallback на прямой DB запрос

```typescript
// Паттерн: Redis как оптимизация, не как обязательная зависимость
async function getCachedSlots(key: string, fallback: () => Promise<Slot[]>) {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch { /* Redis down — fallback to DB */ }
  return fallback();
}
```

### Telegram Bot при недоступности

Если отправка уведомления не удалась после 3 retry:
- Записать `notification_log.status = 'failed'`
- Не крашить booking flow — запись создана успешно
- Ретроспективный повтор: cron каждые 15 мин проверяет `status = 'failed'`

---

## 16. Testing Strategy

### Принцип: тестировать по слоям

| Слой | Тип теста | Инструмент | Что проверяем |
|---|---|---|---|
| **Domain** | Unit | Vitest | SlotCalculator, BookingStatus transitions — чистые функции, 0 зависимостей |
| **Use Cases** | Unit (с моками портов) | Vitest | Оркестрация, бизнес-правила, события |
| **Adapters / Repos** | Integration | Vitest + testcontainers | SQL-запросы против реального PostgreSQL |
| **HTTP** | Contract | Vitest + supertest | API endpoints — статусы, схемы ответов |
| **E2E** | только критический путь | Playwright | booking flow от каталога до записи |

### Пример: Unit-тест Domain Service

```typescript
// domain/services/slot-calculator.test.ts
import { generateAvailableSlots } from './slot-calculator';

test('returns empty when master has no working hours', () => {
  const slots = generateAvailableSlots(null, [], 60, 0);
  expect(slots).toEqual([]);
});

test('excludes slots overlapping with confirmed bookings', () => {
  const workingHours = { start: '09:00', end: '18:00' };
  const booked = [{ start: new Date('2026-06-01T10:00Z'), end: new Date('2026-06-01T11:00Z') }];
  const slots = generateAvailableSlots(workingHours, booked, 60, 0);
  expect(slots.some(s => s.start.getHours() === 10)).toBe(false);
});
```

### Пример: Unit-тест Use Case (с моком порта)

```typescript
// use-cases/create-booking/create-booking.use-case.test.ts
import { CreateBookingUseCase } from './create-booking.use-case';

test('publishes BookingConfirmed event on success', async () => {
  const bookingRepo = { create: vi.fn().mockResolvedValue(mockBooking), findById: vi.fn() } as any;
  const masterRepo  = { findById: vi.fn().mockResolvedValue(mockMaster) } as any;
  const eventBus    = { publish: vi.fn() } as any;

  const useCase = new CreateBookingUseCase(bookingRepo, masterRepo, eventBus);
  await useCase.execute({ masterId: 'uuid', serviceId: 'uuid', startTime: new Date() });

  expect(eventBus.publish).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'BookingConfirmed' })
  );
});
```

### Правила

- Domain + Use Cases: 100% юнит-тесты, никаких моков DB
- Repositories: обязательно integration-тесты с реальным PostgreSQL (testcontainers)
- Нет тестов на конфигурацию фреймворков (Fastify plugin регистрация и т.п.)
- CI: unit + integration тесты; E2E — только на staging

---

## Итоговые решения (Decision Log)

| Решение | Выбор | Обоснование |
|---|---|---|
| Мультитенантность | Shared DB + `master_id` FK | 100–1000 мастеров, единые миграции, Fresha/Booksy/StyleSeat так начинали |
| Защита от двойного бронирования | EXCLUDE GIST (первичная) + SELECT FOR UPDATE (вторичная) | Database-enforced, 100% надёжно, без доп. инфраструктуры |
| Вычисление слотов | On-demand из расписания минус бронирования | Нет миллиона строк pre-generated slots; Cal.com-паттерн |
| Расписание | Двухуровневое: weekly_template + overrides | Cal.com доказал; чисто обрабатывает исключения |
| Уведомления | BullMQ + Redis с delayed jobs | Персистентно, jobId для отмены, выживает перезапуск |
| Backend структура | Clean Architecture: domain → use-cases → adapters → infrastructure | Dependency Rule соблюдён; AI знает где что лежит |
| Frontend структура | Feature-Sliced Design 4-слойный | Изолированные фичи, AI может добавить без риска регрессии |
| Клиент/Мастер в одном приложении | RoleGate (один TMA URL, роль с бэкенда) | Один деплой, одна ссылка, роль через JWT |
| ORM vs raw SQL | Raw SQL в repositories | AI читает SQL лучше ORM-магии, нет hidden N+1 |
| HTTP-фреймворк | Fastify | Лучше TypeScript, быстрее Express, schema validation встроена |
| Bot-фреймворк | Grammy | Лучшая TypeScript поддержка 2025-2026 |
| Навигация TMA | MemoryRouter + initNavigator SDK | Нет проблем с WebView history API |
| booking_status | VARCHAR(20) + CHECK | OCP: новый статус = ALTER TABLE CHECK, не DROP/CREATE TYPE |
| Notifications isolation | Domain Events (IEventBus) | Use Cases не знают про BullMQ; смена очереди не трогает бизнес-логику |
| API versioning | `/api/v1/` префикс | Breaking change не ломает старых клиентов |
| Idempotency | `Idempotency-Key` header + Redis кэш | Защита от двойной записи при сетевом retry |
