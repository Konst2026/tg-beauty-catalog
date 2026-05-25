-- ============================================================
-- BeautyBook — Row Level Security (права доступа)
-- Supabase (PostgreSQL 15)
--
-- Стратегия:
-- Наш бэкенд подключается через pg Pool с правами владельца БД
-- (DATABASE_URL) — RLS для него не действует. Это защита на случай
-- если кто-то попытается обратиться к данным напрямую через браузер
-- или Supabase anon-ключ.
--
-- Публичное чтение: catalog-данные (категории, профили, услуги, галерея, отзывы)
-- Всё остальное: закрыто — только через наш API-сервер
-- ============================================================

-- Включаем RLS на всех таблицах
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE masters              ENABLE ROW LEVEL SECURITY;
ALTER TABLE services             ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Публичное чтение (каталог — это витрина магазина, открытая для всех)
-- ============================================================

-- Категории: все могут смотреть
CREATE POLICY "public_read_categories"
  ON categories FOR SELECT
  USING (true);

-- Мастера: только опубликованные профили видны публично
CREATE POLICY "public_read_masters"
  ON masters FOR SELECT
  USING (is_published = true);

-- Услуги: только активные, только опубликованных мастеров
CREATE POLICY "public_read_services"
  ON services FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM masters m
      WHERE m.id = services.master_id AND m.is_published = true
    )
  );

-- Галерея: только опубликованных мастеров
CREATE POLICY "public_read_gallery"
  ON gallery FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM masters m
      WHERE m.id = gallery.master_id AND m.is_published = true
    )
  );

-- Отзывы: публичное чтение
CREATE POLICY "public_read_reviews"
  ON reviews FOR SELECT
  USING (true);

-- ============================================================
-- Все остальные таблицы — только через наш бэкенд (нет публичных политик)
-- Без политики = никто через anon-ключ не пройдёт
-- ============================================================
-- bookings             — закрыто (личные данные клиентов)
-- schedules            — закрыто (внутренние данные мастера)
-- schedule_overrides   — закрыто
-- master_clients       — закрыто (CRM-данные)
-- ai_conversations     — закрыто (история чатов)
-- subscription_payments — закрыто (финансовые данные)
-- notification_log     — закрыто
