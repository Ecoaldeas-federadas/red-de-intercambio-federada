-- Migracion 079: Info de red de nodos federados
--
-- Cuando un nodo federado cambia su config de red (dominio, IP, IPv6 ULA,
-- WireGuard, servicios), la comparte automaticamente con sus peers.
-- Los peers guardan esta info aqui para poder encontrar al nodo remoto
-- y ver que servicios tiene levantados.

CREATE TABLE IF NOT EXISTS federation_node_info (
  node_domain VARCHAR(128) PRIMARY KEY,    -- dominio del nodo remoto
  node_name VARCHAR(128),                  -- nombre descriptivo
  -- Direccion por Internet
  public_domain VARCHAR(128),              -- dominio o IP publica
  -- Direccion por Intranet (OpenWrt)
  ipv6_ula VARCHAR(64),                    -- fdXX:XXXX:XXXX::/48
  wireguard_endpoint VARCHAR(128),         -- direccion:puerto
  wireguard_public_key TEXT,               -- clave publica WireGuard
  wireguard_port INT,                      -- puerto WireGuard
  -- Modo de red del nodo remoto
  network_mode VARCHAR(20),                -- 'internet', 'intranet', 'both'
  -- Servicios que tiene levantados (JSON array)
  -- [{"name":"chat","url":"chat.aldea.com","description":"Mensajeria"}, ...]
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Cuando se actualizo por ultima vez
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Si el nodo esta activo
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Indice para buscar por dominio publico
-- (cuando un nodo quiere encontrar a otro por su dominio)
