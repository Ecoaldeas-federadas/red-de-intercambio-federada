-- 099_pairing_terminal_id.sql
-- Agregar columna para guardar el terminal_id que el POS envia al iniciar emparejamiento.
-- El servidor debe respetar este ID en vez de generar uno nuevo.
-- Nullable para no romper solicitudes existentes que no tengan este campo.
ALTER TABLE terminal_pairing_requests ADD COLUMN IF NOT EXISTS terminal_id_requested TEXT;
