-- Migracion 098: POS Web - device fingerprint, cargos QR, y pagos

-- Agregar columna de huella de dispositivo a nfc_terminals
-- Para terminales web_pos, esto verifica que el dispositivo sea el mismo
-- incluso si alguien copia la caché del navegador a otra maquina
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Codigo de bloqueo local (hash bcrypt) - el usuario puede bloquear/desbloquear
-- el terminal desde el mismo POS con un codigo, sin necesidad del admin
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS block_code_hash TEXT;

-- Asignar terminal a un usuario (merchant) - el admin asigna el terminal
-- a un usuario despues de registrarlo. El usuario puede entonces:
-- - ver el terminal en su cuenta
-- - abrir/cerrar sesiones
-- - bloquear/desbloquear
-- - ver transacciones del terminal
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS merchant_user_id UUID REFERENCES users(id);

-- Tabla de cargos del POS (QR payments)
-- Cuando el POS crea un cargo, se registra aqui con un token unico.
-- El QR contiene {apiURL}/pay?t={token}
-- El cliente escanea, va a /pay, el backend resuelve el cargo por token,
-- muestra el monto, el cliente inicia sesion y acepta pagar.
-- El backend marca el cargo como pagado y el POS lo detecta via polling.
CREATE TABLE IF NOT EXISTS pos_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    terminal_id UUID REFERENCES nfc_terminals(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES users(id),
    charge_token TEXT NOT NULL UNIQUE,          -- token unico para el QR
    amount BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',     -- pending, paid, cancelled, expired
    payer_id UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,
    payment_method TEXT,                         -- qr, nfc
    description TEXT,
    -- Firma del cargo: el terminal firma el cargo con su clave Ed25519
    -- para que el backend pueda verificar que el cargo fue creado por este terminal
    terminal_signature TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_pos_charges_token ON pos_charges(charge_token);
CREATE INDEX IF NOT EXISTS idx_pos_charges_terminal ON pos_charges(terminal_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_charges_merchant ON pos_charges(merchant_id, status);

-- PIN de pago de 4 digitos para NFC (hash, nunca plaintext)
-- Esto es distinto del PIN de la tarjeta NFC - es el PIN que el dueno
-- de la cuenta configura para autorizar pagos desde el POS web
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_pin_hash TEXT;
