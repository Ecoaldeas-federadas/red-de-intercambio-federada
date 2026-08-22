-- Migracion 082: Reclasificar decisiones operativas a Junta Directiva
-- y agregar defaults de quorum para sesiones de junta directiva.
--
-- Antes todas las decisiones eran por Asamblea. Ahora las decisiones
-- operativas (que pasan frecuentemente) van a Junta Directiva.
-- Las decisiones grandes (constitutivas, expulsion, federation, etc.)
-- siguen siendo por Asamblea.
--
-- La Asamblea decide si quiere cambiar quien aprueba algo (board vs assembly),
-- pero los defaults iniciales separan lo operativo de lo constitutivo.

-- ===== Reclasificar assembly_config =====
-- Estas son decisiones operativas que la junta directiva puede tomar:
UPDATE assembly_config SET approval_method = 'board', required_percentage = 50.00,
  description = 'Creacion de cuentas - junta directiva (mayoria simple)'
WHERE proposal_type = 'create_account';

UPDATE assembly_config SET approval_method = 'board', required_percentage = 50.00,
  description = 'Cambios de limites de credito/debito - junta directiva (mayoria simple)'
WHERE proposal_type = 'limit_change';

UPDATE assembly_config SET approval_method = 'board', required_percentage = 50.00,
  description = 'Modificacion de productos - junta directiva (mayoria simple)'
WHERE proposal_type = 'product_modification';

UPDATE assembly_config SET approval_method = 'board', required_percentage = 50.00,
  description = 'Distribucion del fondo - junta directiva (mayoria simple)'
WHERE proposal_type = 'fund_distribution';

UPDATE assembly_config SET approval_method = 'board', required_percentage = 50.00,
  description = 'Aumento de presupuesto - junta directiva (mayoria simple)'
WHERE proposal_type = 'budget_increase';

-- Estas siguen siendo de Asamblea (decisiones grandes/constitutivas):
-- admission: admision de miembros -> asamblea (50%)
-- expulsion: expulsion de miembro -> asamblea (75%)
-- energy_rate_change: cambio de tarifa energetica -> asamblea (66.67%)
-- federation_config: configuracion de federacion -> asamblea (66.67%)
-- tax_change: cambios de impuestos -> asamblea (66.67%)
-- member_level: niveles de miembro -> asamblea (50%)
-- org_level: niveles de organizacion -> asamblea (50%)
-- policy: politicas generales -> asamblea (50%)
-- governance_rule: reglas de gobernanza -> asamblea (50%)
-- free_proposal: propuesta libre -> asamblea (50%)
-- recovery_config: configuracion de recuperacion -> multisig (100%)

-- ===== Defaults de quorum para sesiones de junta directiva =====
-- La junta directiva tiene quorum mas bajo porque son menos personas.
-- Si la junta tiene 5-7 miembros, 50% primer llamado = 3-4 presentes.
INSERT INTO assembly_quorum_config (node_domain, session_type, meeting_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, is_active)
SELECT 'localhost', 'ordinaria', 'board', 50.0, 30.0, 0, true, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_quorum_config
  WHERE node_domain = 'localhost' AND session_type = 'ordinaria' AND meeting_type = 'board'
);

INSERT INTO assembly_quorum_config (node_domain, session_type, meeting_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, is_active)
SELECT 'localhost', 'extraordinaria', 'board', 50.0, 30.0, 0, true, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_quorum_config
  WHERE node_domain = 'localhost' AND session_type = 'extraordinaria' AND meeting_type = 'board'
);

INSERT INTO assembly_quorum_config (node_domain, session_type, meeting_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count, is_active)
SELECT 'localhost', 'urgente', 'board', 40.0, 25.0, 0, false, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM assembly_quorum_config
  WHERE node_domain = 'localhost' AND session_type = 'urgente' AND meeting_type = 'board'
);
