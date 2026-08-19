-- Migracion 053: Flujo de propuestas: proposed -> pending (votacion) -> executed/rejected
--
-- Cambio de flujo:
-- ANTES: propuesta se crea con status='pending' (directa a votacion)
-- AHORA: propuesta se crea con status='proposed' (pendiente de revision)
--        La asamblea revisa y la aprueba para votacion -> status='pending'
--        Solo cuando esta 'pending' se puede votar
--
-- Estados: proposed, pending, approved, executed, rejected, expired

-- Migrar propuestas 'pending' existentes a 'proposed' (requieren revision)
-- Las que ya tienen votos se quedan como pending (ya estan en votacion)
UPDATE assembly_decisions SET status = 'proposed'
WHERE status = 'pending'
AND id NOT IN (SELECT DISTINCT decision_id FROM assembly_votes);

-- Columna para registrar quien aprobo la propuesta para votacion
ALTER TABLE assembly_decisions ADD COLUMN IF NOT EXISTS approved_for_voting_by UUID REFERENCES users(id);
ALTER TABLE assembly_decisions ADD COLUMN IF NOT EXISTS approved_for_voting_at TIMESTAMPTZ;

-- Permiso para aprobar propuestas para votacion en asamblea
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'assembly.open_voting', 'Aprobar propuesta para votacion en asamblea', 'assembly', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'assembly.open_voting');
