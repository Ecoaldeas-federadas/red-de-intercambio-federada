-- Migracion 119: Rotacion de clave por transaccion + config dual de tarjetas
--
-- Soporta DOS tipos de tarjetas:
-- 1. DESFire EV3 (segura, AES-128, challenge-response, rotacion de clave)
-- 2. MIFARE Classic / UID normal (UID + PIN, disponible en Venezuela)
--
-- El nodo configura que tipo de tarjeta aceptar:
--   uid_only  = solo tarjetas normales (UID + PIN)
--   desfire   = solo tarjetas seguras (DESFire EV3)
--   dual      = ambas (detecta automaticamente, recomendado para transicion)

-- ============================================================
-- 1. ROTACION DE CLAVE POR TRANSACCION
-- ============================================================

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS pending_key_encrypted BYTEA;
-- Clave nueva pendiente de confirmacion (K')

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS rotation_status TEXT DEFAULT 'active';
-- active: clave K activa, sin rotacion pendiente
-- pending: clave K' escrita en tarjeta, esperando confirmacion
-- error: fallo de escritura, tarjeta con problema

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS write_fail_count INT DEFAULT 0;
-- Contador de fallos consecutivos de escritura de clave

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS last_rotation_at TIMESTAMPTZ;
-- Ultima rotacion exitosa

-- Historial de rotaciones
CREATE TABLE IF NOT EXISTS card_key_rotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    node_domain TEXT NOT NULL,
    old_key_version INT NOT NULL,
    new_key_version INT NOT NULL,
    -- Estado: pending, confirmed, failed, recovered
    status TEXT NOT NULL DEFAULT 'pending',
    -- Quien inicio la rotacion (terminal_id)
    terminal_id TEXT,
    -- Mensaje de error si fallo
    error_message TEXT,
    -- Tiempo que tomo la rotacion (ms)
    duration_ms INT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_card_rotations_uid ON card_key_rotations (card_uid, started_at);
CREATE INDEX IF NOT EXISTS idx_card_rotations_status ON card_key_rotations (status);

-- Marcar tarjetas con error de escritura
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS card_error TEXT;
-- NULL = sin error, 'write_fail' = no se pudo escribir clave, 'auth_fail' = fallo de auth

ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS error_at TIMESTAMPTZ;
-- Cuando se detecto el error

-- ============================================================
-- 2. CONFIG DUAL DE TARJETAS POR NODO
-- ============================================================

CREATE TABLE IF NOT EXISTS nfc_card_type_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL UNIQUE,
    -- Modo de tarjeta: uid_only, desfire, dual
    card_type_mode TEXT NOT NULL DEFAULT 'dual',
    -- Si es true, rechaza tarjetas sin crypto (solo desfire o dual con require)
    require_crypto BOOLEAN NOT NULL DEFAULT false,
    -- Si es true, rota la clave AES en cada transaccion (solo DESFire)
    auto_rotate_key BOOLEAN NOT NULL DEFAULT true,
    -- Maximo de fallos de escritura antes de marcar tarjeta con error
    max_write_fails INT NOT NULL DEFAULT 3,
    -- Mensaje personalizado para tarjetas normales
    uid_only_message TEXT DEFAULT 'Esta tarjeta no tiene seguridad criptografica. Usa PIN para proteger.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Config por defecto: dual (acepta ambos tipos, recomendado para transicion)
INSERT INTO nfc_card_type_config (node_domain, card_type_mode, require_crypto, auto_rotate_key)
VALUES ('__LOCAL__', 'dual', false, true)
ON CONFLICT (node_domain) DO NOTHING;
