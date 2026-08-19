-- Migracion 049: Gobernanza requiere aprobacion de asamblea
--
-- Las reglas de gobernanza (Ley de la Aldea) no se pueden crear,
-- modificar o eliminar directamente. Cualquier cambio debe pasar
-- por la Asamblea General igual que las demas decisiones.
--
-- El seed inicial (migracion 048) ya viene pre-aprobado, pero
-- cualquier cambio futuro requiere propuesta + votacion + aprobacion.

-- Anadir governance_rule como tipo de propuesta de asamblea
INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, description)
VALUES ('localhost', 'governance_rule', 'assembly', 50.00, 'Crear, modificar o eliminar reglas de gobernanza - mayoria simple')
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

-- Anadir columna para marcar reglas como pendientes de aprobacion
-- is_pending = true significa que la regla esta esperando aprobacion
-- de la asamblea y no se muestra en la pagina publica
ALTER TABLE governance_rules ADD COLUMN IF NOT EXISTS is_pending BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE governance_rules ADD COLUMN IF NOT EXISTS pending_action TEXT;
ALTER TABLE governance_rules ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES assembly_decisions(id);

-- Indice para filtrar reglas pendientes
CREATE INDEX IF NOT EXISTS idx_governance_rules_pending ON governance_rules (node_domain, is_pending);
