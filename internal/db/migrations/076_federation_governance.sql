-- Limpiar tablas parciales de intentos fallidos anteriores
-- (La migracion fallo por limite de tabletas, las tablas pueden existir sin colocation)
DROP TABLE IF EXISTS federation_votes CASCADE;
DROP TABLE IF EXISTS federation_proposals CASCADE;
DROP TABLE IF EXISTS federation_constants CASCADE;

-- Migracion 076: Gobernanza federada - propuestas y votacion entre nodos
--
-- Permite que cambios que afectan a TODA la federacion (como el valor
-- de la canasta basica interna) sean propuestos, votados y aplicados
-- automaticamente en todos los nodos cuando se alcanza el consenso.
--
-- El proceso es:
-- 1. Un nodo propone un cambio (ej: canasta interna de 500 a 600)
-- 2. La propuesta se comparte con todos los nodos federados
-- 3. Cada nodo aprueba o rechaza
-- 4. Cuando se alcanza el porcentaje de aprobacion (default 100%),
--    el cambio se aplica automaticamente en todos los nodos
-- 5. Si un nodo no aprueba, se sigue usando el valor anterior
--
-- NOTA: Si la base de datos fue creada WITH COLOCATION = true, las tablas
-- comparten una misma tableta. Si la BD ya existe sin colocation, no se
-- puede forzar colocation por tabla (error: cannot set colocation true on
-- a non-colocated database). Por eso no usamos WITH (colocation = true)
-- aqui y en su lugar subimos el limite de tabletas del tserver.

-- Constantes federadas: valores que afectan a toda la federacion
CREATE TABLE IF NOT EXISTS federation_constants (
  key VARCHAR(128) PRIMARY KEY,           -- 'basket_cost_internal_tq', 'fc_approval_threshold', etc.
  value JSONB NOT NULL,                    -- valor actual (puede ser numero, string, etc.)
  description TEXT,                        -- descripcion para humanos
  approved_proposal_id UUID,               -- que propuesta aprobo este valor
  updated_at TIMESTAMPTZ DEFAULT NOW()
) SPLIT INTO 1 TABLETS;

-- Propuestas de cambios federados
CREATE TABLE IF NOT EXISTS federation_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_type VARCHAR(64) NOT NULL,      -- 'change_constant', 'add_service', etc.
  key VARCHAR(128) NOT NULL,               -- que constante cambiar (ej: 'basket_cost_internal_tq')
  proposed_value JSONB NOT NULL,            -- valor propuesto
  current_value JSONB,                      -- valor actual al momento de proponer
  description TEXT,                         -- explicacion del cambio
  proposed_by_node VARCHAR(128) NOT NULL,   -- dominio del nodo que propone
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'expired'
  approval_threshold INT NOT NULL DEFAULT 75,      -- % de nodos que deben aprobar (default 75%, configurable)
  total_nodes INT NOT NULL DEFAULT 0,              -- total de nodos federados al momento
  approvals INT NOT NULL DEFAULT 0,                -- contador de aprobaciones
  rejections INT NOT NULL DEFAULT 0,               -- contador de rechazos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                          -- fecha limite para votar
  applied_at TIMESTAMPTZ                           -- cuando se aplico el cambio
) SPLIT INTO 1 TABLETS;

-- Votos de cada nodo en una propuesta
CREATE TABLE IF NOT EXISTS federation_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES federation_proposals(id) ON DELETE CASCADE,
  voter_node VARCHAR(128) NOT NULL,        -- dominio del nodo que vota
  vote VARCHAR(10) NOT NULL,               -- 'approve' o 'reject'
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  UNIQUE(proposal_id, voter_node)          -- un nodo solo vota una vez por propuesta
) SPLIT INTO 1 TABLETS;

-- Insertar constantes federadas iniciales
-- La canasta basica interna es 500 TQ en TODOS los nodos (valor fijado)
INSERT INTO federation_constants (key, value, description)
VALUES ('basket_cost_internal_tq', '500', 'Costo de la canasta basica interna en TQ. Es el mismo en todos los nodos. Solo se puede cambiar via propuesta federada aprobada.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO federation_constants (key, value, description)
VALUES ('fc_approval_threshold', '75', 'Porcentaje de nodos que deben aprobar un cambio federado para que se aplique. Por defecto 75% (mayoria). Se puede cambiar a 100% o cualquier otro valor via propuesta federada.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO federation_constants (key, value, description)
VALUES ('proposal_expiry_days', '30', 'Dias para que una propuesta expire si no alcanza consenso.')
ON CONFLICT (key) DO NOTHING;

-- Sin indices secundarios explicitos: el PK y el UNIQUE ya crean indices.
-- En YugabyteDB cada indice crea tabletas, y estas tablas son pequenas
-- (pocas filas), asi que los indices del PK y UNIQUE son suficientes.
