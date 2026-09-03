-- Migracion 167: Columna language en user_preferences
-- Permite que cada usuario tenga su propio idioma de interfaz.

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'es';
