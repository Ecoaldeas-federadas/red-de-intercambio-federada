-- Migracion 163: Tabla languages
-- Lista de idiomas habilitados en el nodo.
-- 'es' es el idioma default (base). 'en' se habilita por defecto.

CREATE TABLE IF NOT EXISTS languages (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  native_name VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO languages (code, name, native_name, enabled, is_default) VALUES
  ('es', 'Spanish', 'Espanol', true, true),
  ('en', 'English', 'English', true, false)
ON CONFLICT (code) DO NOTHING;
