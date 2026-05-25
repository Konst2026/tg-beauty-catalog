# BACKEND-PLAN.md — BeautyBook SaaS Platform

> Бэкенд-архитектор. Составлено после изучения research.md, Architecture.md, всего кода проекта и уточняющих вопросов.  
> Версия: 2026-05-23

---

## Что строим: одна фраза

**SaaS-платформа**: каждый бьюти-мастер подключает свой бот, получает изолированный кабинет, своих клиентов видят только его услуги, бот сам отвечает на вопросы и принимает записи, расписание управляется встроенным календарём приложения. 2 месяца бесплатно, затем подписка.

---

## Ответы на ключевые вопросы архитектуры

| Вопрос | Решение |
|---|---|
| Свой бот для мастера | Мастер создаёт бота в @BotFather, вставляет token в кабинет. Платформа управляет всеми токенами |
| Freemium | 2 месяца полный доступ бесплатно, затем подписка. Без функциональных ограничений |
| AI-консультант | FAQ по данным мастера + запись через диалог без Mini App |
| Оплата | Только подписка мастера. Клиентские платежи — между мастером и клиентом напрямую |
| Календарь | Встроенный в приложение: недельный шаблон, блокировка дат, просмотр записей |

---

## 1. Модель данных (Supabase — управляемый PostgreSQL)

> Supabase предоставляет PostgreSQL 15 с полной поддержкой расширений.
> Все расширения включаются в Dashboard → Database → Extensions:
> - `btree_gist` — защита от двойного бронирования (EXCLUDE GIST)
> - `pgcrypto` — шифрование bot_token
>
> SQL-схема, миграции и raw-запросы работают без каких-либо изменений.

### 1.1 Мастера (основной tenant)

```sql
CREATE TABLE masters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id         BIGINT UNIQUE NOT NULL,         -- TG ID мастера
  username            VARCHAR(100),
  full_name           VARCHAR(200) NOT NULL,
  phone               VARCHAR(30),

  -- Профиль (видно клиентам)
  bio                 TEXT,
  specialty           VARCHAR(200),
  category_id         UUID REFERENCES categories(id),
  city                VARCHAR(100),
  avatar_url          TEXT,
  promo_text          VARCHAR(44),
  available_today     BOOLEAN NOT NULL DEFAULT false,
  rating              NUMERIC(3,2) DEFAULT 0.00,
  review_count        INTEGER DEFAULT 0,

  -- White-label бот
  bot_token           TEXT,                           -- зашифровано (pgcrypto)
  bot_username        VARCHAR(100),                   -- @MariaNailsBot
  bot_webhook_secret  VARCHAR(64),                    -- HMAC-секрет для верификации webhook

  -- Тема приложения
  theme_primary_color VARCHAR(7) DEFAULT '#E8B4B8',   -- hex
  theme_logo_url      TEXT,
  theme_name          VARCHAR(100),

  -- Подписка
  plan                VARCHAR(20) NOT NULL DEFAULT 'trial'
                        CHECK (plan IN ('trial', 'active', 'expired')),
  trial_ends_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 months'),
  plan_paid_until     TIMESTAMPTZ,
  subscription_price  NUMERIC(10,2) DEFAULT 990.00,  -- ₽/мес

  -- AI
  ai_system_prompt    TEXT,                           -- кастомный промпт мастера для AI

  is_published        BOOLEAN NOT NULL DEFAULT false, -- виден в каталоге
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_masters_tg ON masters(telegram_id);
CREATE INDEX idx_masters_category ON masters(category_id) WHERE is_published = true;
```

### 1.2 Категории

```sql
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       VARCHAR(50) UNIQUE NOT NULL,  -- 'nails', 'lashes', 'brows', 'hair'
  name       VARCHAR(100) NOT NULL,
  emoji      VARCHAR(10),
  sort_order INTEGER DEFAULT 0
);
-- Начальные данные: nails, lashes, brows, hair
```

### 1.3 Услуги мастера

```sql
CREATE TABLE services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id    UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0),
  price        NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  photo_url    TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_master ON services(master_id) WHERE is_active = true;
```

### 1.4 Расписание мастера

```sql
-- Недельный шаблон
CREATE TABLE schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id    UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working   BOOLEAN NOT NULL DEFAULT true,
  start_time   TIME,
  end_time     TIME,
  UNIQUE(master_id, day_of_week)
);

-- Переопределение конкретной даты (отпуск, особые часы)
CREATE TABLE schedule_overrides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id      UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  override_date  DATE NOT NULL,
  is_working     BOOLEAN NOT NULL DEFAULT false,
  start_time     TIME,
  end_time       TIME,
  reason         VARCHAR(200),
  UNIQUE(master_id, override_date)
);
```

### 1.5 Бронирования (защита от двойной записи на уровне БД)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id           UUID NOT NULL REFERENCES masters(id),
  service_id          UUID NOT NULL REFERENCES services(id),
  client_telegram_id  BIGINT NOT NULL,
  client_name         VARCHAR(200),
  client_phone        VARCHAR(30),
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  -- pending = слот зарезервирован во время AI-диалога (TTL 10 мин)
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  expires_at          TIMESTAMPTZ,    -- для pending: now() + 10 min; для confirmed: NULL
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        VARCHAR(10) CHECK (cancelled_by IN ('client','master','system')),
  notes               TEXT,
  price_snapshot      NUMERIC(10,2) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),

  -- Абсолютная защита от двойного бронирования (pending резервирует слот на время диалога)
  EXCLUDE USING GIST (
    master_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status IN ('confirmed', 'pending'))
);

CREATE INDEX idx_bookings_master_active
  ON bookings(master_id, start_time)
  WHERE status = 'confirmed';
CREATE INDEX idx_bookings_client
  ON bookings(client_telegram_id, master_id, created_at DESC);
```

### 1.6 Клиенты мастера (CRM)

```sql
CREATE TABLE master_clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id           UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  telegram_id         BIGINT NOT NULL,
  name                VARCHAR(200),
  phone               VARCHAR(30),
  notes               TEXT,
  tags                TEXT[],
  visit_count         INTEGER DEFAULT 0,
  total_spent         NUMERIC(10,2) DEFAULT 0,
  last_visit_at       TIMESTAMPTZ,
  first_visit_at      TIMESTAMPTZ,
  UNIQUE(master_id, telegram_id)
);
CREATE INDEX idx_clients_master ON master_clients(master_id, last_visit_at DESC);
```

### 1.7 Галерея работ

```sql
CREATE TABLE gallery (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.8 Отзывы

```sql
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) UNIQUE,
  master_id   UUID NOT NULL REFERENCES masters(id),
  client_telegram_id BIGINT NOT NULL,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_master ON reviews(master_id, created_at DESC);
```

### 1.9 AI-диалоги (контекст чата для каждого клиента)

```sql
CREATE TABLE ai_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id           UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  client_telegram_id  BIGINT NOT NULL,
  messages            JSONB NOT NULL DEFAULT '[]',  -- [{role, content, ts}]
  state               VARCHAR(50) DEFAULT 'idle',   -- 'idle', 'booking_flow', 'confirmed'
  booking_draft       JSONB,                        -- черновик записи в процессе диалога
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(master_id, client_telegram_id)
);
```

### 1.10 Платежи за подписку

```sql
CREATE TABLE subscription_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id       UUID NOT NULL REFERENCES masters(id),
  amount          NUMERIC(10,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'RUB',
  provider        VARCHAR(50),                -- 'manual', 'tg_stars', 'yukassa'
  provider_tx_id  VARCHAR(200),
  period_from     TIMESTAMPTZ NOT NULL,
  period_to       TIMESTAMPTZ NOT NULL,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.11 Лог уведомлений

```sql
CREATE TABLE notification_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID REFERENCES masters(id),
  booking_id  UUID REFERENCES bookings(id),
  telegram_id BIGINT NOT NULL,
  type        VARCHAR(50) NOT NULL,   -- 'booking_confirmed', 'reminder_24h', 'reminder_2h', 'booking_cancelled'
  status      VARCHAR(20) DEFAULT 'sent',
  error       TEXT,
  sent_at     TIMESTAMPTZ DEFAULT now()
);
```

---

## 2. Кто что видит и редактирует

| Данные | Клиент (читает) | Мастер (читает + пишет) | Платформа/Система |
|---|---|---|---|
| Профиль мастера (имя, биография, категория) | ✅ публично | ✅ редактирует | — |
| Услуги мастера | ✅ публично | ✅ CRUD | — |
| Расписание (слоты) | ✅ доступные слоты | ✅ полное управление | — |
| Бронирования | Только свои | Все свои | Системные операции |
| Клиентская база | ❌ | ✅ только своих | — |
| Галерея | ✅ публично | ✅ CRUD | — |
| Отзывы | ✅ публично | Читает | Модерация |
| Токен бота | ❌ | Вводит, не читает | Хранит зашифровано |
| Расписание / блокировки | ❌ | ✅ управляет | — |
| Тема приложения | Видит результат | ✅ настраивает | — |
| Подписка / план | ❌ | Видит статус | Обновляет |
| AI-диалог | Ведёт диалог | Видит историю | Обрабатывает |
| Другие мастера | ✅ публичный профиль | ❌ | — |

---

## 3. API — полный список эндпоинтов

### 3.1 Публичные (без авторизации)

```
GET  /api/v1/catalog                    Список опубликованных мастеров
                                         ?category=&city=&available_today=&page=&limit=
GET  /api/v1/masters/:master_id          Публичный профиль мастера (услуги, галерея, отзывы)
GET  /api/v1/masters/:master_id/slots    Свободные слоты
                                         ?date=YYYY-MM-DD&service_id=
GET  /api/v1/categories                  Список категорий
```

### 3.2 Авторизованные (Telegram initData HMAC)

Каждый запрос от Mini App включает заголовок `X-Telegram-Init-Data`. Бэкенд верифицирует HMAC с `BOT_TOKEN` конкретного мастера.

**Клиентские операции:**
```
POST /api/v1/bookings                   Создать запись
                                         Body: { master_id, service_id, start_time, client_name?, notes? }
GET  /api/v1/my/bookings                Мои записи (по client_telegram_id из initData)
POST /api/v1/bookings/:id/cancel        Отменить запись
POST /api/v1/bookings/:id/review        Оставить отзыв (только после completed)
```

**Кабинет мастера** (master_id берётся из initData, никогда из body):
```
GET  /api/v1/me                         Профиль мастера
PUT  /api/v1/me                         Обновить профиль
PUT  /api/v1/me/theme                   Обновить тему
POST /api/v1/me/gallery                 Загрузить фото (multipart)
DELETE /api/v1/me/gallery/:id           Удалить фото

GET  /api/v1/me/services                Список услуг
POST /api/v1/me/services                Создать услугу
PUT  /api/v1/me/services/:id            Обновить услугу
DELETE /api/v1/me/services/:id          Удалить услугу

GET  /api/v1/me/schedule                Расписание (все дни)
PUT  /api/v1/me/schedule                Обновить шаблон (bulk update)
POST /api/v1/me/schedule/overrides      Добавить блокировку даты
DELETE /api/v1/me/schedule/overrides/:id

GET  /api/v1/me/bookings                Записи ко мне (фильтр: ?status=&from=&to=)
PUT  /api/v1/me/bookings/:id/complete   Завершить запись
PUT  /api/v1/me/bookings/:id/no_show    Отметить no-show

GET  /api/v1/me/clients                 База клиентов
PUT  /api/v1/me/clients/:telegram_id    Обновить заметки/теги клиента

GET  /api/v1/me/analytics               Статистика (записи за период, выручка, no-show rate)
                                         ?from=&to=

GET  /api/v1/me/subscription            Текущий план, дата окончания
```

### 3.3 Подключение бота

```
POST /api/v1/me/bot/connect             Сохранить BOT_TOKEN
                                         Body: { token }
                                         → верифицирует через getMe, сохраняет, регистрирует webhook
DELETE /api/v1/me/bot/disconnect        Удалить токен, отключить webhook
```

### 3.4 Webhooks (системные)

```
POST /webhook/tg/:token_hash            Telegram webhook для бота мастера
                                         token_hash = sha256(bot_token) — без раскрытия токена в URL
POST /webhook/payments                  Уведомления платёжной системы (Stripe)
```

---

## 4. Архитектура multi-bot (один процесс — много ботов)

Проблема: у каждого мастера свой бот с отдельным токеном. Решение: один HTTP-сервер обрабатывает входящие для всех ботов.

```
Telegram → POST /webhook/tg/{token_hash}
                │
                ▼
        WebhookDispatcher
                │
     Ищет мастера по token_hash
                │
                ▼
     Grammy Bot Instance (lazy-created per master)
                │
        ┌───────┴────────┐
        ▼                ▼
   AI Handler      Booking Handler
  (FAQ + запись)   (кнопки, статусы)
```

**Grammy multi-bot:**
```typescript
// infrastructure/telegram/bot-manager.ts
import { LRUCache } from 'lru-cache'; // npm: lru-cache

// LRU: макс. 500 ботов, TTL 30 мин для неактивных
const bots = new LRUCache<string, Bot>({
  max: 500,
  ttl: 1000 * 60 * 30,
  dispose: (bot) => { /* Grammy не требует явного закрытия для webhook-режима */ },
});

async function getOrCreateBot(master: Master): Promise<Bot> {
  const cached = bots.get(master.id);
  if (cached) return cached;

  const bot = new Bot(decrypt(master.bot_token));
  // Проверяем токен живой, иначе выбросим до кэша
  await bot.api.getMe();
  setupHandlers(bot, master);
  bots.set(master.id, bot);
  return bot;
}

// При ошибке токена — удаляем из кэша (bot пересоздастся со свежими данными)
async function invalidateBot(masterId: string): Promise<void> {
  bots.delete(masterId);
}

// Webhook handler
app.post('/webhook/tg/:token_hash', async (req, res) => {
  const master = await masterRepo.findByTokenHash(req.params.token_hash);
  if (!master) return res.status(404).send();
  try {
    const bot = await getOrCreateBot(master);
    await bot.handleUpdate(req.body);
    res.status(200).send('ok');
  } catch (err) {
    if (isTokenInvalidError(err)) await invalidateBot(master.id);
    res.status(200).send('ok'); // Telegram требует 200 даже при ошибке
  }
});
```

**Регистрация webhook при подключении бота:**
```typescript
async function connectBot(master: Master, token: string): Promise<void> {
  const bot = new Bot(token);
  const me = await bot.api.getMe();              // верифицируем токен
  const tokenHash = sha256(token);
  const webhookUrl = `${PLATFORM_URL}/webhook/tg/${tokenHash}`;
  await bot.api.setWebhook(webhookUrl, {
    secret_token: master.bot_webhook_secret,     // дополнительная защита
  });
  await masterRepo.update(master.id, {
    bot_token: encrypt(token),
    bot_username: me.username,
    bot_webhook_secret: generateSecret(),
  });
}
```

---

## 5. AI-консультант

### 5.1 Системный промпт (строится динамически для каждого мастера)

```typescript
function buildSystemPrompt(master: Master, services: Service[], todaySlots: string[]): string {
  return `
Ты — AI-ассистент мастера ${master.full_name}.
Специализация: ${master.specialty}. Город: ${master.city}.

Услуги:
${services.map(s => `- ${s.name}: ${s.price} ₽, ${s.duration_min} мин`).join('\n')}

Свободные слоты сегодня: ${todaySlots.join(', ') || 'нет свободных слотов сегодня'}

${master.ai_system_prompt || ''}

Правила:
1. Отвечай только по теме услуг мастера.
2. Если клиент хочет записаться — веди через шаги: услуга → дата → время.
3. Когда собраны все данные — скажи: "Подтверждаю запись: [услуга] [дата] [время]. Всё верно?"
4. После подтверждения — ответь ТОЛЬКО JSON: {"action":"create_booking","service_id":"...","start_time":"ISO8601"}
5. Не выдумывай слоты — используй только те, что предоставлены.
`.trim();
}
```

### 5.2 Обработка входящего сообщения

```typescript
async function handleAiMessage(master: Master, clientTgId: bigint, text: string): Promise<string> {
  const conv = await getOrCreateConversation(master.id, clientTgId);
  const services = await serviceRepo.findByMaster(master.id);
  const slots = await slotService.getAvailableSlots(master.id, new Date());

  const messages = [
    { role: 'system', content: buildSystemPrompt(master, services, slots) },
    ...conv.messages.slice(-10),  // последние 10 сообщений для контекста
    { role: 'user', content: text },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',   // быстрый и дешёвый для диалогов
    max_tokens: 500,
    messages,
  });

  const assistantText = response.content[0].text;

  const bookingCmd = tryParseBookingCommand(assistantText);
  if (bookingCmd) {
    try {
      const booking = await bookingService.create({
        masterId: master.id,
        clientTelegramId: clientTgId,
        serviceId: bookingCmd.service_id,
        startTime: new Date(bookingCmd.start_time),
      });
      await appendMessage(conv.id, 'assistant', assistantText);
      return formatBookingConfirmation(booking, master);
    } catch (err) {
      // 23P01 = EXCLUDE GIST violation — слот занят
      if (err.code === '23P01') {
        const freeSlots = await slotService.getAvailableSlots(master.id, new Date(bookingCmd.start_time));
        const suggestion = freeSlots[0] ? `Ближайшее свободное время: ${freeSlots[0]}` : 'Свободных слотов в этот день нет.';
        return `К сожалению, это время уже занято. ${suggestion} Хотите записаться на другое время?`;
      }
      throw err;
    }
  }

  await appendMessage(conv.id, 'assistant', assistantText);
  return assistantText;
}

// Извлекает JSON-команду из ответа AI (LLM может обернуть в ```json ... ```)
function tryParseBookingCommand(text: string): { action: string; service_id: string; start_time: string } | null {
  // Убираем markdown-обёртку если есть
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  // Ищем первый JSON-объект с полем "action"
  const match = cleaned.match(/\{[^{}]*"action"\s*:\s*"create_booking"[^{}]*\}/);
  if (!match) return null;
  try {
    const cmd = JSON.parse(match[0]);
    if (cmd.action === 'create_booking' && cmd.service_id && cmd.start_time) return cmd;
  } catch { /* невалидный JSON */ }
  return null;
}
```

---

## 6. Встроенный календарь

Никаких внешних сервисов — всё хранится и управляется внутри платформы.

### 6.1 Источники данных для календаря

```
Что показывается в календаре мастера:

schedules          → рабочие часы по дням недели (недельный шаблон)
schedule_overrides → заблокированные/изменённые конкретные даты (отпуск, особые часы)
bookings           → подтверждённые и pending-записи клиентов
```

Три таблицы уже определены в разделах 1.4 и 1.5 — дополнительной схемы не нужно.

### 6.2 API календаря (добавить в раздел 3.2)

```
GET  /api/v1/me/calendar                Агрегированный вид для мастера
                                         ?from=YYYY-MM-DD&to=YYYY-MM-DD
                                         → { days: [{ date, isWorking, hours, bookings[], blockedSlots[] }] }

POST /api/v1/me/calendar/block          Заблокировать время вручную
                                         Body: { date, startTime?, endTime?, reason? }
                                         → создаёт schedule_override с is_working=false (или кастомными часами)

DELETE /api/v1/me/calendar/block/:id    Снять блокировку (удалить schedule_override)
```

Эндпоинты расписания уже есть в разделе 3.2 (`GET/PUT /api/v1/me/schedule`, `POST/DELETE /api/v1/me/schedule/overrides`) — `/calendar` это новый агрегирующий эндпоинт поверх них.

### 6.3 Логика slot-calculator (Domain Service, нет I/O)

```typescript
// domain/services/slot-calculator.ts
// Чистая функция — не знает о БД, HTTP, внешних сервисах

interface SlotCalculatorInput {
  schedule:  WeeklySchedule;       // из таблицы schedules
  overrides: ScheduleOverride[];   // из таблицы schedule_overrides
  bookings:  Booking[];            // confirmed + pending для диапазона дат
  serviceDuration: number;         // duration_min запрашиваемой услуги
  dateRange: { from: Date; to: Date };
}

function getAvailableSlots(input: SlotCalculatorInput): TimeSlot[] {
  const slots: TimeSlot[] = [];

  for (const date of eachDayInRange(input.dateRange)) {
    const override = input.overrides.find(o => isSameDay(o.override_date, date));
    const dayTemplate = input.schedule[date.getDay()];

    // Применяем override, если есть
    const dayConfig = override ?? dayTemplate;
    if (!dayConfig.is_working) continue;

    const workStart = parseTime(dayConfig.start_time);
    const workEnd   = parseTime(dayConfig.end_time);

    // Занятые интервалы = confirmed + pending bookings в этот день
    const busy = input.bookings
      .filter(b => isSameDay(b.start_time, date) && b.status !== 'cancelled')
      .map(b => ({ start: b.start_time, end: b.end_time }));

    // Генерируем слоты с шагом 15 мин, пропускаем занятые
    let cursor = workStart;
    while (addMinutes(cursor, input.serviceDuration) <= workEnd) {
      const slotEnd = addMinutes(cursor, input.serviceDuration);
      if (!overlapsAny(cursor, slotEnd, busy)) {
        slots.push({ start: cursor, end: slotEnd });
      }
      cursor = addMinutes(cursor, 15);
    }
  }

  return slots;
}
```

### 6.4 Вид календаря в Mini App (фронтенд)

```
Кабинет мастера → экран «Расписание»:

┌─────────────────────────────────────────────┐
│  Май 2026          < предыдущий  следующий > │
│                                              │
│  Пн  Вт  Ср  Чт  Пт  Сб  Вс               │
│  25  26  27  28  29  30  31                 │
│  [•] [•] [✕] [•] [•] [—] [—]               │
│   •=есть записи  ✕=заблокирован  —=выходной │
│                                              │
│  Среда, 27 мая — заблокировано              │
│  Пятница, 29 мая:                           │
│    10:00 Клиент А — Маникюр (confirmed)     │
│    12:00 Клиент Б — Педикюр (confirmed)     │
│    14:00 ──── свободно ────                 │
│    16:00 Клиент В — Маникюр (pending)       │
└─────────────────────────────────────────────┘

Кнопки: [Заблокировать день] [Изменить часы] [+ Запись вручную]
```

Клиентский вид (`GET /api/v1/masters/:id/slots`) — только доступные слоты, без имён клиентов.

---

## 7. White-label Mini App

### 7.1 Один URL — разные темы

URL: `https://app.beautybook.com/?m={master_id}` (или через deep link бота: `t.me/MariaNailsBot?startapp=`)

При загрузке Mini App:
```typescript
// Клиент открывает Mini App через кнопку в боте мастера
// initData содержит start_param или context мастера
const masterId = initData.startParam || getFromContext();

// GET /api/v1/masters/:id/theme
const theme = {
  primaryColor: '#E8B4B8',
  logoUrl: 'https://cdn.beautybook.com/logos/master_123.png',
  appName: 'Маникюр Марии',
};

// Применяем CSS переменные
document.documentElement.style.setProperty('--accent', theme.primaryColor);
```

### 7.2 Что настраивает мастер в теме

- Основной цвет акцента (hex, pallete из 8 пресетов + custom)
- Логотип / аватар (256×256)
- Название приложения (до 30 символов, появляется в заголовке бота и Mini App)
- Фоновый паттерн (5 вариантов)

---

## 8. Подписка и монетизация

### 8.1 Жизненный цикл мастера

```
Регистрация → plan: 'trial', trial_ends_at: now + 2 months
                    │
              trial_ends_at прошёл
                    │
              plan: 'expired' → бот рассылает оффер
                    │
              Оплата получена
                    │
              plan: 'active', plan_paid_until: now + 30 days
```

### 8.2 Что блокируется при expired — спецификация middleware checkPlan

Middleware `checkPlan` проверяет статус мастера перед каждым защищённым эндпоинтом.

```typescript
// adapters/http/middleware/check-plan.middleware.ts
async function checkPlan(req: FastifyRequest, res: FastifyReply): Promise<void> {
  const master = await masterRepo.findById(req.user.masterId);
  if (master.plan === 'expired') {
    // Автоматически снимаем expired если trial ещё не кончился (clock drift fix)
    if (master.plan === 'trial' && master.trial_ends_at > new Date()) return;
    throw new PaymentRequiredError('SUBSCRIPTION_EXPIRED');
  }
}
```

**Таблица блокировок (план expired → что происходит):**

| Эндпоинт | Статус | Error code | Сообщение клиенту |
|---|---|---|---|
| `POST /api/v1/bookings` | 402 | `MASTER_SUBSCRIPTION_EXPIRED` | «Мастер временно не принимает записи» |
| `POST /api/v1/me/services` | 402 | `MASTER_SUBSCRIPTION_EXPIRED` | «Обновите подписку для добавления услуг» |
| `PUT /api/v1/me/services/:id` | 402 | `MASTER_SUBSCRIPTION_EXPIRED` | — |
| `POST /api/v1/me/gallery` | 402 | `MASTER_SUBSCRIPTION_EXPIRED` | — |
| `PUT /api/v1/me/theme` | 402 | `MASTER_SUBSCRIPTION_EXPIRED` | — |
| `GET /api/v1/me/*` | 200 | — | Только чтение — работает |
| `GET /api/v1/masters/:id` | 200 | — | Профиль виден (но кнопка «Записаться» отключена) |
| `GET /api/v1/me/bookings` | 200 | — | Существующие записи видны |
| `GET /api/v1/me/subscription` | 200 | — | Страница оплаты — работает |
| AI-ответы в боте | — | — | «[Имя] сейчас не принимает. Подпишитесь позже» |
| Блокировка календаря | — | — | Мастер видит статус подписки, редактирование недоступно |

**Фронтенд** по error code `MASTER_SUBSCRIPTION_EXPIRED` показывает экран оплаты вместо формы.
```
- Существующие записи → видны, уведомления → работают
- Новые записи от клиентов → 402 MASTER_SUBSCRIPTION_EXPIRED
- AI-ответы → бот отвечает шаблонным сообщением
- Управление расписанием → GET работает, блокировки и изменения часов → 402
- Кабинет мастера → GET работает, все POST/PUT/DELETE на изменение → 402
```

### 8.3 Cron-задачи для подписки

```typescript
// Каждый день в 09:00
// За 7 дней до конца триала/подписки — напоминание мастеру
// В день окончания — переводим в expired
// Через 3 дня после expired — повторное напоминание
```

### 8.4 Платёжная система — Stripe (для Кипра и ЕС)

**Почему Stripe:**
- Кипр — ЕС, EUR как основная валюта. Stripe поддерживает регистрацию кипрского юрлица напрямую
- PSD2/SCA (3D Secure) — обязателен в ЕС, Stripe обрабатывает автоматически
- Stripe Billing — готовые subscription (recurring monthly), trial periods, автоматические retry при неуспешном списании
- ЮKassa — только РФ, недоступна на Кипре. Исключена из плана
- Telegram Stars — подходит для цифровых товаров, но плохо для B2B SaaS-подписок (нет инвойсов, нет EUR)

**Интеграция:**

```
Мастер → кабинет → кнопка "Оплатить подписку"
    → POST /api/v1/me/subscription/checkout
    → Stripe Checkout Session (hosted page, EUR)
    → Редирект на Stripe, оплата картой / SEPA Direct Debit
    → Stripe → POST /webhook/payments (событие: invoice.payment_succeeded)
    → Plan: active, plan_paid_until: now + 30 days
```

**Stripe webhooks (секция 3.4):**
```
invoice.payment_succeeded    → plan: active, продлить paid_until
invoice.payment_failed       → уведомить мастера, оставить план active на grace period 3 дня
customer.subscription.deleted → plan: expired
```

**Таблица subscription_payments — добавить Stripe поля:**

```sql
provider        VARCHAR(50),    -- 'stripe', 'manual', 'tg_stars'
provider_tx_id  VARCHAR(200),   -- Stripe invoice ID (in_...)
stripe_customer_id VARCHAR(200) -- для повторных платежей
```

**ENV переменные:**
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # для верификации webhook подписи
STRIPE_PRICE_ID=price_...         # ID тарифного плана в Stripe Dashboard
```

### 8.5 Регистрация оплаты (MVP — вручную, до подключения Stripe)

```
POST /api/v1/admin/subscriptions/activate
  Body: { master_id, months, note }
  → план: active, paid_until: +months
```

---

## 9. Уведомления (BullMQ + Redis)

### 9.1 Типы и планирование

| Job | Когда | Получатель |
|---|---|---|
| `booking_confirmed` | Сразу при создании | Клиент + мастер |
| `reminder_24h` | За 24ч до start_time | Клиент |
| `reminder_2h` | За 2ч до start_time | Клиент |
| `booking_cancelled` | При отмене | Клиент или мастер (кто не инициировал) |
| `booking_completed` | После записи — запросить отзыв | Клиент |
| `trial_expiring` | За 7 и 1 день | Мастер |
| `subscription_expired` | В день окончания | Мастер |

### 9.2 Отправка через бот мастера

```typescript
async function sendToClient(booking: Booking, message: string): Promise<void> {
  const master = await masterRepo.findById(booking.masterId);
  const bot = await botManager.getOrCreateBot(master);
  await bot.api.sendMessage(booking.clientTelegramId, message, { parse_mode: 'HTML' });
}
// Клиент получает сообщение в диалоге с конкретным ботом мастера (@MariaNailsBot)
```

---

## 10. Supabase Storage — загрузка файлов

### 10.1 Настройка

```
Supabase Dashboard → Storage → Create bucket: beautybook-media
Bucket: Public (фото доступны по URL без авторизации — это норма для портфолио)
Структура папок:
  avatars/{master_id}/avatar.jpg
  gallery/{master_id}/{photo_id}.jpg
  logos/{master_id}/logo.png
```

### 10.2 Адаптер загрузки файлов

```typescript
// infrastructure/supabase/storage.adapter.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function uploadFile(
  path: string,          // 'gallery/master-uuid/photo-uuid.jpg'
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from('beautybook-media')
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage
    .from('beautybook-media')
    .getPublicUrl(path);

  return data.publicUrl;  // https://[ref].supabase.co/storage/v1/object/public/...
}

export async function deleteFile(path: string): Promise<void> {
  await supabase.storage.from('beautybook-media').remove([path]);
}
```

Эндпоинт `POST /api/v1/me/gallery` принимает `multipart/form-data`, вызывает `uploadFile()`, сохраняет `publicUrl` в таблицу `gallery`.

---

## 11. Безопасность

### 11.1 Верификация Telegram initData

```typescript
// Каждый запрос от Mini App
function verifyInitData(initDataRaw: string, botToken: string): TelegramUser {
  const params = new URLSearchParams(initDataRaw);
  const hash = params.get('hash');
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (hash !== expectedHash) throw new ForbiddenError('Invalid initData');
  return JSON.parse(params.get('user')!);
}
```

**Важно:** Для multi-bot верификация выполняется с токеном того бота, через который пришёл запрос. Mini App передаёт `X-Master-Id` — по нему находим токен.

### 11.2 Шифрование секретов в БД

```typescript
// pgcrypto работает на Supabase PostgreSQL без изменений
// Расширение включить в Supabase Dashboard → Database → Extensions → pgcrypto
// Ключ шифрования — MASTER_SECRET_KEY из environment variable
// Никогда не логировать, не передавать в ответе API

// В SQL (Supabase PostgreSQL):
-- Сохранение: pgp_sym_encrypt(token, $MASTER_SECRET_KEY)
-- Чтение:     pgp_sym_decrypt(bot_token::bytea, $MASTER_SECRET_KEY)
```

### 11.3 Rate limiting

```
POST /api/v1/bookings    → 10 req / min / IP
POST /webhook/tg/*       → 100 req / sec (Telegram гарантирует порядок)
AI messages              → 20 сообщений / час / клиент / мастер
```

---

## 12. Структура папок

```
backend/
├── src/
│   ├── domain/
│   │   ├── master/
│   │   │   └── master.entity.ts
│   │   ├── booking/
│   │   │   ├── booking.entity.ts
│   │   │   └── booking.events.ts
│   │   ├── services/
│   │   │   └── slot-calculator.ts     # Чистая функция, нет I/O
│   │   └── ports/
│   │       ├── booking.repo.port.ts
│   │       ├── master.repo.port.ts
│   │       ├── notification.port.ts
│   │       ├── ai.port.ts
│   │       ├── calendar.port.ts        # ICalendarRepository (schedule + overrides)
│   │       └── event-bus.port.ts
│   │
│   ├── use-cases/
│   │   ├── create-booking/
│   │   ├── cancel-booking/
│   │   ├── get-available-slots/
│   │   ├── connect-bot/
│   │   ├── get-calendar-view/
│   │   ├── handle-ai-message/
│   │   └── manage-subscription/
│   │
│   ├── adapters/
│   │   ├── http/
│   │   │   ├── catalog/
│   │   │   ├── bookings/
│   │   │   ├── masters/
│   │   │   ├── bot/             # connect, disconnect
│   │   │   ├── calendar/        # GET /me/calendar, POST /me/calendar/block
│   │   │   ├── webhooks/        # tg, payments
│   │   │   └── admin/
│   │   └── repositories/
│   │       ├── supabase-master.repo.ts
│   │       ├── supabase-booking.repo.ts
│   │       ├── supabase-service.repo.ts
│   │       └── supabase-schedule.repo.ts
│   │
│   └── infrastructure/
│       ├── supabase/
│       │   ├── db-client.ts           # pg Pool (Transaction pooler port 6543)
│       │   ├── storage.adapter.ts     # Supabase Storage (фото, аватары, логотипы)
│       │   └── migrations/
│       │       ├── 001_initial.sql
│       │       └── 002_ai_conversations.sql
│       ├── redis/
│       │   └── client.ts
│       ├── telegram/
│       │   ├── bot-manager.ts        # multi-bot registry
│       │   ├── ai-handler.ts         # Grammy middleware
│       │   ├── booking-handler.ts    # Grammy middleware
│       │   └── notification-adapter.ts
│       ├── ai/
│       │   └── claude-ai.adapter.ts  # implements IAiPort
│       └── queue/
│           ├── notification.queue.ts
│           └── notification.worker.ts
│
├── app.ts              # Composition Root
├── server.ts
├── .env.example
└── docker-compose.yml  # только redis (postgres — Supabase cloud)
```

---

## 13. Environment Variables

```bash
# Supabase (заменяет PostgreSQL + S3)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # серверный ключ (full access, только backend)

# Два connection string — разные порты для разных задач:
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
# ↑ Transaction pooler (port 6543) — для всех запросов из Node.js (pg Pool)
DATABASE_DIRECT_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
# ↑ Direct connection (port 5432) — только для миграций (npm run db:migrate)

MASTER_SECRET_KEY=64-char-hex-key   # шифрование bot_token (pgcrypto)

# Redis
REDIS_URL=redis://localhost:6379

# Платформа
PLATFORM_URL=https://api.beautybook.com
MINI_APP_URL=https://app.beautybook.com

# AI (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Файловое хранилище (Supabase Storage — встроено, отдельных ключей не нужно)
# Bucket: beautybook-media (создать в Supabase Dashboard → Storage)
# Используется SUPABASE_SERVICE_ROLE_KEY из блока выше

# Платёжная система (Stripe, Кипр/ЕС, EUR)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...         # ID месячного тарифа в Stripe Dashboard
```

---

## 14. План реализации по этапам

### Этап 1 — Core (MVP, ~3 недели)

**Цель:** мастер подключает бота, клиенты записываются через Mini App.

```
[x] Создать проект в Supabase, включить расширения btree_gist + pgcrypto
[x] Применить миграции 001_initial.sql, 002_rls.sql, 003_bot_token_hash.sql
[x] GET /api/v1/catalog/masters (фильтры: category_id, city, available_today)
[x] GET /api/v1/catalog/masters/:id
[x] POST /api/v1/bookings (EXCLUDE GIST — защита от двойного бронирования)
[x] GET /api/v1/bookings/mine (по client_telegram_id из initData)
[x] DELETE /api/v1/bookings/:id (отмена)
[x] Telegram initData HMAC верификация на каждый запрос (X-Init-Data header)
[x] Zod-валидация: body, query, params на всех эндпоинтах
[x] Global error handler: DomainError → HTTP map, 23P01 → 409, 500 fallback
[x] Rate limiting: глобально 100/мин, POST /bookings — 10/мин
[x] Env vars validation (Zod) при старте: DATABASE_URL, BOT_TOKEN обязательны
[x] CORS через ALLOWED_ORIGINS env var
[x] Dockerfile + railway.toml (деплой на Railway, healthcheck /health)
[x] 13 unit-тестов (Vitest): create-booking × 4, cancel-booking × 3, telegram-auth × 6
[x] TypeScript strict + ESLint: 0 ошибок

[x] Services CRUD (GET/POST/PUT/DELETE /api/v1/me/services) — лимит 50 услуг, auth через initData
[x] Schedule CRUD (GET/PUT /api/v1/me/schedule/template, GET/PUT/DELETE /api/v1/me/schedule/overrides)
[x] Slot calculator (чистая функция domain/schedule/slot-calculator.ts — нет I/O)
[x] GET /api/v1/catalog/masters/:id/slots?date=YYYY-MM-DD&service_id= (override > weekly template)
[ ] GET /api/v1/me/calendar?from=&to= (агрегация schedule + overrides + bookings)
[ ] POST /api/v1/me/calendar/block, DELETE /api/v1/me/calendar/block/:id
[x] Bot connect: POST /api/v1/me/bot/connect → getMe → setWebhook (AES-256-GCM encrypt token)
[x] DELETE /api/v1/me/bot/disconnect → deleteWebhook + clear DB
[x] Webhook dispatcher /webhook/tg/:token_hash (multi-bot, verify X-Telegram-Bot-Api-Secret-Token)
[x] Grammy BotManager: TTL-30min LRU cache of bot instances per master
[x] Grammy bot: /start → открыть Mini App (inline keyboard web_app button)
[x] TokenCrypto: shared/lib/token-crypto.ts (AES-256-GCM, env: TOKEN_ENCRYPTION_KEY)
[x] New env vars: PLATFORM_URL, TOKEN_ENCRYPTION_KEY, MINI_APP_URL
[x] Notifications: booking_confirmed, reminder_24h, reminder_2h (BullMQ + Redis)
    - IEventBus (InProcessEventBus), INotificationPort, TelegramNotificationAdapter
    - BookingCreated/BookingCancelled domain events
    - BullMQ queue+worker, delayed jobs with jobId for cancellation
    - Railway: Redis service (redis:7-alpine) provisioned, REDIS_URL set via private networking
[x] Trial plan: 2 месяца, cron для expired
[ ] Gallery upload (Supabase Storage — bucket beautybook-media)
[ ] Theme config (color, logo)
[x] Деплой на Railway → https://backend-production-ed11d.up.railway.app
```

### Этап 2 — AI (2 недели)

```
[ ] ai_conversations table (migration 003)
[ ] Claude API adapter
[ ] buildSystemPrompt() с данными мастера
[ ] Grammy middleware: все текстовые сообщения → AI handler
[ ] Парсинг booking-команды из AI ответа
[ ] Запись через диалог: create booking + подтверждение
[ ] Кастомный prompts в кабинете мастера
[ ] Rate limiting для AI запросов
```

### Этап 3 — CRM и аналитика (1 неделя)

```
[ ] master_clients: auto-upsert при каждой записи
[ ] GET /me/clients с историей
[ ] GET /me/analytics (записей за период, выручка, no-show rate)
[ ] Reviews: POST /bookings/:id/review
[ ] Обновление rating и review_count (триггер или cron)
```

### Этап 4 — Монетизация (1 неделя)

```
[ ] Subscription lifecycle (trial → expired → active)
[ ] Гейтинг по плану (middleware checkPlan по таблице из раздела 8.2)
[ ] Cron уведомлений о подписке
[ ] Stripe Billing: Checkout Session, webhook invoice.payment_succeeded
[ ] Admin API: активировать подписку вручную (для MVP до Stripe)
```

---

## 15. Tech Stack (финальный выбор)

| Слой | Технология | Почему |
|---|---|---|
| HTTP-сервер | Fastify 5 | TypeScript из коробки, schema validation, быстрее Express |
| Telegram бот | Grammy 1.x | Лучший TS-support, поддерживает multi-bot через webhooks |
| БД | Supabase (PostgreSQL 15) | Управляемый PostgreSQL, btree_gist + pgcrypto, dashboard |
| ORM | Нет — raw SQL в repos | Полный контроль, все SQL-фичи PostgreSQL без абстракций |
| Очередь | BullMQ + Redis 7 | Персистентные jobs, delayed jobs, jobId для отмены |
| AI | Anthropic claude-haiku-4-5 | Быстро, дёшево для диалогов, API простой |
| Встроенный календарь | slot-calculator.ts (Domain Service) | Чистая функция, нет внешних зависимостей |
| Файлы | Supabase Storage | Встроено в Supabase, CDN, S3-совместимое API |
| Хостинг | Railway или VPS | Поддержка long-running процессов (BullMQ workers) |
| Frontend | Текущий vanilla JS → React (Этап 2+) | Текущий прототип работает, React нужен для сложных UI |

---

## 16. Критические ограничения, которые нельзя нарушать

1. **master_id только из verifyInitData()** — никогда из req.body или query-параметров
2. **bot_token никогда не возвращается через API** — только write-only, хранится зашифровано
3. **bot_token никогда не логируется** — только в БД зашифровано через pgcrypto
4. **Webhook URL содержит sha256(token), не сам токен** — иначе токен утечёт в логи Telegram
5. **Grammy bot создаётся один раз на master_id** — не создавать новый на каждый webhook (Map-кэш)
6. **AI messages ограничены rate limit** — иначе один клиент выжжет весь месячный бюджет API
7. **EXCLUDE GIST не удалять и не обходить** — единственная абсолютная защита от двойной записи (pending + confirmed оба защищены)
8. **Миграции только аддитивные** — никогда не DROP TABLE или DROP COLUMN в продакшне без backup
9. **Stripe webhook верифицировать через `stripe.webhooks.constructEvent()`** — никогда не доверять телу без проверки подписи `STRIPE_WEBHOOK_SECRET`
10. **slot-calculator — только чистые функции** — никакого I/O, БД или HTTP внутри domain/services/slot-calculator.ts
11. **pending bookings удалять cron-задачей** — `DELETE FROM bookings WHERE status='pending' AND expires_at < now()` каждые 5 минут
12. **Supabase SERVICE_ROLE_KEY только на сервере** — никогда не передавать в фронтенд; для клиента только `SUPABASE_ANON_KEY` + Row Level Security
13. **Миграции применять через DATABASE_DIRECT_URL** — Transaction pooler (6543) не поддерживает DDL-транзакции
