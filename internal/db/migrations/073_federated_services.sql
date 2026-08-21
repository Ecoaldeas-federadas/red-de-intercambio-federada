-- Migracion 073: Servicios federados y autohospedados para aldeas
--
-- Catalogo de servicios que se pueden instalar via Docker
-- desde la pagina "Servicios Federados" del nodo.
-- Incluye telefonía VoIP con codigo de aldea unico.

-- Catalogo de servicios disponibles (definido por codigo, no por BD)
-- Esta tabla guarda los servicios instalados en este nodo
CREATE TABLE IF NOT EXISTS installed_services (
	id SERIAL PRIMARY KEY,
	service_id VARCHAR(64) NOT NULL UNIQUE,        -- 'peertube', 'mastodon', 'matrix', etc.
	service_name VARCHAR(128) NOT NULL,             -- nombre legible
	category VARCHAR(64) NOT NULL,                  -- 'social', 'comunicacion', 'productividad', 'multimedia', 'desarrollo'
	subdomain VARCHAR(128),                          -- 'video.aldea1.com'
	container_name VARCHAR(128),                     -- nombre del contenedor Docker
	docker_compose_path VARCHAR(256),                -- ruta al docker-compose.yml
	status VARCHAR(20) NOT NULL DEFAULT 'not_installed', -- 'not_installed', 'installing', 'running', 'stopped', 'error'
	port INT,                                        -- puerto principal del servicio
	installed_at TIMESTAMP,
	updated_at TIMESTAMP DEFAULT NOW()
);

-- Configuracion VoIP del nodo (codigo de aldea unico)
CREATE TABLE IF NOT EXISTS voip_config (
	id SERIAL PRIMARY KEY,
	village_code INT NOT NULL,                       -- codigo unico de aldea (ej: 101, 102)
	village_name VARCHAR(128),                       -- nombre descriptivo
	enabled BOOLEAN NOT NULL DEFAULT false,
	server_port INT NOT NULL DEFAULT 5060,           -- puerto SIP
	rtp_start INT NOT NULL DEFAULT 10000,            -- rango inicio RTP
	rtp_end INT NOT NULL DEFAULT 20000,              -- rango fin RTP
	updated_at TIMESTAMP DEFAULT NOW()
);

-- Extensiones telefonicas locales de la aldea
CREATE TABLE IF NOT EXISTS voip_extensions (
	id SERIAL PRIMARY KEY,
	extension VARCHAR(16) NOT NULL UNIQUE,           -- '2001', '2002', etc.
	display_name VARCHAR(128),                       -- nombre de la persona
	user_id VARCHAR(128),                            -- referencia al usuario del nodo (opcional)
	password VARCHAR(256),                           -- password SIP (cifrada en produccion)
	is_active BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMP DEFAULT NOW(),
	updated_at TIMESTAMP DEFAULT NOW()
);

-- Rutas VoIP federadas a otras aldeas
CREATE TABLE IF NOT EXISTS voip_routes (
	id SERIAL PRIMARY KEY,
	remote_village_code INT NOT NULL,                -- codigo de la aldea remota (ej: 105)
	remote_village_name VARCHAR(128),                -- nombre descriptivo
	remote_endpoint VARCHAR(256),                    -- direccion SIP de la aldea remota
	remote_domain VARCHAR(128),                      -- dominio de la aldea remota
	is_active BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMP DEFAULT NOW(),
	UNIQUE(remote_village_code)
);

-- Insertar configuracion VoIP por defecto (sin codigo, se genera al activar)
INSERT INTO voip_config (village_code, enabled)
VALUES (0, false)
ON CONFLICT DO NOTHING;
