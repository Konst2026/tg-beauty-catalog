# TG Beauty Marketplace — AI Development Guide

## Что это за проект

Telegram Mini App — маркетплейс бьюти-мастеров. Один бот, много мастеров.
Клиент: открывает бота → видит каталог мастеров → выбирает → записывается.
Мастер: регистрируется → ведёт профиль (услуги, расписание, галерея) → получает записи.

Роли: `client` | `master` | `admin`

## Стек

```
Backend:   Node.js 22 + TypeScript (strict) + Fastify 5 + Grammy (Telegram bot)
Database:  PostgreSQL 16 + btree_gist + raw SQL (не ORM)
Queue:     BullMQ + Redis 7
Frontend:  React 18 + TypeScript + Vite + @telegram-apps/sdk + TanStack Query + Zustand
Hosting:   Vercel (frontend) + Railway/VPS (backend)
```

## Архитектура backend: вертикальные срезы

Каждый use case — отдельная папка `src/features/[domain]/[verb-noun]/`.

```
features/
├── catalog/
│   └── list-masters/
│       ├── list-masters.route.ts    ← только регистрация роута (30 строк макс)
│       ├── list-masters.schema.ts   ← Zod-схемы (50 строк макс)
│       ├── list-masters.handler.ts  ← бизнес-логика (80 строк макс)
│       └── list-masters.test.ts     ← тесты рядом с кодом
├── booking/
│   ├── create-booking/
│   ├── cancel-booking/
│   └── get-available-slots/
└── master-profile/
    ├── create-service/
    └── update-working-hours/
```

**Правило добавления фичи:** создай новую папку, добавь одну строку в `app/routes.ts`. Существующие файлы НЕ трогать.

## Архитектура frontend: Feature-Sliced Design (4 слоя)

```
app/       → pages/     → features/    → entities/    → shared/
```

Импорт только ВНИЗ по иерархии. Никогда вверх и никогда в сторону (features/A ≠ features/B).

## Именование файлов

```
Паттерн: [verb-noun].[type].ts

create-booking.handler.ts    ← бизнес-логика
create-booking.schema.ts     ← Zod-схема
create-booking.route.ts      ← регистрация роута
create-booking.types.ts      ← TypeScript типы
masters.repo.ts               ← SQL-запросы к masters
```

## Импорты (path aliases, всегда)

```typescript
import { X } from '@/entities/booking';     // ✅
import { X } from '../../../entities/...';  // ✗ никогда
```

Aliases: `@/features/`, `@/entities/`, `@/shared/`, `@/app/`

## Безопасность

```typescript
// initData ВСЕГДА верифицируется HMAC на каждый запрос
// файл: src/shared/lib/telegram-auth.ts → verifyInitData()

// master_id берётся только из JWT, НИКОГДА из req.body
const masterId = req.user.masterId; // ✅
const masterId = req.body.masterId; // ✗

// UUID = публичный ID (в URL, в Telegram), integer = внутренний
```

## База данных

```
Файл схемы:   src/shared/db/migrations/001_initial.sql
Pool:         src/shared/db/pool.ts (pg Pool singleton)
Запросы:      ТОЛЬКО в *.repo.ts файлах, нигде больше
Транзакции:   явные BEGIN/COMMIT/ROLLBACK через pool.connect()
```

**Защита от двойного бронирования:**
```sql
-- Уже в схеме, не трогать:
EXCLUDE USING GIST (master_id WITH =, tstzrange(start_time, end_time,'[)') WITH &&)
WHERE (status IN ('CONFIRMED','PENDING'))
-- Error code 23P01 = слот занят → поймать в route → вернуть 409
```

**Добавление колонки = новый файл миграции** `src/shared/db/migrations/NNN_description.sql`

## Уведомления

```
Очередь:   src/features/notifications/notification.queue.ts (BullMQ)
Worker:    src/features/notifications/notification.worker.ts
jobId:     'reminder_24h_{bookingId}', 'reminder_2h_{bookingId}'

При отмене/переносе записи — удалить pending jobs:
  await notificationQueue.getJob(`reminder_24h_${id}`)?.then(j => j?.remove())
  await notificationQueue.getJob(`reminder_2h_${id}`)?.then(j => j?.remove())
```

## Telegram API (frontend)

```typescript
// ВСЕГДА только через обёртку, НИКОГДА напрямую
import { tg } from '@/shared/lib/telegram';  // ✅
window.Telegram.WebApp.MainButton.show();     // ✗

// Доступные методы:
tg.expand()           // при старте — всегда
tg.ready()            // при монтировании — всегда
tg.setMainButton(text, fn)
tg.hideMainButton()
tg.showBackButton()
tg.hideBackButton()
tg.hapticSuccess()
tg.hapticError()
tg.showConfirm(msg)
tg.enableClosingConfirmation()  // на экране итога и оплаты
```

## Стейт (frontend)

```
TanStack Query — весь серверный стейт (каталог, записи, профиль)
Zustand        — только UI-стейт без TTL:
  bookingFlowStore  (selectedService, selectedSlot, шаги booking)
  telegramStore     (user из initData)
  filtersStore      (активные фильтры каталога)

Нельзя хранить серверные данные в Zustand — только в TanStack Query cache.
```

## Нельзя никогда

- SQL-запросы вне `*.repo.ts`
- HTTP-объекты (req/res) вне `*.handler.ts` / `*.route.ts`
- `window.Telegram.WebApp` вне `src/shared/lib/telegram.ts`
- Импорты между features на одном уровне
- `export * from` (только явные named exports)
- Файл > 200 строк — разбить на два
- `fetch()` в React-компонентах — только через TanStack Query hooks
- `master_id` из `req.body` — только из `req.user.masterId`

## Команды

```bash
npm run dev          # запустить backend dev-сервер
npm run frontend     # запустить frontend (Vite)
npm run test         # все тесты (Vitest)
npm run db:migrate   # применить миграции
npm run lint         # ESLint + tsc
docker-compose up    # postgres + redis локально
```

## Документация проекта

- [Architecture.md](Architecture.md) — полная архитектура, схема БД, все решения
- [research.md](research.md) — исследование конкурентов, UX-паттерны
- [ai-friendly-architecture.md](ai-friendly-architecture.md) — подробные принципы AI-разработки
