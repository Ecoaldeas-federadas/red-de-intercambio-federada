-- Migracion 151: Registry de drivers NFC auto-instalables (.nfcpkg)
--
-- Este sistema permite instalar nuevos drivers de tarjetas NFC desde la web admin
-- sin recompilar el servidor. Los drivers se empaquetan en archivos .nfcpkg
-- (ZIP firmado con Ed25519) y se ejecutan en un sandbox JavaScript (Goja).
--
-- Modelo de firma: por-nodo (federado, no centralizado).
-- Cada nodo genera su propia clave Ed25519 para firmar drivers.
-- La clave publica se asocia al node_domain del nodo firmante.
-- Los nodos federados ya intercambian claves publicas (federation existente).
-- El admin puede agregar claves confiables manualmente desde la UI.

-- ===== Tabla: nfc_card_drivers =====
-- Registry de drivers instalados (dinamicos, desde .nfcpkg)
CREATE TABLE IF NOT EXISTS nfc_card_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT UNIQUE NOT NULL,               -- "ntag216", "mifare_plus_x", etc.
    display_name TEXT NOT NULL,
    version TEXT NOT NULL,                   -- "1.0.0"
    description TEXT NOT NULL DEFAULT '',
    manufacturer TEXT NOT NULL DEFAULT '',
    capacity TEXT NOT NULL DEFAULT 'full',   -- "full", "low"
    manifest JSONB NOT NULL,                 -- manifest.json completo
    driver_js TEXT NOT NULL,                 -- codigo JS del driver (Goja sandbox)
    reader_json TEXT NOT NULL,               -- reader.json declarativo (Android)
    migration_sql TEXT,                      -- migracion ejecutada (NULL si no tenia)
    signature TEXT NOT NULL,                 -- firma Ed25519 (hex)
    signed_by TEXT NOT NULL,                 -- node_domain del nodo que firmo
    trust_level TEXT NOT NULL DEFAULT 'self',-- "self", "federated", "manual"
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_builtin BOOLEAN NOT NULL DEFAULT false, -- true para drivers Go compilados
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shared_with_federation BOOLEAN NOT NULL DEFAULT false,
    package_hash TEXT NOT NULL DEFAULT ''    -- SHA256 del .nfcpkg completo
);

-- Indice para buscar por tipo rapidamente
CREATE INDEX IF NOT EXISTS idx_nfc_card_drivers_type
    ON nfc_card_drivers(type);
CREATE INDEX IF NOT EXISTS idx_nfc_card_drivers_active
    ON nfc_card_drivers(is_active) WHERE is_active = true;

-- ===== Tabla: nfc_driver_signing_keys =====
-- Claves publicas Ed25519 confiables para verificar firmas de .nfcpkg
CREATE TABLE IF NOT EXISTS nfc_driver_signing_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,                     -- "Nodo A", "Programador X", etc.
    node_domain TEXT,                        -- node_domain del nodo (NULL si es manual)
    public_key TEXT NOT NULL,                -- Ed25519 public key (hex, 64 chars)
    trust_level TEXT NOT NULL,               -- "self", "federated", "manual"
    is_active BOOLEAN NOT NULL DEFAULT true,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(public_key)
);

CREATE INDEX IF NOT EXISTS idx_nfc_driver_signing_keys_domain
    ON nfc_driver_signing_keys(node_domain);
CREATE INDEX IF NOT EXISTS idx_nfc_driver_signing_keys_active
    ON nfc_driver_signing_keys(is_active) WHERE is_active = true;

-- ===== Tabla: nfc_driver_packages_cache =====
-- Cache de paquetes .nfcpkg recibidos de nodos federados via gossip
-- pero que aun no se han instalado
CREATE TABLE IF NOT EXISTS nfc_driver_packages_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,                      -- tipo de tarjeta
    version TEXT NOT NULL,                   -- version del driver
    display_name TEXT NOT NULL DEFAULT '',
    package_data BYTEA NOT NULL,             -- .nfcpkg completo (ZIP binario)
    package_hash TEXT NOT NULL,              -- SHA256 del paquete
    shared_by TEXT NOT NULL,                 -- node_domain que lo compartio
    signature TEXT NOT NULL,                 -- firma Ed25519 (hex)
    signed_by TEXT NOT NULL,                 -- node_domain del firmante
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    installed BOOLEAN NOT NULL DEFAULT false,
    dismissed BOOLEAN NOT NULL DEFAULT false,-- admin lo descarto
    UNIQUE(type, version)
);

CREATE INDEX IF NOT EXISTS idx_nfc_driver_packages_cache_type
    ON nfc_driver_packages_cache(type);
CREATE INDEX IF NOT EXISTS idx_nfc_driver_packages_cache_pending
    ON nfc_driver_packages_cache(type, version) WHERE installed = false AND dismissed = false;

-- ===== Tabla: nfc_driver_signing_keys_local =====
-- Clave privada Ed25519 del nodo para firmar drivers que crea
-- Se guarda encriptada con la master key del nodo
CREATE TABLE IF NOT EXISTS nfc_driver_signing_keys_local (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT UNIQUE NOT NULL,
    private_key_encrypted BYTEA NOT NULL,    -- Ed25519 private key (encriptada)
    public_key TEXT NOT NULL,                -- Ed25519 public key (hex, 64 chars)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
