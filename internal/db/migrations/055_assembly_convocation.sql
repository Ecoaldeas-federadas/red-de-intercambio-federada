-- Migracion 055: Convocatoria automatica, frecuencia, notificaciones
--
-- Anade:
-- 1. Frecuencia configurable de asambleas ordinarias (ej: cada 3 meses)
-- 2. Auto-convocatoria: al cerrar una asamblea, se agenda la siguiente
-- 3. Notificaciones a miembros sobre convocatorias
-- 4. Configuracion de si org/depto tiene asambleas o no
-- 5. Tipos de propuestas restringidos por scope

-- ===== Configuracion de frecuencia de asambleas ordinarias =====
CREATE TABLE IF NOT EXISTS assembly_frequency_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'node',
  scope_id UUID,
  -- Cada cuantos meses se convoca la asamblea ordinaria (0 = no auto-convocar)
  ordinary_frequency_months INT NOT NULL DEFAULT 3,
  -- Dia del mes preferido (1-28, 0 = cualquier dia)
  preferred_day_of_month INT NOT NULL DEFAULT 0,
  -- Hora preferida en formato 24h (ej: 15 = 3pm)
  preferred_hour INT NOT NULL DEFAULT 15,
  -- Si la organizacion/departamento tiene asambleas habilitadas
  assemblies_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Cuantos dias antes notificar a los miembros
  notification_days_before INT NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, scope, scope_id)
);

-- Defaults para el nodo: cada 3 meses
INSERT INTO assembly_frequency_config (node_domain, scope, scope_id, ordinary_frequency_months, preferred_day_of_month, preferred_hour, assemblies_enabled, notification_days_before)
SELECT 'localhost', 'node', NULL, 3, 15, 15, true, 7
WHERE NOT EXISTS (SELECT 1 FROM assembly_frequency_config WHERE node_domain = 'localhost' AND scope = 'node' AND scope_id IS NULL);

-- ===== Tabla de notificaciones de convocatoria =====
CREATE TABLE IF NOT EXISTS assembly_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'node',
  scope_id UUID,
  session_id UUID,
  user_id UUID NOT NULL REFERENCES users(id),
  notification_type VARCHAR(50) NOT NULL,
  -- Tipos: 'convocation', 'date_changed', 'reminder', 'quorum_warning', 'started', 'ended'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assembly_notifications_user ON assembly_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_assembly_notifications_domain ON assembly_notifications(node_domain);

-- ===== Columna en assembly_sessions para marcar auto-convocada =====
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS is_auto_scheduled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE assembly_sessions ADD COLUMN IF NOT EXISTS next_session_id UUID REFERENCES assembly_sessions(id);

-- Mismo para sesiones scoped
ALTER TABLE assembly_sessions_scoped ADD COLUMN IF NOT EXISTS is_auto_scheduled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE assembly_sessions_scoped ADD COLUMN IF NOT EXISTS next_session_id UUID REFERENCES assembly_sessions_scoped(id);

-- ===== Config de si org/depto tiene asambleas =====
-- Columna en users (organizaciones) para indicar si tiene asambleas
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_assembly BOOLEAN NOT NULL DEFAULT false;

-- Columna en departments para indicar si tiene asambleas
ALTER TABLE departments ADD COLUMN IF NOT EXISTS has_assembly BOOLEAN NOT NULL DEFAULT false;

-- ===== Tipos de propuestas permitidos por scope =====
CREATE TABLE IF NOT EXISTS assembly_proposal_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(20) NOT NULL,
  proposal_type VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE(scope, proposal_type)
);

-- Tipos para asamblea del nodo (todos)
INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, sort_order) VALUES
  ('node', 'limit_change', 'Cambio de limites', 'Cambiar limites de credito/debito', 1),
  ('node', 'tax_change', 'Cambio de impuesto', 'Cambiar tasa de impuesto', 2),
  ('node', 'member_level', 'Nivel de miembro', 'Crear/modificar niveles de miembro', 3),
  ('node', 'admission', 'Admision', 'Admitir nuevo miembro', 4),
  ('node', 'expulsion', 'Expulsion', 'Expulsar miembro', 5),
  ('node', 'budget_increase', 'Aumento de presupuesto', 'Aumentar presupuesto', 6),
  ('node', 'fund_distribution', 'Distribucion de fondos', 'Distribuir fondos', 7),
  ('node', 'energy_rate_change', 'Cambio tarifa energetica', 'Cambiar tarifa energetica', 8),
  ('node', 'federation_config', 'Config federacion', 'Configuracion de federacion', 9),
  ('node', 'recovery_config', 'Config recuperacion', 'Configuracion de recuperacion', 10),
  ('node', 'policy', 'Politica general', 'Politica general del nodo', 11),
  ('node', 'create_account', 'Creacion de cuenta', 'Crear cuenta contable', 12),
  ('node', 'product_modification', 'Modificacion de producto', 'Modificar producto del catalogo', 13),
  ('node', 'governance_rule', 'Regla de gobernanza', 'Crear/modificar regla de gobernanza', 14),
  ('node', 'free_proposal', 'Propuesta libre', 'Propuesta sobre cualquier tema', 15)
ON CONFLICT (scope, proposal_type) DO NOTHING;

-- Tipos para organizacion (NO incluye admission, expulsion, tax_change,
-- federation_config, recovery_config, member_level, governance_rule, energy_rate_change)
INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, sort_order) VALUES
  ('organization', 'budget_increase', 'Aumento de presupuesto', 'Aumentar presupuesto de la organizacion', 1),
  ('organization', 'fund_distribution', 'Distribucion de fondos', 'Distribuir fondos de la organizacion', 2),
  ('organization', 'policy', 'Politica interna', 'Politica interna de la organizacion', 3),
  ('organization', 'create_account', 'Creacion de cuenta', 'Crear cuenta contable de la organizacion', 4),
  ('organization', 'product_modification', 'Modificacion de producto', 'Modificar producto de la organizacion', 5),
  ('organization', 'limit_change', 'Cambio de limites', 'Cambiar limites de credito/debito de la organizacion', 6),
  ('organization', 'free_proposal', 'Propuesta libre', 'Propuesta sobre cualquier tema interno', 7)
ON CONFLICT (scope, proposal_type) DO NOTHING;

-- Tipos para departamento (mas restringido)
INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, sort_order) VALUES
  ('department', 'fund_distribution', 'Distribucion de fondos', 'Distribuir fondos del departamento', 1),
  ('department', 'policy', 'Politica del departamento', 'Politica interna del departamento', 2),
  ('department', 'free_proposal', 'Propuesta libre', 'Propuesta sobre cualquier tema del departamento', 3)
ON CONFLICT (scope, proposal_type) DO NOTHING;
