-- Migracion 070: Reuniones de Junta Directiva para organizaciones
--
-- Las organizaciones tienen DOS espacios de decision:
-- 1. Asamblea: todos los miembros participan (org regular: miembros de la org;
--    org de la Asamblea: todos los miembros del nodo = Asamblea General)
-- 2. Junta Directiva: solo los miembros de la junta directiva participan
--
-- Ambos espacios tienen: sesiones, propuestas, votaciones, actas, asistencia,
-- config de quorum, reportes.
--
-- Para org de la Asamblea: la Junta Directiva es la de ESA organizacion,
-- no la junta directiva de la Asamblea. La reunion de Asamblea de una org
-- de la Asamblea ES la Asamblea General del nodo.

-- ===== Agregar meeting_type a sesiones scoped =====
ALTER TABLE assembly_sessions_scoped ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(20) NOT NULL DEFAULT 'assembly';
-- Valores: 'assembly' (asamblea de miembros) o 'board' (junta directiva)

-- ===== Agregar meeting_type a config de quorum scoped =====
ALTER TABLE assembly_quorum_config_scoped ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(20) NOT NULL DEFAULT 'assembly';

-- ===== Actualizar el UNIQUE de quorum config para incluir meeting_type =====
-- Primero eliminar el constraint viejo y crear uno nuevo
ALTER TABLE assembly_quorum_config_scoped DROP CONSTRAINT IF EXISTS assembly_quorum_config_scoped_node_domain_scope_scope_id_session_type_key;
ALTER TABLE assembly_quorum_config_scoped ADD CONSTRAINT assembly_quorum_config_scoped_unique
  UNIQUE(node_domain, scope, scope_id, session_type, meeting_type);

-- ===== Defaults de quorum para juntas directivas =====
-- Las juntas directivas suelen tener quorum mas bajo (3 miembros bastan)
INSERT INTO assembly_quorum_config_scoped (node_domain, scope, scope_id, session_type, meeting_type, quorum_first_call, quorum_second_call, grace_period_hours)
SELECT 'localhost', 'organization', NULL, 'ordinaria', 'board', 50.00, 30.00, 0
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_quorum_config_scoped
  WHERE node_domain = 'localhost' AND scope = 'organization' AND meeting_type = 'board' AND session_type = 'ordinaria'
);

-- ===== Indice para filtrar por meeting_type =====
CREATE INDEX IF NOT EXISTS idx_assembly_scoped_meeting_type
  ON assembly_sessions_scoped(scope, scope_id, meeting_type);

-- ===== Tipos de propuestas para juntas directivas =====
INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, is_active)
SELECT 'organization', 'board_operational', 'Decision operativa de junta directiva',
       'Decisiones operativas que no requieren aprobacion de asamblea: gastos menores, asignacion de tareas, coordinacion de actividades.', true
WHERE NOT EXISTS (SELECT 1 FROM assembly_proposal_types WHERE scope = 'organization' AND proposal_type = 'board_operational');

INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, is_active)
SELECT 'organization', 'board_financial', 'Decision financiera de junta directiva',
       'Transferencias y pagos que la junta directiva puede aprobar sin asamblea (segun limites configurados).', true
WHERE NOT EXISTS (SELECT 1 FROM assembly_proposal_types WHERE scope = 'organization' AND proposal_type = 'board_financial');

INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, is_active)
SELECT 'organization', 'board_appointment', 'Nombramiento interno de junta directiva',
       'Asignacion o cambio de roles dentro de la junta directiva.', true
WHERE NOT EXISTS (SELECT 1 FROM assembly_proposal_types WHERE scope = 'organization' AND proposal_type = 'board_appointment');

-- ===== Permisos para gestionar juntas directivas =====
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'organization.board.manage', 'Gestionar reuniones de junta directiva de organizacion', 'organization', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'organization.board.manage');

INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'organization.board.open_voting', 'Abrir votacion en junta directiva de organizacion', 'organization', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'organization.board.open_voting');
