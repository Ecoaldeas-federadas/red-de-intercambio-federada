-- 061_user_metadata.sql
-- Columna metadata para usuarios (almacena preferencias como digest_mode, last_digest_sent, etc.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.metadata IS 'Metadata extensible del usuario: digest_mode, last_digest_sent, etc.';
