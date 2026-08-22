-- Migracion 080: Reuniones de Junta Directiva del nodo
--
-- La Asamblea General del nodo hasta ahora solo tenia sesiones de asamblea
-- (todos los miembros). Ahora se agregan sesiones de junta directiva
-- (solo miembros de la junta) que son mas frecuentes y para decisiones
-- operativas.
--
-- Las organizaciones ya tienen meeting_type (migracion 070), pero la
-- asamblea del nodo no. Esta migracion lo agrega.

-- ===== Agregar meeting_type a assembly_sessions =====
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(20) NOT NULL DEFAULT 'assembly';
-- Valores: 'assembly' (asamblea de todos los miembros) o 'board' (junta directiva)

-- ===== Indice para filtrar por meeting_type =====
CREATE INDEX IF NOT EXISTS idx_assembly_sessions_meeting_type
  ON assembly_sessions(node_domain, meeting_type);

-- ===== Agregar meeting_type a assembly_quorum_config =====
-- Para que la junta directiva tenga su propio quorum (mas bajo)
ALTER TABLE assembly_quorum_config ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(20) NOT NULL DEFAULT 'assembly';

-- Actualizar el UNIQUE de quorum config para incluir meeting_type
ALTER TABLE assembly_quorum_config DROP CONSTRAINT IF EXISTS assembly_quorum_config_node_domain_session_type_key;
ALTER TABLE assembly_quorum_config ADD CONSTRAINT assembly_quorum_config_unique
  UNIQUE(node_domain, session_type, meeting_type);

-- ===== Defaults de quorum para junta directiva del nodo =====
-- La junta directiva suele tener quorum mas bajo (50% primer llamado, 30% segundo)
INSERT INTO assembly_quorum_config (node_domain, session_type, meeting_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, is_active)
SELECT 'localhost', 'ordinaria', 'board', 50.00, 30.00, 0, true, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_quorum_config
  WHERE node_domain = 'localhost' AND session_type = 'ordinaria' AND meeting_type = 'board'
);

INSERT INTO assembly_quorum_config (node_domain, session_type, meeting_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, is_active)
SELECT 'localhost', 'extraordinaria', 'board', 40.00, 25.00, 0, true, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_quorum_config
  WHERE node_domain = 'localhost' AND session_type = 'extraordinaria' AND meeting_type = 'board'
);

INSERT INTO assembly_quorum_config (node_domain, session_type, meeting_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, is_active)
SELECT 'localhost', 'urgente', 'board', 30.00, 20.00, 0, false, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_quorum_config
  WHERE node_domain = 'localhost' AND session_type = 'urgente' AND meeting_type = 'board'
);

-- ===== Tipos de propuestas para junta directiva del nodo =====
-- Las propuestas de junta directiva son mas operativas
INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, is_active)
SELECT 'node', 'board_operative', 'Decision Operativa (Junta)', 'Decision operativa que no requiere asamblea completa. Solo vota la junta directiva.', true
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_proposal_types WHERE scope = 'node' AND proposal_type = 'board_operative'
);

INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, is_active)
SELECT 'node', 'board_budget', 'Presupuesto (Junta)', 'Aprobacion de presupuesto operativo por la junta directiva.', true
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_proposal_types WHERE scope = 'node' AND proposal_type = 'board_budget'
);

INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, is_active)
SELECT 'node', 'board_appointment', 'Nombramiento (Junta)', 'Nombramiento de cargos operativos por la junta directiva.', true
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_proposal_types WHERE scope = 'node' AND proposal_type = 'board_appointment'
);
