-- 062_national_id_and_merge_conflicts.sql

-- Campo ID nacional (cédula, pasaporte, etc.) para evitar duplicados entre nodos
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id_type TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id_country TEXT DEFAULT '';

-- Indice para busqueda rapida por national_id
CREATE INDEX IF NOT EXISTS idx_users_national_id ON users(national_id) WHERE national_id <> '';

-- Tambien en admission_requests para guardar el ID durante la solicitud
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS national_id TEXT DEFAULT '';
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS national_id_type TEXT DEFAULT '';
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS national_id_country TEXT DEFAULT '';

-- Tabla de conflictos de fusion entre nodos
-- Cuando dos nodos se federan y hay usuarios con mismo national_id en ambos
CREATE TABLE IF NOT EXISTS node_merge_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Los dos nodos en conflicto
    node_a_domain TEXT NOT NULL,
    node_b_domain TEXT NOT NULL,
    -- El usuario duplicado (mismo national_id en ambos nodos)
    national_id TEXT NOT NULL,
    user_a_id UUID REFERENCES users(id),
    user_b_id UUID REFERENCES users(id),
    user_a_name TEXT,
    user_b_name TEXT,
    -- Estado: pending, voting_a, voting_b, resolved, blocked
    status TEXT NOT NULL DEFAULT 'pending',
    -- Que nodo se queda con el usuario: 'a', 'b', o 'both' (si se permite dual)
    -- 'both' requiere decision especial de ambas asambleas
    proposed_resolution TEXT DEFAULT '',
    -- Saldo del usuario en cada nodo
    balance_a BIGINT DEFAULT 0,
    balance_b BIGINT DEFAULT 0,
    -- Que hacer con el saldo: transfer, forgive_debt, remove_balance, keep_both
    balance_action TEXT DEFAULT '',
    -- Votacion de cada asamblea
    vote_a_status TEXT DEFAULT 'pending', -- pending, open, approved, rejected
    vote_a_proposal_id UUID,
    vote_b_status TEXT DEFAULT 'pending',
    vote_b_proposal_id UUID,
    -- Cuando ambas asambleas aprueban, se ejecuta
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice para buscar conflictos por nodo
CREATE INDEX IF NOT EXISTS idx_merge_conflicts_node_a ON node_merge_conflicts(node_a_domain, status);
CREATE INDEX IF NOT EXISTS idx_merge_conflicts_node_b ON node_merge_conflicts(node_b_domain, status);
CREATE INDEX IF NOT EXISTS idx_merge_conflicts_national_id ON node_merge_conflicts(national_id);

COMMENT ON TABLE node_merge_conflicts IS 'Conflictos cuando dos nodos se federan y tienen usuarios con mismo ID nacional. Ambas asambleas deben consensuar la resolucion antes de completar la federacion.';
