-- Migracion 129: Niveles de nodo federado + membresia + patrocinios (padrino)
--
-- Crea el sistema de niveles para nodos federados:
--   Nivel 1: Nodo Nuevo - sin voto, no patrocina, limite bajo, min 90 dias
--   Nivel 2: Nodo Aceptado - con voto, puede patrocinar, min 180 dias
--   Nivel 3: Nodo Pleno - auto-upgrade con reciprocidad y limite promedio
--
-- Sistema de padrino: el nodo que ingresa un nodo nuevo pierde temporalmente
-- parte de su limite. Si el nodo nuevo entra en default, la deuda pasa al padrino.
-- Al subir el nodo a nivel 2, el limite del padrino se libera.

-- Niveles de nodo federado (configurable por votacion federada)
CREATE TABLE IF NOT EXISTS federation_node_levels (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  level INT NOT NULL,
  global_credit_limit BIGINT NOT NULL,
  global_debit_limit BIGINT NOT NULL,
  has_voice BOOLEAN NOT NULL DEFAULT true,
  has_vote BOOLEAN NOT NULL DEFAULT false,
  can_sponsor BOOLEAN NOT NULL DEFAULT false,
  min_days_at_level INT NOT NULL DEFAULT 90,
  min_days_after_last_level INT NOT NULL DEFAULT 0,
  auto_upgrade BOOLEAN NOT NULL DEFAULT false,
  upgrade_to VARCHAR(64),
  require_reciprocity BOOLEAN NOT NULL DEFAULT true,
  reciprocity_min_balance INT NOT NULL DEFAULT 0,
  reciprocity_max_balance INT NOT NULL DEFAULT 0,
  require_avg_limit BOOLEAN NOT NULL DEFAULT false,
  avg_limit_ratio FLOAT NOT NULL DEFAULT 0.5,
  is_system BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_exception BOOLEAN NOT NULL DEFAULT false,
  exception_vote_threshold FLOAT NOT NULL DEFAULT 0.75,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Membresia de cada nodo federado (que nivel tiene, desde cuando, metricas)
CREATE TABLE IF NOT EXISTS federation_node_membership (
  peer_domain VARCHAR(255) PRIMARY KEY,
  level_id VARCHAR(64) NOT NULL REFERENCES federation_node_levels(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_level_approved_at TIMESTAMPTZ,
  sponsored_by VARCHAR(255),
  sponsored_at TIMESTAMPTZ,
  sponsor_limit_held BIGINT DEFAULT 0,
  min_balance_reached BIGINT DEFAULT 0,
  max_balance_reached BIGINT DEFAULT 0,
  total_volume BIGINT DEFAULT 0,
  avg_limit_calculated BIGINT DEFAULT 0,
  last_metrics_updated TIMESTAMPTZ,
  upgraded_by_proposal UUID
);

-- Patrocinios: rastrea retencion de limite del padrino
CREATE TABLE IF NOT EXISTS federation_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_domain VARCHAR(255) NOT NULL,
  sponsored_domain VARCHAR(255) NOT NULL,
  amount_held BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  UNIQUE(sponsor_domain, sponsored_domain)
);

-- Seed con 3 niveles por defecto
INSERT INTO federation_node_levels (id, name, description, level, global_credit_limit, global_debit_limit,
  has_voice, has_vote, can_sponsor, min_days_at_level, min_days_after_last_level,
  auto_upgrade, upgrade_to, require_reciprocity, reciprocity_min_balance, reciprocity_max_balance,
  require_avg_limit, avg_limit_ratio, is_system, is_active, is_exception, exception_vote_threshold)
VALUES
  ('new', 'Nodo Nuevo', 'Nodo recien ingresado. Sin voto, no puede patrocinar. Limite bajo.', 1, 1000, 1000,
   true, false, false, 90, 0,
   false, NULL, false, 0, 0,
   false, 0.5, true, true, false, 0.75),
  ('accepted', 'Nodo Aceptado', 'Nodo aprobado por asamblea. Con voto, puede patrocinar.', 2, 5000, 5000,
   true, true, true, 180, 0,
   true, 'full', true, 1000, 1000,
   true, 0.5, true, true, false, 0.75),
  ('full', 'Nodo Pleno', 'Nodo pleno. Auto-upgrade con reciprocidad y limite promedio.', 3, 20000, 20000,
   true, true, true, 0, 0,
   false, NULL, false, 0, 0,
   false, 0.5, true, true, false, 0.75)
ON CONFLICT (id) DO NOTHING;
