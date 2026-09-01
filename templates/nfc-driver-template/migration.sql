-- Migracion para MIDRIVER (auto-instalada desde .nfcpkg)
-- Se ejecuta en una transaccion. Si falla, se hace rollback.
-- SOLO se permite DDL (CREATE, ALTER, CREATE INDEX).
-- NO se permite INSERT, UPDATE, DELETE, DROP de tablas existentes.

CREATE TABLE IF NOT EXISTS nfc_midriver_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    node_domain TEXT NOT NULL,
    slot_number INT NOT NULL,
    is_backup BOOLEAN NOT NULL DEFAULT false,
    backup_of_slot INT,
    start_page INT NOT NULL,
    end_page INT NOT NULL,
    certificate BYTEA,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(card_uid, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_nfc_midriver_slots_uid
    ON nfc_midriver_slots(card_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_midriver_slots_active
    ON nfc_midriver_slots(card_uid, is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS nfc_midriver_pending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    read_slot INT NOT NULL,
    write_slot INT NOT NULL,
    new_certificate BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 seconds'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_midriver_pending_card
    ON nfc_midriver_pending(card_uid, expires_at);
CREATE INDEX IF NOT EXISTS idx_nfc_midriver_pending_expiry
    ON nfc_midriver_pending(expires_at);
