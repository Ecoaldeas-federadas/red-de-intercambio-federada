-- Migracion 130: Federation pairing requests (verificacion de 4 opciones)
--
-- Tabla para solicitudes de union a la federacion con codigo de verificacion.
-- El nodo nuevo genera un codigo, el nodo existente (padrino) ve 4 opciones
-- y debe elegir el correcto, obligando comunicacion fuera de banda.

CREATE TABLE IF NOT EXISTS federation_pairing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_domain VARCHAR(255) NOT NULL,
  requesting_public_key VARCHAR(64) NOT NULL,
  requesting_endpoint VARCHAR(255),
  pairing_code VARCHAR(6) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sponsor_domain VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
  confirmed_at TIMESTAMPTZ,
  failed_attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fed_pair_code ON federation_pairing_requests(pairing_code);
CREATE INDEX IF NOT EXISTS idx_fed_pair_status ON federation_pairing_requests(status);
