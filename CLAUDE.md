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

## Архитектура backend: Clean Architecture (4 слоя)

**Dependency Rule:** зависимости только ВНУТРЬ. Domain ← Use Cases ← Adapters ← Infrastructure.

```
src/
├── domain/          ← ЯДРО: Entities, Value Objects, Port-интерфейсы, Domain Services
│   ├── booking/     ← booking.entity.ts, booking.events.ts
│   ├── master/
│   ├── ports/       ← IBookingRepository, INotificationPort, IFileStoragePort, IEventBus
│   └── services/    ← slot-calculator.ts (чистая функция — нет I/O)
│
├── use-cases/       ← ОРКЕСТРАЦИЯ через Ports, нет SQL и HTTP
│   ├── create-booking/create-booking.use-case.ts
│   ├── cancel-booking/cancel-booking.use-case.ts
│   └── get-available-slots/get-available-slots.use-case.ts
│
├── adapters/        ← ПЕРЕВОД ФОРМАТОВ: HTTP Controllers + Repo implementations
│   ├── http/        ← Fastify controllers + routes + Zod schemas
│   └── repositories/← postgres-booking.repo.ts implements IBookingRepository
│
└── infrastructure/  ← ВНЕШНИЕ СИСТЕМЫ: pg Pool, Redis, Grammy, S3, BullMQ
    ├── postgres/
    ├── redis/
    ├── telegram/    ← notification-adapter.ts implements INotificationPort
    ├── storage/
    ├── queue/
    └── event-handlers/  ← подписчики на Domain Events → BullMQ jobs
```

**Правило добавления фичи:**
1. Use Case (`use-cases/verb-noun/`) — оркестрация через Port-интерфейсы
2. Controller (`adapters/http/noun/`) — перевод HTTP ↔ Use Case DTO
3. Repo (если нужно) — `adapters/repositories/postgres-noun.repo.ts`
4. Зарегистрировать в `app.ts`

## Архитектура frontend: Feature-Sliced Design (4 слоя)

```
app/       → pages/     → features/    → entities/    → shared/
```

Импорт только ВНИЗ по иерархии. Никогда вверх и никогда в сторону (features/A ≠ features/B).

## Именование файлов

```
Паттерн: [verb-noun].[type].ts

create-booking.use-case.ts   ← Use Case (оркестрация)
bookings.controller.ts       ← HTTP Controller (adapter)
postgres-booking.repo.ts     ← Repository (infrastructure adapter)
booking.entity.ts            ← Domain Entity
booking.repo.port.ts         ← Port Interface (IBookingRepository)
booking.events.ts            ← Domain Events
create-booking.schema.ts     ← Zod-схема (в adapters/http/)
```

## Импорты (path aliases, всегда)

```typescript
import { X } from '@/domain/booking';        // ✅
import { X } from '@/use-cases/create-booking'; // ✅
import { X } from '../../../domain/...';     // ✗ никогда
```

Aliases: `@/domain/`, `@/use-cases/`, `@/adapters/`, `@/infrastructure/`, `@/shared/`

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
Файл схемы:   src/infrastructure/postgres/migrations/001_initial.sql
Pool:         src/infrastructure/postgres/pool.ts (pg Pool singleton)
Запросы:      ТОЛЬКО в adapters/repositories/*.repo.ts, нигде больше
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
Port:      src/domain/ports/notification.port.ts → INotificationPort
Adapter:   src/infrastructure/telegram/notification-adapter.ts (реализует Port)
Очередь:   src/infrastructure/queue/notification.queue.ts (BullMQ)
Worker:    src/infrastructure/queue/notification.worker.ts
Триггер:   src/infrastructure/event-handlers/notification.event-handler.ts
           (подписчик на Domain Events, Use Cases не трогает напрямую очередь)
jobId:     'reminder_24h_{bookingId}', 'reminder_2h_{bookingId}'

При отмене/переносе — Use Case публикует BookingCancelled event →
  event-handler удаляет pending jobs через notificationQueue
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

- SQL-запросы вне `adapters/repositories/*.repo.ts`
- HTTP-объекты (req/res) вне `adapters/http/*.controller.ts`
- Domain / Use Cases не импортируют из `infrastructure/` или `adapters/http/`
- `window.Telegram.WebApp` вне `src/shared/lib/telegram.ts` (frontend)
- Импорты между features на одном уровне (FSD)
- `export * from` (только явные named exports)
- Файл > 200 строк — разбить на два
- `fetch()` в React-компонентах — только через TanStack Query hooks
- `master_id` из `req.body` — только из `req.user.masterId`
- Use Case напрямую вызывает `notificationQueue` — только через `IEventBus`

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
