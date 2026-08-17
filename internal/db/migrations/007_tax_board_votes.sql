-- Migracion 007: Configuracion de impuestos, junta directiva y votos de asamblea

-- Configuracion de impuestos del nodo
CREATE TABLE IF NOT EXISTS tax_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  tax_account_id UUID REFERENCES users(id),
  applies_to TEXT NOT NULL DEFAULT 'all',
  min_amount BIGINT NOT NULL DEFAULT 0,
  max_amount BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_assembly UUID REFERENCES assembly_decisions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain)
);

-- Junta directiva (board of directors)
CREATE TABLE IF NOT EXISTS board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  position TEXT NOT NULL,
  term_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  term_end TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  appointed_by_assembly UUID REFERENCES assembly_decisions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, user_id, position)
);

-- Votos de asamblea
CREATE TABLE IF NOT EXISTS assembly_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES assembly_decisions(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(id),
  vote TEXT NOT NULL CHECK (vote IN ('for', 'against', 'abstain')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(decision_id, voter_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_board_members_node ON board_members(node_domain);
CREATE INDEX IF NOT EXISTS idx_assembly_votes_decision ON assembly_votes(decision_id);
CREATE INDEX IF NOT EXISTS idx_tax_config_node ON tax_config(node_domain);
