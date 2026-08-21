-- Migracion 074: Numero de nodo SIP, pasarelas PSTN y facturacion VoIP
--
-- Agrega el numero unico de nodo (para SIP/VoIP federado),
-- pasarelas PSTN para llamadas a telefonos normales,
-- y sistema de saldo prepago para llamadas externas.

-- Agregar numero de nodo a node_config
ALTER TABLE node_config ADD COLUMN IF NOT EXISTS node_number INT;

-- Agregar numero de nodo a node_federation_keys (para compartir via federacion)
ALTER TABLE node_federation_keys ADD COLUMN IF NOT EXISTS peer_node_number INT;

-- === Pasarelas PSTN (para llamar/recibir de telefonos normales) ===
CREATE TABLE IF NOT EXISTS voip_pstn_gateways (
	id SERIAL PRIMARY KEY,
	name VARCHAR(128) NOT NULL,                       -- nombre descriptivo
	provider VARCHAR(128),                            -- proveedor SIP trunk (ej: VoIP.ms, Localphone)
	sip_server VARCHAR(256) NOT NULL,                 -- servidor SIP del proveedor
	sip_username VARCHAR(128) NOT NULL,               -- usuario SIP
	sip_password VARCHAR(256) NOT NULL,               -- password SIP
	inbound_number VARCHAR(32),                       -- numero telefonico entrante (E.164 ej: +5802123456789)
	is_active BOOLEAN NOT NULL DEFAULT true,
	max_concurrent_calls INT NOT NULL DEFAULT 2,
	cost_per_minute DECIMAL(10,4) DEFAULT 0,          -- costo por minuto en TQ
	billing_increment INT NOT NULL DEFAULT 60,        -- incrementos de facturacion en segundos (60 = 1 minuto)
	created_at TIMESTAMP DEFAULT NOW(),
	updated_at TIMESTAMP DEFAULT NOW()
);

-- === Saldo prepago VoIP para llamadas externas ===
CREATE TABLE IF NOT EXISTS voip_balance (
	id SERIAL PRIMARY KEY,
	user_id UUID REFERENCES users(id) ON DELETE CASCADE,
	balance BIGINT NOT NULL DEFAULT 0,                 -- saldo en centavos de TQ
	total_recharged BIGINT NOT NULL DEFAULT 0,         -- total recargado historico
	total_spent BIGINT NOT NULL DEFAULT 0,             -- total gastado historico
	updated_at TIMESTAMP DEFAULT NOW(),
	UNIQUE(user_id)
);

-- === Registro de llamadas (CDR - Call Detail Records) ===
CREATE TABLE IF NOT EXISTS voip_cdr (
	id SERIAL PRIMARY KEY,
	call_id VARCHAR(128),                              -- ID unico de la llamada
	user_id UUID REFERENCES users(id),                 -- usuario que hizo/recibio la llamada
	source_extension VARCHAR(32),                      -- extension origen
	destination VARCHAR(64) NOT NULL,                  -- numero destino
	destination_type VARCHAR(20) NOT NULL,             -- 'internal', 'federated', 'pstn'
	remote_node_number INT,                            -- numero del nodo remoto (si es federada)
	gateway_id INT REFERENCES voip_pstn_gateways(id),  -- pasarela usada (si es PSTN)
	start_time TIMESTAMP NOT NULL DEFAULT NOW(),
	end_time TIMESTAMP,
	duration INT NOT NULL DEFAULT 0,                   -- duracion en segundos
	billed_duration INT NOT NULL DEFAULT 0,            -- duracion facturada en segundos
	cost BIGINT NOT NULL DEFAULT 0,                    -- costo en centavos de TQ
	status VARCHAR(20) NOT NULL DEFAULT 'completed',   -- 'completed', 'failed', 'busy', 'no-answer'
	direction VARCHAR(10) NOT NULL DEFAULT 'outbound', -- 'inbound', 'outbound'
	created_at TIMESTAMP DEFAULT NOW()
);

-- === Recargas de saldo VoIP ===
CREATE TABLE IF NOT EXISTS voip_recharges (
	id SERIAL PRIMARY KEY,
	user_id UUID REFERENCES users(id) ON DELETE CASCADE,
	amount BIGINT NOT NULL,                            -- monto en centavos de TQ
	payment_method VARCHAR(64),                        -- 'transfer', 'cash', 'external'
	reference VARCHAR(128),                            -- referencia de pago
	status VARCHAR(20) NOT NULL DEFAULT 'pending',     -- 'pending', 'confirmed', 'rejected'
	processed_by UUID REFERENCES users(id),            -- admin que confirmo
	created_at TIMESTAMP DEFAULT NOW(),
	confirmed_at TIMESTAMP
);

-- === Tarifas VoIP por destino (para llamadas PSTN) ===
CREATE TABLE IF NOT EXISTS voip_rates (
	id SERIAL PRIMARY KEY,
	prefix VARCHAR(16) NOT NULL,                       -- prefijo de destino (ej: '58' para Venezuela)
	description VARCHAR(128),                          -- 'Venezuela fijo', 'Venezuela movil'
	rate_per_minute BIGINT NOT NULL,                   -- tarifa en centavos de TQ por minuto
	billing_increment INT NOT NULL DEFAULT 60,         -- incrementos en segundos
	is_active BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMP DEFAULT NOW(),
	UNIQUE(prefix)
);

-- Tarifas por defecto (ejemplos, ajustar segun proveedor)
INSERT INTO voip_rates (prefix, description, rate_per_minute, billing_increment)
VALUES
	('58', 'Venezuela', 50, 60),
	('1', 'USA/Canada', 20, 60),
	('34', 'Espana', 30, 60),
	('52', 'Mexico', 25, 60),
	('57', 'Colombia', 25, 60),
	('55', 'Brasil', 30, 60),
	('56', 'Chile', 25, 60),
	('51', 'Peru', 25, 60),
	('593', 'Ecuador', 25, 60),
	('591', 'Bolivia', 30, 60),
	('598', 'Uruguay', 30, 60),
	('54', 'Argentina', 25, 60),
	('00', 'Internacional resto', 100, 60)
ON CONFLICT (prefix) DO NOTHING;
