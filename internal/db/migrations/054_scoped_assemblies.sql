-- Migracion 054: Asambleas de organizaciones y departamentos
--
-- Permite que las organizaciones y departamentos tengan sus propias
-- asambleas/reuniones con:
-- - Sesiones propias
-- - Propuestas y votaciones
-- - Minutas
-- - Asistencia
-- - Informes y auditoria
--
-- Las decisiones de estas asambleas son internas a la organizacion
-- o departamento. La mayoria son propuestas libres creadas al momento.

-- ===== Tabla unificada de asambleas con scope =====
-- scope: 'node' (asamblea del nodo), 'organization', 'department'
-- scope_id: NULL para node, organization_id o department_id para los otros
CREATE TABLE IF NOT EXISTS assembly_sessions_scoped (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'node',
  scope_id UUID,
  session_type VARCHAR(50) NOT NULL DEFAULT 'ordinaria',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  is_presential BOOLEAN NOT NULL DEFAULT false,
  minutes TEXT,
  minutes_updated_by UUID REFERENCES users(id),
  minutes_updated_at TIMESTAMPTZ,
  attendance_taken_by UUID REFERENCES users(id),
  recall_number INT NOT NULL DEFAULT 0,
  original_scheduled_time TIMESTAMPTZ,
  quorum_verified BOOLEAN NOT NULL DEFAULT false,
  quorum_checked_at TIMESTAMPTZ,
  parent_session_id UUID REFERENCES assembly_sessions_scoped(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (scope IN ('node', 'organization', 'department')),
  CHECK ((scope = 'node' AND scope_id IS NULL) OR (scope IN ('organization', 'department') AND scope_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_assembly_scoped_domain ON assembly_sessions_scoped(node_domain);
CREATE INDEX IF NOT EXISTS idx_assembly_scoped_scope ON assembly_sessions_scoped(scope, scope_id);

-- ===== Propuestas con scope =====
CREATE TABLE IF NOT EXISTS assembly_decisions_scoped (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES assembly_sessions_scoped(id) ON DELETE CASCADE,
  assembly_id UUID,
  decision_type VARCHAR(100) NOT NULL,
  target_account UUID,
  description TEXT NOT NULL,
  new_value JSONB,
  old_value JSONB,
  required_signatures INT NOT NULL DEFAULT 1,
  collected_signatures JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'proposed',
  voting_deadline TIMESTAMPTZ,
  voting_duration_minutes INT,
  executed_at TIMESTAMPTZ,
  approved_for_voting_by UUID REFERENCES users(id),
  approved_for_voting_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('proposed', 'pending', 'approved', 'executed', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_assembly_decisions_scoped_session ON assembly_decisions_scoped(session_id);

-- ===== Votos con scope =====
CREATE TABLE IF NOT EXISTS assembly_votes_scoped (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES assembly_decisions_scoped(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(id),
  vote VARCHAR(20) NOT NULL CHECK (vote IN ('for', 'against', 'abstain')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(decision_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_assembly_votes_scoped_decision ON assembly_votes_scoped(decision_id);

-- ===== Asistencia con scope =====
CREATE TABLE IF NOT EXISTS assembly_attendance_scoped (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES assembly_sessions_scoped(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  registered_by UUID REFERENCES users(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  secretary_confirmed BOOLEAN NOT NULL DEFAULT true,
  member_confirmed BOOLEAN NOT NULL DEFAULT false,
  member_confirmed_at TIMESTAMPTZ,
  confirmation_token VARCHAR(64),
  token_expires_at TIMESTAMPTZ,
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assembly_attendance_scoped_session ON assembly_attendance_scoped(session_id);

-- ===== Config de quorum para organizaciones y departamentos =====
CREATE TABLE IF NOT EXISTS assembly_quorum_config_scoped (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'node',
  scope_id UUID,
  session_type VARCHAR(50) NOT NULL DEFAULT 'ordinaria',
  quorum_first_call NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  quorum_second_call NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  grace_period_hours INT NOT NULL DEFAULT 1,
  allow_reschedule BOOLEAN NOT NULL DEFAULT true,
  max_recall_count INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, scope, scope_id, session_type)
);

-- Defaults para organizaciones: mas relajado
INSERT INTO assembly_quorum_config_scoped (node_domain, scope, scope_id, session_type, quorum_first_call, quorum_second_call, grace_period_hours)
SELECT 'localhost', 'organization', NULL, 'ordinaria', 50.00, 30.00, 1
WHERE NOT EXISTS (SELECT 1 FROM assembly_quorum_config_scoped WHERE node_domain = 'localhost' AND scope = 'organization' AND session_type = 'ordinaria');

-- Defaults para departamentos: aun mas relajado
INSERT INTO assembly_quorum_config_scoped (node_domain, scope, scope_id, session_type, quorum_first_call, quorum_second_call, grace_period_hours)
SELECT 'localhost', 'department', NULL, 'ordinaria', 50.00, 30.00, 0
WHERE NOT EXISTS (SELECT 1 FROM assembly_quorum_config_scoped WHERE node_domain = 'localhost' AND scope = 'department' AND session_type = 'ordinaria');

-- ===== Permisos para gestionar asambleas de organizacion y departamento =====
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'organization.assembly.manage', 'Gestionar asambleas de organizacion', 'organization', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'organization.assembly.manage');

INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'department.assembly.manage', 'Gestionar asambleas de departamento', 'department', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'department.assembly.manage');

INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'organization.assembly.open_voting', 'Abrir votacion en asamblea de organizacion', 'organization', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'organization.assembly.open_voting');

INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'department.assembly.open_voting', 'Abrir votacion en asamblea de departamento', 'department', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'department.assembly.open_voting');
