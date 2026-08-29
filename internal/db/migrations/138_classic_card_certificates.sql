-- Migracion 138: Certificados dinamicos rotativos para MIFARE Classic 1K
--
-- Objetivo: Mitigar la clonacion de tarjetas MIFARE Classic usando
-- certificados dinamicos rotativos en 15 sectores con triple redundancia.
--
-- Modelo de seguridad (6 capas):
-- 1. Claves A/B unicas por sector por tarjeta (30 claves unicas, nunca se modifican en caliente)
-- 2. 15 certificados con triple redundancia (45 copias, solo 1 valida, solo el servidor sabe cual)
-- 3. Rotacion aleatoria por transaccion (no secuencial)
-- 4. 2FA: documento + PIN + tarjeta fisica
-- 5. Solo 2 claves enviadas por transaccion (encriptadas con EphemeralMessage)
-- 6. Aislamiento entre tarjetas (claves unicas por usuario)
--
-- Estructura de la tarjeta MIFARE Classic 1K:
-- Sector 0: READ-ONLY (UID de fabrica) — NO TOCAR
-- Sectores 1-15: 15 sectores disponibles
--   Cada sector tiene 4 bloques de 16 bytes:
--     Bloque 0: copia 1 del certificado (16 bytes)
--     Bloque 1: copia 2 del certificado (16 bytes)
--     Bloque 2: copia 3 del certificado (16 bytes)
--     Bloque 3: SECTOR TRAILER — Key A (6b) + Access Bits (4b) + Key B (6b)
--               NUNCA se escribe en caliente (evita corrupcion irreversible)
--   Access bits: Key A = lectura, Key B = escritura

-- ===== Tabla: un registro por sector por tarjeta =====
CREATE TABLE IF NOT EXISTS nfc_card_sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    node_domain TEXT NOT NULL,
    sector_number INT NOT NULL,              -- 1-15
    key_a_encrypted BYTEA NOT NULL,          -- 6 bytes, encriptada con master key del nodo
    key_b_encrypted BYTEA NOT NULL,          -- 6 bytes, encriptada con master key del nodo
    access_bits BYTEA NOT NULL,              -- 4 bytes (config: Key A lee, Key B escribe)
    certificate BYTEA,                       -- 16 bytes (cert actual en este sector)
    is_active BOOLEAN NOT NULL DEFAULT false,  -- true = sector con cert valido
    written_blocks INT NOT NULL DEFAULT 0,     -- 0-3 (cuantos bloques confirmados)
    needs_repair BOOLEAN NOT NULL DEFAULT false, -- true si written_blocks < 3
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(card_uid, sector_number)
);

CREATE INDEX IF NOT EXISTS idx_nfc_card_sectors_uid ON nfc_card_sectors(card_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_card_sectors_active ON nfc_card_sectors(card_uid, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_nfc_card_sectors_repair ON nfc_card_sectors(needs_repair) WHERE needs_repair = true;

-- ===== Marcar tarjetas como provisionadas con certificados dinamicos =====
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS has_dynamic_certs BOOLEAN NOT NULL DEFAULT false;

-- ===== Tabla: pre-aprobaciones pendientes de confirmacion =====
-- Cuando el servidor pre-aprueba un pago Classic, guarda aqui la info
-- hasta que el POS confirme la lectura/escritura de la tarjeta.
-- TTL de 30 segundos: si no se confirma, se cancela automaticamente.
CREATE TABLE IF NOT EXISTS nfc_classic_pending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    read_sector INT NOT NULL,                -- sector que el POS debe leer
    write_sector INT NOT NULL,               -- sector donde el POS debe escribir
    new_certificate BYTEA NOT NULL,          -- 16 bytes, cert nuevo para write_sector
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 seconds'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_classic_pending_card ON nfc_classic_pending(card_uid, expires_at);
CREATE INDEX IF NOT EXISTS idx_nfc_classic_pending_expiry ON nfc_classic_pending(expires_at);

COMMENT ON TABLE nfc_card_sectors IS 'Certificados dinamicos rotativos para MIFARE Classic 1K. 15 sectores por tarjeta, cada uno con claves A/B unicas y un certificado de 16 bytes.';
COMMENT ON TABLE nfc_classic_pending IS 'Pre-aprobaciones pendientes de confirmacion de lectura/escritura en tarjeta Classic. TTL 30 segundos.';
