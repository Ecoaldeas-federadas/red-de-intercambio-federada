-- 130_pos_web_sessions.sql
-- Sesiones web expirables para el POS web.
-- A diferencia de Android/ESP32 (pairing permanente), el POS web usa
-- sesiones temporales por navegador que el dueño del terminal aprueba.

-- Columnas en nfc_terminals para sesiones web expirables
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS web_session_expires_at TIMESTAMPTZ;
ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS web_session_requested_at TIMESTAMPTZ;

-- Tabla de solicitudes de sesion web (similar a terminal_pairing_requests
-- pero aprobada por el DUEÑO del terminal, no por el admin)
CREATE TABLE IF NOT EXISTS pos_web_session_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- terminal_id (texto unico, no el UUID PK) del terminal web_pos
    terminal_id TEXT NOT NULL,
    -- Clave publica Ed25519 del navegador (efimera, se regenera por navegador)
    terminal_public_key TEXT NOT NULL,
    -- Huella del navegador
    device_fingerprint TEXT,
    -- Codigo de 4 digitos que el POS web muestra al usuario
    pairing_code TEXT NOT NULL,
    -- Estado: pending, approved, rejected, expired
    status TEXT NOT NULL DEFAULT 'pending',
    -- Cuantas horas aprobo el dueno (1, 5, 24)
    approved_hours INT,
    -- Quien aprobo (el dueno del terminal, no el admin)
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    -- Cuando expira la sesion (approved_at + approved_hours)
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice para buscar solicitudes pendientes por terminal
CREATE INDEX IF NOT EXISTS idx_pos_web_session_pending
ON pos_web_session_requests(terminal_id, status)
WHERE status = 'pending';

-- Indice para buscar por terminal y ver historial
CREATE INDEX IF NOT EXISTS idx_pos_web_session_terminal
ON pos_web_session_requests(terminal_id, created_at DESC);
