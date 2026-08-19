-- Migracion 052: Quorum configurable, doble validacion, reprogramacion
--
-- Anade soporte para:
-- 1. Quorum configurable por tipo de asamblea (ordinaria, extraordinaria, urgente)
-- 2. Quorum diferente para primer llamado vs segundo llamado
-- 3. Periodo de gracia (horas) antes de declarar asamblea invalida
-- 4. Doble validacion de asistencia (secretario + miembro)
-- 5. Reprogramacion de asamblea (mismo ID, nuevo horario, baja el quorum)
-- 6. Estados de asamblea: scheduled -> waiting_quorum -> active -> closed
--                          scheduled -> waiting_quorum -> rescheduled -> ...

-- ===== Configuracion de quorum por nodo =====
CREATE TABLE IF NOT EXISTS assembly_quorum_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  session_type VARCHAR(50) NOT NULL DEFAULT 'ordinaria',
  -- Porcentaje de asistencia requerido para que la asamblea sea valida
  quorum_first_call NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  quorum_second_call NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  -- Horas de gracia antes de declarar asamblea invalida
  grace_period_hours INT NOT NULL DEFAULT 1,
  -- Si despues del periodo de gracia no hay quorum, se puede reprogramar
  allow_reschedule BOOLEAN NOT NULL DEFAULT true,
  -- Cuantos rellamados maximos se permiten (1 = una reprogramacion)
  max_recall_count INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, session_type)
);

-- Configuracion por defecto
INSERT INTO assembly_quorum_config (node_domain, session_type, quorum_first_call, quorum_second_call, grace_period_hours, allow_reschedule, max_recall_count)
VALUES
  ('localhost', 'ordinaria', 50.00, 30.00, 1, true, 1),
  ('localhost', 'extraordinaria', 66.67, 50.00, 1, true, 1),
  ('localhost', 'urgente', 75.00, 50.00, 0, true, 2)
ON CONFLICT (node_domain, session_type) DO NOTHING;

-- ===== Columnas en assembly_sessions =====
-- recall_number: 0 = primer llamado, 1 = segundo llamado, etc.
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS recall_number INT NOT NULL DEFAULT 0;
-- original_scheduled_time: hora original antes de reprogramar
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS original_scheduled_time TIMESTAMPTZ;
-- quorum_verified: true cuando se confirmo que hay quorum
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS quorum_verified BOOLEAN NOT NULL DEFAULT false;
-- quorum_checked_at: cuando se verifico el quorum
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS quorum_checked_at TIMESTAMPTZ;
-- parent_session_id: si esta sesion es una reprogramacion de otra
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES assembly_sessions(id);

-- ===== Doble validacion de asistencia =====
-- El secretario marca al miembro como presente, pero el miembro
-- debe confirmar su presencia (auto-check-in via app, QR, o tarjeta)
ALTER TABLE assembly_attendance ADD COLUMN IF NOT EXISTS secretary_confirmed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE assembly_attendance ADD COLUMN IF NOT EXISTS member_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE assembly_attendance ADD COLUMN IF NOT EXISTS member_confirmed_at TIMESTAMPTZ;
ALTER TABLE assembly_attendance ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(64);
ALTER TABLE assembly_attendance ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Indice para buscar por token
CREATE INDEX IF NOT EXISTS idx_assembly_attendance_token ON assembly_attendance(confirmation_token) WHERE confirmation_token IS NOT NULL;

-- ===== Estados de sesion ampliados =====
-- Estados validos: scheduled, waiting_quorum, active, closed, rescheduled, cancelled
-- (no requerimos ALTER TYPE porque status es VARCHAR)

-- ===== Permiso para verificar quorum =====
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'assembly.verify_quorum', 'Verificar quorum y declarar asamblea valida o invalida', 'assembly', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'assembly.verify_quorum');
