-- Migracion 056: Tiempos minimos de anticipacion, cuenta predefinida de impuestos
--
-- 1. Tiempos minimos para crear asambleas:
--    - Ordinaria: 7 dias de anticipacion
--    - Extraordinaria: 24 horas de anticipacion
--    - Urgente: 1 hora de anticipacion
-- 2. Cuenta predefinida de impuestos (la asamblea tiene su propia cuenta)
-- 3. El admin tiene todos los permisos siempre

-- ===== Tiempos minimos de anticipacion =====
ALTER TABLE assembly_frequency_config ADD COLUMN IF NOT EXISTS min_advance_ordinary_hours INT NOT NULL DEFAULT 168; -- 7 dias
ALTER TABLE assembly_frequency_config ADD COLUMN IF NOT EXISTS min_advance_extraordinary_hours INT NOT NULL DEFAULT 24; -- 24 horas
ALTER TABLE assembly_frequency_config ADD COLUMN IF NOT EXISTS min_advance_urgent_hours INT NOT NULL DEFAULT 1; -- 1 hora

-- ===== Cuenta predefinida de la asamblea =====
-- Los impuestos llegan automaticamente a esta cuenta.
-- Lo que se vota en asamblea es a DONDE distribuir ese dinero (salida).
CREATE TABLE IF NOT EXISTS tax_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL UNIQUE,
  -- Cuenta donde llegan los impuestos automaticamente (predefinida)
  tax_account_id UUID REFERENCES users(id),
  -- Tasa de impuesto actual (porcentaje)
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Si el impuesto esta activo
  is_active BOOLEAN NOT NULL DEFAULT false,
  -- Monto minimo de transaccion para aplicar impuesto
  min_amount BIGINT NOT NULL DEFAULT 0,
  -- Aplica a: all, exchange, external, etc.
  applies_to VARCHAR(50) NOT NULL DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear cuenta predefinida de la asamblea para cada nodo existente
-- Esta cuenta recibe los impuestos automaticamente
INSERT INTO tax_config (node_domain, is_active, tax_rate)
SELECT DISTINCT node_domain, false, 0 FROM users
WHERE node_domain IS NOT NULL
ON CONFLICT (node_domain) DO NOTHING;

-- ===== Permiso de admin: el admin tiene todos los permisos =====
-- El admin es la autoridad maxima durante el arranque del sistema.
-- Puede hacer todo: cambiar impuestos, admitir miembros, etc.
-- Una vez que el sistema esta funcionando, el admin se inhabilita.
-- Esto se maneja en el middleware de autenticacion, no en la base de datos.

-- ===== Tabla para distribuciones de impuestos aprobadas en asamblea =====
-- Cuando la asamblea decide gastar los impuestos, se crea una distribucion
-- que transfiere dinero de la cuenta de impuestos a otras cuentas
CREATE TABLE IF NOT EXISTS tax_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  decision_id UUID, -- propuesta de asamblea que aprobo la distribucion
  from_account UUID NOT NULL REFERENCES users(id), -- cuenta de impuestos
  to_account UUID NOT NULL REFERENCES users(id), -- cuenta destino
  amount BIGINT NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, executed, rejected
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_distributions_domain ON tax_distributions(node_domain);
