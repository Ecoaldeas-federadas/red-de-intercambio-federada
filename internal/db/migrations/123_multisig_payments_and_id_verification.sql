-- Migracion 123: Pagos multi-firma para organizaciones + verificacion de documento para tarjetas UID-only
--
-- Dos nuevas caracteristicas:
-- 1. Cuando una cuenta de organizacion tiene required_signatures > 1, los pagos
--    desde esa cuenta quedan pendientes hasta que todos los firmantes autorizados
--    confirmen (con su tarjeta NFC + PIN, o via web).
-- 2. Para tarjetas UID-only (baratas, clonables), el nodo puede configurar que
--    se pida ademas del PIN el numero de documento de identidad del dueno.

-- ============================================================
-- 1. VERIFICACION DE DOCUMENTO PARA TARJETAS UID-ONLY
-- ============================================================

ALTER TABLE nfc_card_type_config ADD COLUMN IF NOT EXISTS require_id_document_for_uid_only BOOLEAN NOT NULL DEFAULT false;
-- Si es true, las tarjetas UID-only deben presentar documento de identidad ademas del PIN

-- ============================================================
-- 2. PAGOS MULTI-FIRMA PENDIENTES
-- ============================================================

-- Pagos pendientes que requieren multiples firmas antes de ejecutarse
-- Aplica a: transferencias internas, pagos NFC, pagos POS QR
CREATE TABLE IF NOT EXISTS pending_multisig_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    -- Tipo de pago: 'transfer', 'nfc', 'pos_qr'
    payment_type TEXT NOT NULL,
    -- Cuenta que envia el pago (organizacion con multi-sig)
    from_account UUID NOT NULL REFERENCES users(id),
    -- Cuenta que recibe el pago
    to_account UUID NOT NULL REFERENCES users(id),
    -- Monto del pago
    amount BIGINT NOT NULL,
    -- Numero de firmas requeridas (copiado de from_account.required_signatures al crear)
    required_signatures INT NOT NULL DEFAULT 1,
    -- Firmantes autorizados (copiado de from_account.authorized_signers)
    authorized_signers UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    -- Firmas recolectadas: array de objetos {signer_id, timestamp, method}
    collected_signatures JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Estado: 'pending', 'executed', 'expired', 'cancelled'
    status TEXT NOT NULL DEFAULT 'pending',
    -- Metodo de pago: 'nfc', 'qr', 'transfer'
    payment_method TEXT,
    -- ID del terminal NFC (si aplica)
    terminal_id UUID REFERENCES nfc_terminals(id),
    -- ID del cargo POS (si aplica)
    pos_charge_id UUID REFERENCES pos_charges(id),
    -- Descripcion / concepto
    description TEXT,
    -- Metadata adicional (JSON)
    metadata JSONB,
    -- Expiracion (24 horas por defecto)
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_multisig_from ON pending_multisig_payments(from_account, status);
CREATE INDEX IF NOT EXISTS idx_pending_multisig_to ON pending_multisig_payments(to_account, status);
CREATE INDEX IF NOT EXISTS idx_pending_multisig_status ON pending_multisig_payments(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_multisig_terminal ON pending_multisig_payments(terminal_id, status);

-- Tabla para firmas individuales de pagos multi-sig (auditoria)
CREATE TABLE IF NOT EXISTS multisig_payment_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_payment_id UUID NOT NULL REFERENCES pending_multisig_payments(id) ON DELETE CASCADE,
    signer_id UUID NOT NULL REFERENCES users(id),
    -- Metodo: 'nfc_card', 'web', 'pin'
    method TEXT NOT NULL DEFAULT 'nfc_card',
    -- Card UID usado (si fue NFC)
    card_uid TEXT,
    -- Si se verifico PIN
    pin_verified BOOLEAN NOT NULL DEFAULT false,
    -- Si se verifico documento de identidad
    id_document_verified BOOLEAN NOT NULL DEFAULT false,
    -- Firma criptografica (si aplica)
    signature TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pending_payment_id, signer_id)
);

CREATE INDEX IF NOT EXISTS idx_msig_sigs_payment ON multisig_payment_signatures(pending_payment_id);
CREATE INDEX IF NOT EXISTS idx_msig_sigs_signer ON multisig_payment_signatures(signer_id);
