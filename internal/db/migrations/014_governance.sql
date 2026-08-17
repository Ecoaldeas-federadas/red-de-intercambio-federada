-- Migracion 014: Gobernanza avanzada
-- 1. Configuracion de asamblea: umbrales por tipo de propuesta
-- 2. Junta directiva por organizacion
-- 3. Auditoria de cambios en energy_tariff (factores de esfuerzo)

-- 1. Configuracion de asamblea por tipo de propuesta
-- Define como se aprueba cada tipo de decision:
-- - assembly: votacion de asamblea (con porcentaje de aprobacion)
-- - board: junta directiva del nodo
-- - council: consejo especifico
-- - multisig: firmas de personas especificas
CREATE TABLE IF NOT EXISTS assembly_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  proposal_type VARCHAR(100) NOT NULL,
  approval_method VARCHAR(20) NOT NULL DEFAULT 'assembly',
  required_percentage NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  required_quorum INT NOT NULL DEFAULT 0,
  required_signatures INT NOT NULL DEFAULT 1,
  council_id UUID REFERENCES departments(id),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, proposal_type)
);

-- Configuracion por defecto con INSERTs individuales seguros
INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'limit_change', 'assembly', 50.00, 'Cambios de limites de credito/debito - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'tax_change', 'assembly', 66.67, 'Cambios de impuestos - 2/3 de la asamblea')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'member_level', 'assembly', 50.00, 'Crear/modificar niveles de miembro - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'org_level', 'assembly', 50.00, 'Crear/modificar niveles de organizacion - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'admission', 'assembly', 50.00, 'Admision de nuevos miembros - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'expulsion', 'assembly', 75.00, 'Expulsion de miembro - 75% de la asamblea')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'budget_increase', 'assembly', 50.00, 'Distribucion del fondo comunitario - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'fund_distribution', 'assembly', 50.00, 'Distribucion del fondo - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'energy_rate_change', 'assembly', 66.67, 'Cambio de tarifas energeticas - 2/3 de la asamblea')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'federation_config', 'assembly', 66.67, 'Configuracion de federacion - 2/3 de la asamblea')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'recovery_config', 'multisig', 100.00, 'Configuracion de recuperacion - multi-firma')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'policy', 'assembly', 50.00, 'Politicas generales - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'create_account', 'assembly', 50.00, 'Creacion de cuentas - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'product_modification', 'assembly', 50.00, 'Modificacion de productos - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'free_proposal', 'assembly', 50.00, 'Propuesta libre - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

-- 2. Junta directiva por organizacion
CREATE TABLE IF NOT EXISTS organization_board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  position VARCHAR(100) NOT NULL,
  term_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  term_end TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  appointed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id, position)
);

CREATE INDEX IF NOT EXISTS idx_org_board_org ON organization_board_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_board_user ON organization_board_members (user_id);

-- 3. Tabla para cambios pendientes de energy_tariff
-- Los cambios a factores de esfuerzo no se aplican directamente,
-- se crean como propuestas de asamblea
CREATE TABLE IF NOT EXISTS energy_tariff_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value NUMERIC(10,4),
  new_value NUMERIC(10,4),
  reason TEXT,
  proposed_by UUID REFERENCES users(id),
  assembly_decision_id UUID REFERENCES assembly_decisions(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_energy_tariff_changes_node ON energy_tariff_changes (node_domain, status);

-- 4. Permisos nuevos
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'org.manage_board', 'Gestionar junta directiva de organizacion', 'org', true, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'org.manage_board');

INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'assembly.manage_config', 'Configurar umbrales de aprobacion de asamblea', 'assembly', true, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'assembly.manage_config');
