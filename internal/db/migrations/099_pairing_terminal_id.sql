-- 099_pairing_terminal_id.sql
-- Agregar columna para guardar el terminal_id que el POS envia al iniciar emparejamiento.
-- El servidor debe respetar este ID en vez de generar uno nuevo.
-- Nullable para no romper solicitudes existentes que no tengan este campo.
-- NOTA: La tabla terminal_pairing_requests se crea en la migracion 125.
-- Como las migraciones se ejecutan en orden alfabetico, 099 se ejecuta antes que 125.
-- Usamos un DO block para verificar si la tabla existe antes de hacer el ALTER.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'terminal_pairing_requests') THEN
        ALTER TABLE terminal_pairing_requests ADD COLUMN IF NOT EXISTS terminal_id_requested TEXT;
    END IF;
END $$;
