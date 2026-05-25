-- Добавляем колонку для поиска мастера по webhook URL
-- token_hash = sha256(bot_token) — хранится в URL вебхука, не раскрывает токен
ALTER TABLE masters ADD COLUMN IF NOT EXISTS bot_token_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_masters_bot_token_hash
  ON masters(bot_token_hash)
  WHERE bot_token_hash IS NOT NULL;
