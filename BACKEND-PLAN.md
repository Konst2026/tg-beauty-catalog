# BACKEND-PLAN.md — BeautyBook SaaS Platform

> Бэкенд-архитектор. Составлено после изучения research.md, Architecture.md, всего кода проекта и уточняющих вопросов.  
> Версия: 2026-05-23

---

## Что строим: одна фраза

**SaaS-платформа**: каждый бьюти-мастер подключает свой бот, получает изолированный кабинет, своих клиентов видят только его услуги, бот сам отвечает на вопросы и принимает записи, расписание синхронизируется с Google Calendar. 2 месяца бесплатно, затем подписка.

---

## Ответы на ключевые вопросы архитектуры

| Вопрос | Решение |
|---|---|
| Свой бот для мастера | Мастер создаёт бота в @BotFather, вставляет token в кабинет. Платформа управляет всеми токенами |
| Freemium | 2 месяца полный доступ бесплатно, затем подписка. Без функциональных ограничений |
| AI-консультант | FAQ по данным мастера + запись через диалог без Mini App |
| Оплата | Только подписка мастера. Клиентские платежи — между мастером и клиентом напрямую |
| Google Calendar | Двусторонняя синхронизация: запись → событие в GCal; блокировка в GCal → слот недоступен |

---

## 1. Модель данных (PostgreSQL)

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

  -- Google Calendar
  gcal_access_token   TEXT,                           -- зашифровано
  gcal_refresh_token  TEXT,                           -- зашифровано
  gcal_calendar_id    VARCHAR(200),                   -- ID календаря для синхронизации
  gcal_webhook_channel_id VARCHAR(200),               -- Google Push channel ID
  gcal_webhook_expiry TIMESTAMPTZ,

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
  status              VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed','completed','cancelled','no_show')),
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        VARCHAR(10) CHECK (cancelled_by IN ('client','master','system')),
  notes               TEXT,
  price_snapshot      NUMERIC(10,2) NOT NULL,
  google_event_id     VARCHAR(200),   -- ID события в Google Calendar мастера
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),

  -- Абсолютная защита от двойного бронирования
  EXCLUDE USING GIST (
    master_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status = 'confirmed')
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
| Google Calendar токен | ❌ | OAuth flow | Хранит зашифровано |
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

### 3.3 Подключение бота и Google Calendar

```
POST /api/v1/me/bot/connect             Сохранить BOT_TOKEN
                                         Body: { token }
                                         → верифицирует через getMe, сохраняет, регистрирует webhook
DELETE /api/v1/me/bot/disconnect        Удалить токен, отключить webhook

GET  /api/v1/me/gcal/auth-url           Получить OAuth2 URL для авторизации Google
GET  /api/v1/gcal/callback              OAuth2 callback (сохраняет токены, настраивает push webhook)
DELETE /api/v1/me/gcal/disconnect       Отключить Google Calendar
```

### 3.4 Webhooks (системные)

```
POST /webhook/tg/:token_hash            Telegram webhook для бота мастера
                                         token_hash = sha256(bot_token) — без раскрытия токена в URL
POST /webhook/gcal/:master_id           Google Calendar push-уведомления (синхронизация)
POST /webhook/payments                  Уведомления платёжной системы
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
const bots = new Map<string, Bot>(); // masterId → Grammy Bot instance

async function getOrCreateBot(master: Master): Promise<Bot> {
  if (bots.has(master.id)) return bots.get(master.id)!;
  const bot = new Bot(decrypt(master.bot_token));
  setupHandlers(bot, master);  // подключаем AI и booking handlers
  bots.set(master.id, bot);
  return bot;
}

// Webhook handler
app.post('/webhook/tg/:token_hash', async (req, res) => {
  const master = await masterRepo.findByTokenHash(req.params.token_hash);
  if (!master) return res.status(404).send();
  const bot = await getOrCreateBot(master);
  await bot.handleUpdate(req.body);
  res.status(200).send('ok');
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

  // Проверяем, не вернул ли AI команду создать запись
  const bookingCmd = tryParseBookingCommand(assistantText);
  if (bookingCmd) {
    const booking = await bookingService.create({
      masterId: master.id,
      clientTelegramId: clientTgId,
      serviceId: bookingCmd.service_id,
      startTime: new Date(bookingCmd.start_time),
    });
    await appendMessage(conv.id, 'assistant', assistantText);
    return formatBookingConfirmation(booking, master);
  }

  await appendMessage(conv.id, 'assistant', assistantText);
  return assistantText;
}
```

---

## 6. Google Calendar синхронизация

### 6.1 Двусторонняя синхронизация

```
ПЛАТФОРМА → GOOGLE:
Booking created → Google Calendar Events.insert()
Booking cancelled → Google Calendar Events.delete()

GOOGLE → ПЛАТФОРМА:
Google Push Channel (webhook) уведомляет о любых изменениях в календаре мастера
Платформа делает full sync: читает события через Events.list()
Если событие без booking_id появилось в рабочие часы → блокируется слот
```

### 6.2 OAuth2 Flow

```
1. Master нажимает "Подключить Google Calendar" в кабинете
2. GET /api/v1/me/gcal/auth-url → редирект на Google OAuth2
3. Google → GET /api/v1/gcal/callback?code=...&state=master_id
4. Обмен code → access_token + refresh_token (сохраняем зашифровано)
5. Выбор календаря (по умолчанию primary)
6. Подписка на Google Push: calendar.watch() → channel на /webhook/gcal/:master_id
7. Первичный full sync: читаем события на 90 дней вперёд
```

### 6.3 Обработка push-уведомления от Google

```typescript
// При получении push от Google
app.post('/webhook/gcal/:master_id', async (req, res) => {
  res.status(200).send(); // Google требует быстрый ответ 200
  await gcalSyncQueue.add('sync', { masterId: req.params.master_id });
});

// BullMQ worker
async function syncGoogleCalendar(masterId: string): Promise<void> {
  const master = await masterRepo.findById(masterId);
  const gcal = createGCalClient(master);
  const events = await gcal.events.list({
    calendarId: master.gcal_calendar_id,
    timeMin: new Date().toISOString(),
    timeMax: addDays(new Date(), 90).toISOString(),
  });

  // Сравниваем с нашими bookings, добавляем блокировки
  await scheduleOverrideRepo.syncFromGCal(masterId, events.data.items);
}
```

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

### 8.2 Что блокируется при expired

```
- Новые записи от клиентов → бот отвечает "мастер временно не принимает записи"
- AI-ответы → отключены
- Google Calendar sync → приостановлен
- Кабинет мастера → только чтение + экран оплаты
- Существующие записи → видны, уведомления → работают
```

### 8.3 Cron-задачи для подписки

```typescript
// Каждый день в 09:00
// За 7 дней до конца триала/подписки — напоминание мастеру
// В день окончания — переводим в expired
// Через 3 дня после expired — повторное напоминание
```

### 8.4 Регистрация оплаты (MVP — вручную)

```
POST /api/v1/admin/subscriptions/activate
  Body: { master_id, months, note }
  → план: active, paid_until: +months
```

В дальнейшем подключается Telegram Stars или ЮKassa.

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

## 10. Безопасность

### 10.1 Верификация Telegram initData

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

### 10.2 Шифрование секретов в БД

```typescript
// pgcrypto: bot_token и gcal_refresh_token шифруются симметрично
// Ключ шифрования — MASTER_SECRET_KEY из environment variable
// Никогда не логировать, не передавать в ответе API

// В PostgreSQL:
-- Сохранение: pgp_sym_encrypt(token, $MASTER_SECRET_KEY)
-- Чтение:     pgp_sym_decrypt(bot_token::bytea, $MASTER_SECRET_KEY)
```

### 10.3 Rate limiting

```
POST /api/v1/bookings    → 10 req / min / IP
POST /webhook/tg/*       → 100 req / sec (Telegram гарантирует порядок)
AI messages              → 20 сообщений / час / клиент / мастер
```

---

## 11. Структура папок

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
│   │       ├── calendar.port.ts
│   │       └── event-bus.port.ts
│   │
│   ├── use-cases/
│   │   ├── create-booking/
│   │   ├── cancel-booking/
│   │   ├── get-available-slots/
│   │   ├── connect-bot/
│   │   ├── connect-google-calendar/
│   │   ├── handle-ai-message/
│   │   └── manage-subscription/
│   │
│   ├── adapters/
│   │   ├── http/
│   │   │   ├── catalog/
│   │   │   ├── bookings/
│   │   │   ├── masters/
│   │   │   ├── bot/             # connect, disconnect
│   │   │   ├── gcal/            # oauth, callback
│   │   │   ├── webhooks/        # tg, gcal, payments
│   │   │   └── admin/
│   │   └── repositories/
│   │       ├── postgres-master.repo.ts
│   │       ├── postgres-booking.repo.ts
│   │       ├── postgres-service.repo.ts
│   │       └── postgres-schedule.repo.ts
│   │
│   └── infrastructure/
│       ├── postgres/
│       │   ├── pool.ts
│       │   └── migrations/
│       │       ├── 001_initial.sql
│       │       ├── 002_gcal.sql
│       │       └── 003_ai_conversations.sql
│       ├── redis/
│       │   └── client.ts
│       ├── telegram/
│       │   ├── bot-manager.ts        # multi-bot registry
│       │   ├── ai-handler.ts         # Grammy middleware
│       │   ├── booking-handler.ts    # Grammy middleware
│       │   └── notification-adapter.ts
│       ├── ai/
│       │   └── claude-ai.adapter.ts  # implements IAiPort
│       ├── google-calendar/
│       │   └── gcal.adapter.ts       # implements ICalendarPort
│       ├── storage/
│       │   └── s3.adapter.ts         # фото галереи и логотипов
│       └── queue/
│           ├── notification.queue.ts
│           ├── notification.worker.ts
│           └── gcal-sync.worker.ts
│
├── app.ts              # Composition Root
├── server.ts
├── .env.example
└── docker-compose.yml  # postgres + redis
```

---

## 12. Environment Variables

```bash
# База данных
DATABASE_URL=postgresql://user:password@localhost:5432/beautybook
MASTER_SECRET_KEY=64-char-hex-key   # шифрование bot_token и gcal_refresh_token

# Redis
REDIS_URL=redis://localhost:6379

# Платформа
PLATFORM_URL=https://api.beautybook.com
MINI_APP_URL=https://app.beautybook.com

# AI (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Google Calendar
GCAL_CLIENT_ID=...
GCAL_CLIENT_SECRET=...
GCAL_REDIRECT_URI=https://api.beautybook.com/api/v1/gcal/callback

# Файловое хранилище (S3-совместимое)
S3_BUCKET=beautybook-media
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Платёжная система (опционально, MVP без неё)
PAYMENT_PROVIDER=manual
```

---

## 13. План реализации по этапам

### Этап 1 — Core (MVP, ~3 недели)

**Цель:** мастер подключает бота, клиенты записываются через Mini App.

```
[ ] PostgreSQL migrations 001 (все таблицы без gcal, ai_conversations)
[ ] Master CRUD + auth через initData
[ ] Services CRUD
[ ] Schedule CRUD (weekly template)
[ ] Slot calculator (чистая функция)
[ ] GET /catalog, GET /masters/:id, GET /masters/:id/slots
[ ] POST /bookings (с EXCLUDE GIST защитой)
[ ] GET /my/bookings, POST /bookings/:id/cancel
[ ] Bot connect: POST /me/bot/connect → getMe → setWebhook
[ ] Webhook dispatcher /webhook/tg/:token_hash
[ ] Grammy bot: /start → открыть Mini App
[ ] Notifications: booking_confirmed, reminder_24h, reminder_2h (BullMQ)
[ ] Trial plan: 2 месяца, cron для expired
[ ] Gallery upload (S3)
[ ] Theme config (color, logo)
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

### Этап 3 — Google Calendar (2 недели)

```
[ ] OAuth2 flow (auth-url + callback)
[ ] Сохранение refresh_token (зашифровано)
[ ] При создании booking → Events.insert()
[ ] При отмене → Events.delete()
[ ] gcal-sync.worker.ts
[ ] Google Push Channel: calendar.watch()
[ ] Webhook /webhook/gcal/:master_id → sync job
[ ] Полная двусторонняя синхронизация
```

### Этап 4 — CRM и аналитика (1 неделя)

```
[ ] master_clients: auto-upsert при каждой записи
[ ] GET /me/clients с историей
[ ] GET /me/analytics (записей за период, выручка, no-show rate)
[ ] Reviews: POST /bookings/:id/review
[ ] Обновление rating и review_count (триггер или cron)
```

### Этап 5 — Монетизация (1 неделя)

```
[ ] Subscription lifecycle (trial → expired → active)
[ ] Гейтинг по плану (middleware checkPlan)
[ ] Cron уведомлений о подписке
[ ] Admin API: активировать подписку вручную
[ ] (Опционально) Telegram Stars или ЮKassa
```

---

## 14. Tech Stack (финальный выбор)

| Слой | Технология | Почему |
|---|---|---|
| HTTP-сервер | Fastify 5 | TypeScript из коробки, schema validation, быстрее Express |
| Telegram бот | Grammy 1.x | Лучший TS-support, поддерживает multi-bot через webhooks |
| БД | PostgreSQL 16 + btree_gist | EXCLUDE GIST для защиты от двойной записи |
| ORM | Нет — raw SQL в repos | AI читает SQL лучше ORM-магии, полный контроль |
| Очередь | BullMQ + Redis 7 | Персистентные jobs, delayed jobs, jobId для отмены |
| AI | Anthropic claude-haiku-4-5 | Быстро, дёшево для диалогов, API простой |
| Google Calendar | googleapis npm | Официальный клиент |
| Файлы | S3-совместимое (Cloudflare R2) | Дёшево, CDN из коробки |
| Хостинг | Railway или VPS | Поддержка long-running процессов (BullMQ workers) |
| Frontend | Текущий vanilla JS → React (Этап 2+) | Текущий прототип работает, React нужен для сложных UI |

---

## 15. Критические ограничения, которые нельзя нарушать

1. **master_id только из verifyInitData()** — никогда из req.body или query-параметров
2. **bot_token никогда не возвращается через API** — только write-only, хранится зашифровано
3. **gcal_refresh_token никогда не логируется** — только в БД зашифровано
4. **Webhook URL содержит sha256(token), не сам токен** — иначе токен утечёт в логи Telegram
5. **Grammy bot создаётся один раз на master_id** — не создавать новый на каждый webhook (Map-кэш)
6. **AI messages ограничены rate limit** — иначе один клиент выжжет весь месячный бюджет API
7. **EXCLUDE GIST не удалять и не обходить** — единственная абсолютная защита от двойной записи
8. **Миграции только аддитивные** — никогда не DROP TABLE или DROP COLUMN в продакшне без backup
