-- Migracion 150: Soporte NTAG215 + Ultralight C en el sistema modular de drivers
--
-- Objetivo: Agregar tablas para soportar certificados dinamicos rotativos en
-- tarjetas NTAG215 (30 slots, 15 activos + 15 backups) y MIFARE Ultralight C
-- (8 slots, 4 activos + 4 backups).
--
-- NTAG215:
--   - 504 bytes de memoria de usuario (paginas 4-129)
--   - 1 PWD global de 32 bits + PACK de 16 bits
--   - AUTH0 protege desde pagina 10 (zona privada)
--   - 30 slots de 16 bytes cada uno (4 paginas por slot)
--   - Zona publica: paginas 4-9 (custom_card_id)
--   - Zona privada: paginas 10-129 (30 slots)
--
-- Ultralight C:
--   - 148 bytes de memoria de usuario (paginas 4-39 aprox)
--   - 3DES con clave de 112 bits (mas fuerte que Crypto1 de Classic)
--   - 8 slots de 16 bytes cada uno (4 paginas por slot)
--   - Zona publica: paginas 4-7 (custom_card_id)
--   - Zona privada: paginas 8-39 (8 slots)
--   - Marcada como "baja capacidad" — usar solo si no se consigue NTAG215
--
-- Nota de seguridad: Las claves PWD (NTAG215) y 3DES (Ultralight C) se guardan
-- encriptadas con la master key del nodo. El codigo Go debe encriptarlas antes
-- de guardarlas y desencriptarlas al leerlas. No se guardan en plaintext.

-- ===== Columnas nuevas en nfc_cards =====
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS custom_card_id TEXT;
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS ntag215_pwd_encrypted BYTEA;
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS ntag215_pack BYTEA;
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS ntag215_auth0 INT DEFAULT 10;
ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS ultralight_c_key_encrypted BYTEA;

-- ===== Tabla: slots NTAG215 (30 slots por tarjeta) =====
CREATE TABLE IF NOT EXISTS nfc_ntag215_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    node_domain TEXT NOT NULL,
    slot_number INT NOT NULL,                  -- 0-29 (0-14 activos, 15-29 backups)
    is_backup BOOLEAN NOT NULL DEFAULT false,  -- true = slot de backup
    backup_of_slot INT,                        -- slot activo al que respalda (null si es activo)
    start_page INT NOT NULL,                   -- pagina inicial (10 + slot*4)
    end_page INT NOT NULL,                     -- pagina final (start_page + 3)
    certificate BYTEA,                         -- 16 bytes (cert actual en este slot)
    is_active BOOLEAN NOT NULL DEFAULT false,  -- true = slot con cert valido
    written_pages INT NOT NULL DEFAULT 0,      -- 0-4 (cuantas paginas confirmadas)
    needs_repair BOOLEAN NOT NULL DEFAULT false, -- true si written_pages < 4
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(card_uid, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_nfc_ntag215_slots_uid ON nfc_ntag215_slots(card_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_ntag215_slots_active ON nfc_ntag215_slots(card_uid, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_nfc_ntag215_slots_repair ON nfc_ntag215_slots(needs_repair) WHERE needs_repair = true;

-- ===== Tabla: slots Ultralight C (8 slots por tarjeta) =====
CREATE TABLE IF NOT EXISTS nfc_ultralight_c_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    node_domain TEXT NOT NULL,
    slot_number INT NOT NULL,                  -- 0-7 (0-3 activos, 4-7 backups)
    is_backup BOOLEAN NOT NULL DEFAULT false,  -- true = slot de backup
    backup_of_slot INT,                        -- slot activo al que respalda (null si es activo)
    start_page INT NOT NULL,                   -- pagina inicial (8 + slot*4)
    end_page INT NOT NULL,                     -- pagina final (start_page + 3)
    certificate BYTEA,                         -- 16 bytes (cert actual en este slot)
    is_active BOOLEAN NOT NULL DEFAULT false,  -- true = slot con cert valido
    written_pages INT NOT NULL DEFAULT 0,      -- 0-4 (cuantas paginas confirmadas)
    needs_repair BOOLEAN NOT NULL DEFAULT false, -- true si written_pages < 4
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(card_uid, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_nfc_ultralight_c_slots_uid ON nfc_ultralight_c_slots(card_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_ultralight_c_slots_active ON nfc_ultralight_c_slots(card_uid, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_nfc_ultralight_c_slots_repair ON nfc_ultralight_c_slots(needs_repair) WHERE needs_repair = true;

-- ===== Tabla: pre-aprobaciones pendientes NTAG215 =====
-- TTL de 30 segundos: si no se confirma, se cancela automaticamente.
CREATE TABLE IF NOT EXISTS nfc_ntag215_pending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    read_slot INT NOT NULL,                    -- slot que el POS debe leer (0-14)
    write_slot INT NOT NULL,                   -- slot donde el POS debe escribir (0-14)
    backup_slot INT NOT NULL,                  -- slot de backup correspondiente (15-29)
    new_certificate BYTEA NOT NULL,            -- 16 bytes, cert nuevo para write_slot
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 seconds'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_ntag215_pending_card ON nfc_ntag215_pending(card_uid, expires_at);
CREATE INDEX IF NOT EXISTS idx_nfc_ntag215_pending_expiry ON nfc_ntag215_pending(expires_at);

-- ===== Tabla: pre-aprobaciones pendientes Ultralight C =====
-- TTL de 30 segundos: si no se confirma, se cancela automaticamente.
CREATE TABLE IF NOT EXISTS nfc_ultralight_c_pending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    read_slot INT NOT NULL,                    -- slot que el POS debe leer (0-3)
    write_slot INT NOT NULL,                   -- slot donde el POS debe escribir (0-3)
    backup_slot INT NOT NULL,                  -- slot de backup correspondiente (4-7)
    new_certificate BYTEA NOT NULL,            -- 16 bytes, cert nuevo para write_slot
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 seconds'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_ultralight_c_pending_card ON nfc_ultralight_c_pending(card_uid, expires_at);
CREATE INDEX IF NOT EXISTS idx_nfc_ultralight_c_pending_expiry ON nfc_ultralight_c_pending(expires_at);

COMMENT ON TABLE nfc_ntag215_slots IS 'Certificados dinamicos rotativos para NTAG215. 30 slots por tarjeta (15 activos + 15 backups), cada uno con un certificado de 16 bytes. PWD global unica por tarjeta.';
COMMENT ON TABLE nfc_ultralight_c_slots IS 'Certificados dinamicos rotativos para MIFARE Ultralight C. 8 slots por tarjeta (4 activos + 4 backups). 3DES 112-bit. Baja capacidad — usar solo si no se consigue NTAG215.';
COMMENT ON TABLE nfc_ntag215_pending IS 'Pre-aprobaciones pendientes de confirmacion de lectura/escritura en tarjeta NTAG215. TTL 30 segundos.';
COMMENT ON TABLE nfc_ultralight_c_pending IS 'Pre-aprobaciones pendientes de confirmacion de lectura/escritura en tarjeta Ultralight C. TTL 30 segundos.';
