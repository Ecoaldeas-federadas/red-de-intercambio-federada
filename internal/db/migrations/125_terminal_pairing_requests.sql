-- Migracion 125: Emparejamiento de terminales por codigo corto
--
-- En lugar de pedir credenciales de administrador en el terminal (peligroso)
-- o copiar manualmente un token UUID largo, el terminal genera su clave
-- Ed25519 localmente, envia su clave publica al servidor, y el servidor
-- responde con un codigo corto de 6 digitos. El administrador ve el codigo
-- en su panel web y lo aprueba con un clic. El intercambio de claves publicas
-- se hace automaticamente. Todo expira en 60 segundos.

CREATE TABLE IF NOT EXISTS terminal_pairing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    -- Codigo corto de 6 digitos que el terminal muestra en pantalla
    pairing_code VARCHAR(6) NOT NULL,
    -- Clave publica Ed25519 del terminal (hex, 32 bytes)
    terminal_public_key TEXT NOT NULL,
    -- Huella del dispositivo Android
    device_fingerprint TEXT,
    -- Etiqueta opcional que el terminal sugiere
    terminal_label TEXT,
    terminal_type TEXT NOT NULL DEFAULT 'android',
    -- Estado: pending, approved, expired, rejected
    status TEXT NOT NULL DEFAULT 'pending',
    -- Admin que aprobo o rechazo
    admin_user_id UUID REFERENCES users(id),
    -- Datos asignados al aprobar
    terminal_id TEXT,
    registration_token TEXT,
    -- Timestamps
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice unico para codigo pendiente (no se pueden repetir codigos pendientes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pairing_code_pending
    ON terminal_pairing_requests(pairing_code) WHERE status = 'pending';

-- Indice para listar pendientes por nodo
CREATE INDEX IF NOT EXISTS idx_pairing_node_pending
    ON terminal_pairing_requests(node_domain, status, expires_at);

-- Indice para rate limiting por fingerprint
CREATE INDEX IF NOT EXISTS idx_pairing_fingerprint
    ON terminal_pairing_requests(device_fingerprint, created_at);
