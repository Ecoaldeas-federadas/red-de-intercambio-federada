-- 137_federation_propagation.sql
-- Propagacion automatica de federacion + bloqueo unilateral + cache de endpoints
--
-- Cuando un nodo nuevo se federa con un sponsor via 4 opciones, el sponsor
-- propaga la info del nuevo nodo a todos sus peers en cadena exponencial.
-- Cada nodo establece una relacion 1-a-1 individual con el nuevo nodo
-- (registra su clave publica individualmente). No hay clave compartida.
--
-- Si un certificado se compromete, solo ese nodo se ve afectado.
-- El bloqueo unilateral permite a un nodo dejar de comerciar con otro
-- sin necesidad de acuerdo bilateral.

-- Columnas en node_federation_keys para rastrear propagacion
ALTER TABLE node_federation_keys ADD COLUMN IF NOT EXISTS propagated_by VARCHAR(255);
ALTER TABLE node_federation_keys ADD COLUMN IF NOT EXISTS auto_accepted BOOLEAN DEFAULT false;

-- Log de propagacion para idempotencia (evitar procesar el mismo mensaje 2 veces)
CREATE TABLE IF NOT EXISTS federation_propagation_log (
    message_id UUID PRIMARY KEY,
    from_node VARCHAR(255) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fed_prop_log_from_node
ON federation_propagation_log(from_node, received_at DESC);

-- Bloqueo unilateral: un nodo decide dejar de comerciar con otro
-- sin necesidad de acuerdo. Solo afecta a esos dos nodos.
CREATE TABLE IF NOT EXISTS federation_unilateral_blocks (
    blocker_domain VARCHAR(255) NOT NULL,
    blocked_domain VARCHAR(255) NOT NULL,
    reason TEXT,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_domain, blocked_domain)
);
CREATE INDEX IF NOT EXISTS idx_fed_unilateral_blocks_blocked
ON federation_unilateral_blocks(blocked_domain);

-- Cache de endpoints + claves publicas de TODOS los nodos conocidos
-- (no solo peers directos). Necesario para que un nodo pueda contactar
-- directamente a un nodo propagado sin pasar por el intermediario.
CREATE TABLE IF NOT EXISTS federation_peer_endpoints (
    node_domain VARCHAR(255) PRIMARY KEY,
    endpoint VARCHAR(255),
    public_key VARCHAR(64),
    node_name VARCHAR(255),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discovered_via VARCHAR(255)
);
