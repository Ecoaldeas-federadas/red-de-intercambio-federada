-- 006_node_config_and_federation_keys.sql
-- Configuracion del nodo y claves de federacion entre nodos.
--
-- node_config: guarda la configuracion del nodo en la BD (no en archivos).
--   Se llena desde el setup wizard la primera vez.
--   Contiene: nombre, dominio, claves Ed25519 del nodo, JWT secret.
--
-- node_federation_keys: claves publicas de otros nodos con los que este nodo
--   se ha federado. Para que dos nodos se comuniquen, AMBOS deben registrarse
--   mutuamente: yo registro la clave publica del otro, y el otro registra la mia.

CREATE TABLE IF NOT EXISTS node_config (
    id              SERIAL PRIMARY KEY,
    node_domain     VARCHAR(255) NOT NULL UNIQUE,
    node_name       VARCHAR(255) NOT NULL,
    -- Claves Ed25519 del nodo (para federacion)
    node_public_key  VARCHAR(64) NOT NULL,   -- 32 bytes en hex
    node_private_key_enc BYTEA,               -- encriptada con la password del admin
    -- JWT secret para sesiones (generado aleatoriamente)
    jwt_secret      VARCHAR(128) NOT NULL,
    -- Configuracion adicional (JSON)
    settings        JSONB DEFAULT '{}',
    initialized     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS node_federation_keys (
    id              SERIAL PRIMARY KEY,
    peer_domain     VARCHAR(255) NOT NULL UNIQUE,
    peer_name       VARCHAR(255),
    peer_public_key VARCHAR(64) NOT NULL,   -- 32 bytes en hex (clave publica del otro nodo)
    peer_endpoint   VARCHAR(255),           -- URL del otro nodo (ej: https://nodo-b.org)
    -- Estado de la federacion
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, active, suspended
    -- Verificacion mutua: el otro nodo tambien nos registro a nosotros?
    mutual_verified BOOLEAN NOT NULL DEFAULT false,
    -- Metadatos
    added_by        UUID REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_federation_keys_domain ON node_federation_keys(peer_domain);
CREATE INDEX IF NOT EXISTS idx_node_federation_keys_status ON node_federation_keys(status);
