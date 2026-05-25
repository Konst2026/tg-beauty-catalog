-- ============================================================
-- BeautyBook — начальная схема базы данных
-- Supabase (PostgreSQL 15)
-- Применять через: DATABASE_DIRECT_URL (port 5432, не pooler)
-- ============================================================

-- Расширения (включить также в Dashboard → Database → Extensions)
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Категории
-- ============================================================
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       VARCHAR(50) UNIQUE NOT NULL,
  name       VARCHAR(100) NOT NULL,
  emoji      VARCHAR(10),
  sort_order INTEGER DEFAULT 0
);

INSERT INTO categories (slug, name, emoji, sort_order) VALUES
  ('nails',  'Ногти',       '💅', 1),
  ('lashes', 'Ресницы',     '👁', 2),
  ('brows',  'Брови',       '✨', 3),
  ('hair',   'Волосы',      '💇', 4);

-- ============================================================
-- 2. Мастера (основной tenant)
-- ============================================================
CREATE TABLE masters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id         BIGINT UNIQUE NOT NULL,
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
  bot_token           TEXT,                         -- зашифровано pgcrypto
  bot_username        VARCHAR(100),
  bot_webhook_secret  VARCHAR(64),

  -- Тема приложения
  theme_primary_color VARCHAR(7) DEFAULT '#E8B4B8',
  theme_logo_url      TEXT,
  theme_name          VARCHAR(100),

  -- Подписка
  plan                VARCHAR(20) NOT NULL DEFAULT 'trial'
                        CHECK (plan IN ('trial', 'active', 'expired')),
  trial_ends_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 months'),
  plan_paid_until     TIMESTAMPTZ,
  subscription_price  NUMERIC(10,2) DEFAULT 29.00,  -- EUR/мес

  -- AI
  ai_system_prompt    TEXT,

  is_published        BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_masters_tg       ON masters(telegram_id);
CREATE INDEX idx_masters_category ON masters(category_id) WHERE is_published = true;

-- ============================================================
-- 3. Услуги мастера
-- ============================================================
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

-- ============================================================
-- 4. Расписание мастера
-- ============================================================

-- Недельный шаблон (0=воскресенье, 1=понедельник, ..., 6=суббота)
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

-- ============================================================
-- 5. Бронирования
-- ============================================================
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
  expires_at          TIMESTAMPTZ,  -- pending: now() + 10 min; confirmed: NULL
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        VARCHAR(10) CHECK (cancelled_by IN ('client','master','system')),
  notes               TEXT,
  price_snapshot      NUMERIC(10,2) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (end_time > start_time),

  -- Абсолютная защита от двойного бронирования
  -- pending резервирует слот на время AI-диалога
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

-- Cron: очищать устаревшие pending каждые 5 минут
-- DELETE FROM bookings WHERE status = 'pending' AND expires_at < now();

-- ============================================================
-- 6. Клиенты мастера (CRM)
-- ============================================================
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

-- ============================================================
-- 7. Галерея работ
-- ============================================================
CREATE TABLE gallery (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. Отзывы
-- ============================================================
CREATE TABLE reviews (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         UUID NOT NULL REFERENCES bookings(id) UNIQUE,
  master_id          UUID NOT NULL REFERENCES masters(id),
  client_telegram_id BIGINT NOT NULL,
  rating             SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_master ON reviews(master_id, created_at DESC);

-- ============================================================
-- 9. AI-диалоги
-- ============================================================
CREATE TABLE ai_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id           UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  client_telegram_id  BIGINT NOT NULL,
  messages            JSONB NOT NULL DEFAULT '[]',  -- [{role, content, ts}]
  state               VARCHAR(50) DEFAULT 'idle',   -- 'idle', 'booking_flow', 'confirmed'
  booking_draft       JSONB,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(master_id, client_telegram_id)
);

-- ============================================================
-- 10. Платежи за подписку (Stripe)
-- ============================================================
CREATE TABLE subscription_payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id          UUID NOT NULL REFERENCES masters(id),
  amount             NUMERIC(10,2) NOT NULL,
  currency           VARCHAR(3) DEFAULT 'EUR',
  provider           VARCHAR(50),        -- 'stripe', 'manual', 'tg_stars'
  provider_tx_id     VARCHAR(200),       -- Stripe invoice ID (in_...)
  stripe_customer_id VARCHAR(200),       -- для повторных платежей
  period_from        TIMESTAMPTZ NOT NULL,
  period_to          TIMESTAMPTZ NOT NULL,
  paid_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. Лог уведомлений
-- ============================================================
CREATE TABLE notification_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID REFERENCES masters(id),
  booking_id  UUID REFERENCES bookings(id),
  telegram_id BIGINT NOT NULL,
  type        VARCHAR(50) NOT NULL,  -- 'booking_confirmed', 'reminder_24h', 'reminder_2h', 'booking_cancelled'
  status      VARCHAR(20) DEFAULT 'sent',
  error       TEXT,
  sent_at     TIMESTAMPTZ DEFAULT now()
);
