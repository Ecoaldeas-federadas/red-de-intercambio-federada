-- Migracion 128: Piscina global federada + integridad distribuida
--
-- Antes: todas las transacciones cross-node se registraban como 'node_bridge'
-- con counterpart_node = nodo receptor. El balance era bilateral.
-- El "global" era solo un limite/check secundario, no una piscina real.
--
-- Ahora: distinguimos dos tipos de pool:
--   - 'global': piscina global multilateral, saldo compartido entre todos los nodos
--   - 'bilateral': piscina bilateral, saldo entre dos nodos especificos
--
-- Ademas: tabla cross_node_tx_chain para firma dual y hash encadenado,
-- garantizando integridad y suma cero entre nodos autónomos.

-- Añadir columna pool_type a ledger_entries
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS pool_type TEXT NOT NULL DEFAULT 'global';

-- Migrar entries existentes:
-- Los que tenian acuerdo bilateral customizado -> 'bilateral'
-- El resto -> 'global'
UPDATE ledger_entries
SET pool_type = 'bilateral'
WHERE account_category = 'node_bridge'
  AND counterpart_node IN (
    SELECT DISTINCT remote_node FROM bilateral_limits
    WHERE is_customized = true AND is_active = true
  );

UPDATE ledger_entries
SET pool_type = 'global'
WHERE account_category = 'node_bridge'
  AND pool_type = 'global'
  AND counterpart_node NOT IN (
    SELECT DISTINCT remote_node FROM bilateral_limits
    WHERE is_customized = true AND is_active = true
  );

-- Indice para filtrar por pool_type
CREATE INDEX IF NOT EXISTS idx_ledger_pool_type ON ledger_entries(pool_type);
CREATE INDEX IF NOT EXISTS idx_ledger_pool_global ON ledger_entries(account_category, pool_type) WHERE pool_type = 'global';

-- Tabla para cadena de transacciones cross-node con firma dual y hash encadenado
-- Cada transaccion cross-node debe estar firmada por AMBOS nodos.
-- El hash encadenado previene manipulacion (similar a blockchain simplificada bilateral).
CREATE TABLE IF NOT EXISTS cross_node_tx_chain (
  tx_id UUID PRIMARY KEY,
  pool_type TEXT NOT NULL DEFAULT 'global',
  sender_node TEXT NOT NULL,
  receiver_node TEXT NOT NULL,
  amount BIGINT NOT NULL,
  sender_signature TEXT NOT NULL,
  receiver_signature TEXT NOT NULL,
  prev_hash TEXT,
  tx_hash TEXT NOT NULL,
  synced BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice para buscar por par de nodos (para reconciliacion)
CREATE INDEX IF NOT EXISTS idx_cxtx_pair ON cross_node_tx_chain(sender_node, receiver_node, created_at);
CREATE INDEX IF NOT EXISTS idx_cxtx_synced ON cross_node_tx_chain(synced) WHERE synced = false;
CREATE INDEX IF NOT EXISTS idx_cxtx_hash ON cross_node_tx_chain(tx_hash);
