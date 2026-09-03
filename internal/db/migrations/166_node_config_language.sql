-- Migracion 166: Columna default_language en node_config
-- Permite que cada nodo defina su idioma por defecto.

ALTER TABLE node_config ADD COLUMN IF NOT EXISTS default_language VARCHAR(10) NOT NULL DEFAULT 'es';
