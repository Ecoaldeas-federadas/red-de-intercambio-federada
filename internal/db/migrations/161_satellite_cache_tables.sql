-- Migracion 161: Tablas de cache del nodo satelite
--
-- satellite_cached_users: cache de usuarios de otros nodos descargados
--   antes de desconectarse. Contiene saldo actual y password_hash para
--   autenticacion offline.
--
-- satellite_cached_cards: cache de tarjetas NFC de otros nodos.
--
-- satellite_pending_tx: transacciones registradas offline, pendientes
--   de sincronizar con el nodo origen al reconectar.

CREATE TABLE IF NOT EXISTS satellite_cached_users (
  id UUID PRIMARY KEY,
  node_domain TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  balance BIGINT NOT NULL DEFAULT 0,
  credit_limit BIGINT NOT NULL DEFAULT -50000,
  debit_limit BIGINT NOT NULL DEFAULT 50000,
  membership_status TEXT NOT NULL DEFAULT 'active',
  password_hash TEXT NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, username)
);

CREATE INDEX IF NOT EXISTS idx_sat_cached_users_username
  ON satellite_cached_users(LOWER(username));

CREATE TABLE IF NOT EXISTS satellite_cached_cards (
  card_uid TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  node_domain TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'uid_only',
  is_active BOOLEAN NOT NULL DEFAULT true,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satellite_pending_tx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  sender_node TEXT NOT NULL,
  receiver_id UUID NOT NULL,
  receiver_node TEXT NOT NULL,
  amount BIGINT NOT NULL,
  satellite_signature TEXT NOT NULL,
  user_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ,
  sync_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sat_pending_tx_unsynced
  ON satellite_pending_tx(synced) WHERE synced = false;
