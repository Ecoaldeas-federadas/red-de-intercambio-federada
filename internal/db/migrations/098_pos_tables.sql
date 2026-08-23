-- Migracion 098: POS Web - device fingerprint, cargos QR, pagos, y asignacion a organizaciones

-- Agregar columna de huella de dispositivo a nfc_terminals
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Codigo de bloqueo local (hash bcrypt)
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS block_code_hash TEXT;

-- Asignacion de terminales:
-- - El admin (Asamblea) asigna el terminal a una ORGANIZACION
-- - La organizacion lo asigna a un departamento o a un miembro
-- - merchant_user_id es el usuario autorizado actual (puede cambiar por turnos)
-- - organization_id es la organizacion duena del terminal
-- - department_id es el departamento al que esta asignado (opcional)
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS merchant_user_id UUID REFERENCES users(id);
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS department_id UUID;

-- Tabla de turnos de POS (apertura/cierre)
-- Cada vez que un usuario autorizado abre el terminal, se crea un turno.
-- Cuando cierra, se registra el cierre con el total vendido.
-- Esto permite a la organizacion ver:
-- - Quien uso el terminal y cuando
-- - Cuanto vendio cada usuario en su turno
-- - Cambios de turno
CREATE TABLE IF NOT EXISTS pos_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terminal_id UUID NOT NULL REFERENCES nfc_terminals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    department_id UUID,
    status TEXT NOT NULL DEFAULT 'open', -- open, closed
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_amount BIGINT NOT NULL DEFAULT 0,
    closing_amount BIGINT,
    total_sales BIGINT NOT NULL DEFAULT 0,
    transactions_count INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_shifts_terminal ON pos_shifts(terminal_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_user ON pos_shifts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_org ON pos_shifts(organization_id, status);

-- Tabla de cargos del POS (QR payments)
CREATE TABLE IF NOT EXISTS pos_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    terminal_id UUID REFERENCES nfc_terminals(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES users(id),
    charge_token TEXT NOT NULL UNIQUE,
    amount BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payer_id UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    description TEXT,
    terminal_signature TEXT,
    shift_id UUID REFERENCES pos_shifts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_pos_charges_token ON pos_charges(charge_token);
CREATE INDEX IF NOT EXISTS idx_pos_charges_terminal ON pos_charges(terminal_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_charges_merchant ON pos_charges(merchant_id, status);

-- PIN de pago de 4 digitos para NFC (hash)
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_pin_hash TEXT;
