-- Migracion 072: Configuracion de red privada federada (OpenWrt)
--
-- Almacena la configuracion de red del nodo para integrarse con
-- OpenWrt (servidor de aldea). OpenWrt es opcional: el nodo
-- funciona sin el por Internet normal.

-- Configuracion de red del nodo
CREATE TABLE IF NOT EXISTS network_config (
	id SERIAL PRIMARY KEY,
	mode VARCHAR(20) NOT NULL DEFAULT 'internet',  -- 'internet', 'intranet', 'both'
	ipv6_ula VARCHAR(64),                           -- fdXX:XXXX:XXXX::/48
	subdomain VARCHAR(64),                          -- 'nodo' -> nodo.aldea1.com
	openwrt_address VARCHAR(128),                   -- IP/IPv6 del OpenWrt
	openwrt_domain VARCHAR(128),                    -- aldea1.com (dominio publico)
	openwrt_token VARCHAR(256),                     -- Token API de OpenWrt
	stun_server VARCHAR(128),                       -- stun.aldea1.com:3478
	wireguard_port INT NOT NULL DEFAULT 51820,
	wireguard_private_key TEXT,                     -- Clave privada WireGuard del nodo
	wireguard_public_key VARCHAR(128),              -- Clave publica WireGuard del nodo
	updated_at TIMESTAMP DEFAULT NOW()
);

-- Peers de la intranet (otras aldeas federadas por tunel WireGuard)
CREATE TABLE IF NOT EXISTS network_peers (
	id SERIAL PRIMARY KEY,
	peer_domain VARCHAR(128) NOT NULL UNIQUE,       -- aldea2.com
	peer_name VARCHAR(128),                         -- nombre descriptivo
	peer_ipv6_ula VARCHAR(64),                      -- fdXX:aldeaB::/48
	peer_endpoint VARCHAR(256),                     -- direccion:puerto o dominio
	peer_public_key VARCHAR(128),                   -- clave publica WireGuard
	status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'active', 'inactive'
	mutual_verified BOOLEAN NOT NULL DEFAULT false,
	notes TEXT,
	created_at TIMESTAMP DEFAULT NOW(),
	updated_at TIMESTAMP DEFAULT NOW()
);

-- Servicios locales registrados en el DNS de OpenWrt
CREATE TABLE IF NOT EXISTS network_services (
	id SERIAL PRIMARY KEY,
	name VARCHAR(64) NOT NULL,                      -- 'tienda', 'voip', 'video'
	ipv6_address VARCHAR(64) NOT NULL,              -- fd12:3456:7890::20
	description TEXT,
	is_registered BOOLEAN NOT NULL DEFAULT false,   -- true si esta registrado en OpenWrt
	created_at TIMESTAMP DEFAULT NOW(),
	updated_at TIMESTAMP DEFAULT NOW(),
	UNIQUE(name)
);

-- Insertar configuracion por defecto (modo internet, sin OpenWrt)
INSERT INTO network_config (mode, wireguard_port)
VALUES ('internet', 51820)
ON CONFLICT DO NOTHING;
