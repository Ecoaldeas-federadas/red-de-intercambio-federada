-- Migracion 146: Usuarios autorizados por terminal
-- Permite asignar multiples personas a un terminal, ademas del merchant_user_id unico.
-- Esto soporta el caso donde una organizacion quiere que varias personas puedan
-- usar el mismo punto de venta (ej: turno manana, turno tarde).
-- Tambien soporta asignar personas especificas adicionales a un terminal de
-- organizacion o departamento.

CREATE TABLE IF NOT EXISTS nfc_terminal_authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terminal_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(terminal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_term_auth_users_terminal ON nfc_terminal_authorized_users(terminal_id);
CREATE INDEX IF NOT EXISTS idx_term_auth_users_user ON nfc_terminal_authorized_users(user_id);
