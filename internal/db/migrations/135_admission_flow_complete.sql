-- Migracion 135: Flujo completo de admision con cuenta preliminar
--
-- Objetivo: Implementar el flujo completo de admision:
-- 1. Postulante envia formulario con username + password
-- 2. Se crea cuenta preliminar (membership_status = 'pending_admission')
-- 3. Admin filtra y eleva a asamblea (o rechaza con motivo)
-- 4. Asamblea vota: si aprueba, usuario se activa con nivel 'new'
-- 5. Usuario rechazado tiene 30 dias para defenderse
-- 6. Borrado automatico a los 30 dias sin resolucion

-- ===== Columnas nuevas para admission_requests =====
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS proposed_password TEXT;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS elevated_at TIMESTAMPTZ;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS elevated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS assembly_decision_id UUID;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS defense_text TEXT;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS defense_submitted_at TIMESTAMPTZ;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS defense_reviewed_at TIMESTAMPTZ;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS defense_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS defense_status TEXT;  -- 'pending', 'accepted', 'rejected'
ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS rejection_expires_at TIMESTAMPTZ;

-- created_user_id ya existe en migracion 001 pero con REFERENCES users(id) sin ON DELETE.
-- Lo recreamos con ON DELETE SET NULL para que el borrado del usuario preliminar
-- no borre el registro de admision (preserva historial).
-- Nota: ALTER COLUMN ... DROP CONSTRAINT + ADD CONSTRAINT seria ideal pero
-- el nombre del constraint varia. Usamos approach seguro:
DO $$
BEGIN
  -- Intentar dropear el constraint FK existente (nombre generico)
  BEGIN
    ALTER TABLE admission_requests DROP CONSTRAINT IF EXISTS admission_requests_created_user_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- Recrear con ON DELETE SET NULL
  BEGIN
    ALTER TABLE admission_requests ADD CONSTRAINT admission_requests_created_user_id_fkey
      FOREIGN KEY (created_user_id) REFERENCES users(id) ON DELETE SET NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ===== Tipo de propuesta de asamblea para admision =====
INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, is_active)
SELECT 'node', 'admission_approve', 'Admision de nuevo miembro',
       'Aprobar o rechazar la admision de un nuevo miembro postulante.', true
WHERE NOT EXISTS (SELECT 1 FROM assembly_proposal_types WHERE proposal_type = 'admission_approve');

-- ===== Configuracion por defecto para admision_approve (mayoria simple 50%) =====
INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, is_active)
SELECT 'default', 'admission_approve', 'majority', 50.00, true
WHERE NOT EXISTS (SELECT 1 FROM assembly_config WHERE node_domain = 'default' AND proposal_type = 'admission_approve');

-- ===== Indice para buscar solicitudes por usuario creado =====
CREATE INDEX IF NOT EXISTS idx_admission_requests_created_user ON admission_requests(created_user_id);
CREATE INDEX IF NOT EXISTS idx_admission_requests_status ON admission_requests(node_domain, status, created_at);
CREATE INDEX IF NOT EXISTS idx_admission_requests_rejection_expires ON admission_requests(rejection_expires_at) WHERE status = 'rejected';
