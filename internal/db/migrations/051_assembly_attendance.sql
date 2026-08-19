-- Migracion 051: Asamblea presencial, asistencia y minuta
--
-- Anade soporte para:
-- 1. Asambleas presenciales vs remotas
-- 2. Lista de asistentes (pasada por secretario/autorizado)
-- 3. Minuta editable de la asamblea
-- 4. Restriccion de voto: en asamblea presencial solo votan los presentes
-- 5. Historial de asistencia para auditoria

-- Asamblea presencial o remota + minuta
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS is_presential BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS minutes TEXT;
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS minutes_updated_by UUID REFERENCES users(id);
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS minutes_updated_at TIMESTAMPTZ;
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS attendance_taken_by UUID REFERENCES users(id);

-- Tabla de asistencia a asambleas
CREATE TABLE IF NOT EXISTS assembly_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES assembly_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  registered_by UUID REFERENCES users(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assembly_attendance_session ON assembly_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_assembly_attendance_user ON assembly_attendance(user_id);

-- Permiso para tomar asistencia
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'assembly.take_attendance', 'Tomar lista de asistencia en asamblea presencial', 'assembly', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'assembly.take_attendance');
