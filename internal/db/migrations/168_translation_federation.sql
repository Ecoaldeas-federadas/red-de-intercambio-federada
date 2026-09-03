-- Migracion 168: Federacion de traducciones
-- Anade columnas de federacion a la tabla languages
-- y crea la tabla federated_translations para registrar traducciones de otros nodos.

-- Anadir columnas de federacion a languages
ALTER TABLE languages
  ADD COLUMN IF NOT EXISTS shared_with_federation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS file_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS signed_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS signature TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Tabla de traducciones recibidas de otros nodos federados.
-- El admin decide si descargar e instalar manualmente.
CREATE TABLE IF NOT EXISTS federated_translations (
  id SERIAL PRIMARY KEY,
  source_node VARCHAR(255) NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  file_hash VARCHAR(128),
  signed_by VARCHAR(255),
  signature TEXT,
  num_keys INTEGER NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  installed BOOLEAN NOT NULL DEFAULT false,
  installed_at TIMESTAMPTZ,
  UNIQUE (source_node, language_code)
);

-- Indice para buscar traducciones por idioma
CREATE INDEX IF NOT EXISTS idx_federated_translations_lang
  ON federated_translations (language_code);
