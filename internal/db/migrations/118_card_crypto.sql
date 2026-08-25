-- Migracion 118: Modelo criptografico completo para tarjetas NFC
-- Las tarjetas ya no son "tontas" (solo UID). Ahora tienen claves AES-128
-- embebidas que prueban criptograficamente que son legitimas.
--
-- Modelos soportados:
-- 1. NTAG424 SUN: la tarjeta genera MAC(AES, UID|counter) en cada tap
-- 2. DESFire EV3: challenge-response AES completo
-- 3. MIFARE Classic: claves A/B por sector (menos seguro, legacy)
--
-- Flujo:
-- 1. Servidor genera clave AES-128 por tarjeta
-- 2. Clave se escribe en la tarjeta durante el provisionamiento
-- 3. Clave se guarda cifrada en la BD (cifrada con clave maestra del nodo)
-- 4. Terminal/app lee tarjeta, pide clave al servidor (canal cifrado Ed25519+AES)
-- 5. Terminal descifra clave en memoria (nunca en disco)
-- 6. Terminal hace challenge-response con la tarjeta
-- 7. Tarjeta responde con HMAC/AES del challenge
-- 8. Terminal envia UID + prueba criptografica al servidor
-- 9. Servidor verifica y procesa el pago

-- Extender nfc_card_keys con campos del modelo criptografico
ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS aes_key_encrypted BYTEA;
-- Clave AES-128 cifrada con clave maestra del nodo (32 bytes cifrados)

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS key_version INT DEFAULT 1;
-- Version de la clave (para rotacion)

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS card_public_key TEXT;
-- Llave publica de la tarjeta (si usa Ed25519 propio, opcional)

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS last_auth_at TIMESTAMPTZ;
-- Ultima autenticacion criptografica exitosa

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS auth_fail_count INT DEFAULT 0;
-- Contador de fallos de autenticacion

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS crypto_blocked_until TIMESTAMPTZ;
-- Bloqueada despues de muchos fallos

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS sun_counter BIGINT DEFAULT 0;
-- Contador SUN (NTAG424) - incrementa en cada tap

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS provisioned_by UUID REFERENCES users(id);
-- Quien provisiono la tarjeta

ALTER TABLE nfc_card_keys ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;
-- Fecha de provisionamiento

-- Tabla para challenges pendientes (anti-replay)
CREATE TABLE IF NOT EXISTS nfc_card_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    challenge TEXT NOT NULL,
    -- Challenge enviado a la tarjeta (random nonce)
    expected_response TEXT,
    -- Respuesta esperada (HMAC del challenge)
    terminal_id TEXT,
    -- Terminal que solicito el challenge
    used BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_challenges_uid ON nfc_card_challenges (card_uid, used);
CREATE INDEX IF NOT EXISTS idx_nfc_challenges_expires ON nfc_card_challenges (expires_at);

-- Tabla para claves maestras de nodo (cifra las claves AES de las tarjetas)
CREATE TABLE IF NOT EXISTS node_master_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL UNIQUE,
    -- Clave maestra cifrada con clave de entorno (NODE_MASTER_KEY)
    master_key_encrypted BYTEA NOT NULL,
    -- Salt para derivar la clave de cifrado
    key_salt BYTEA NOT NULL,
    key_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ
);

-- Tabla para sesiones de distribucion de claves a terminales/apps
-- Cuando una app pide la clave de una tarjeta, se registra aqui
-- para auditoria y para invalidar si la app se compromete
CREATE TABLE IF NOT EXISTS card_key_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid TEXT NOT NULL,
    terminal_id TEXT,
    -- Terminal o app que solicito la clave
    session_token TEXT NOT NULL UNIQUE,
    -- Token de sesion para esta distribucion
    key_delivered BOOLEAN NOT NULL DEFAULT false,
    -- Si la clave fue entregada
    challenge_verified BOOLEAN NOT NULL DEFAULT false,
    -- Si el challenge-response fue verificado
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_key_sessions_token ON card_key_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_card_key_sessions_card ON card_key_sessions (card_uid);
