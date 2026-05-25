-- Add theme fields to masters table
ALTER TABLE masters ADD COLUMN IF NOT EXISTS theme_primary_color VARCHAR(7)  DEFAULT '#E8B4B8';
ALTER TABLE masters ADD COLUMN IF NOT EXISTS theme_logo_url      TEXT;
ALTER TABLE masters ADD COLUMN IF NOT EXISTS theme_name          VARCHAR(100);

-- Gallery of master's work photos
CREATE TABLE IF NOT EXISTS gallery (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id   UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_master ON gallery(master_id, sort_order, created_at);
