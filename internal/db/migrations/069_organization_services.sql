-- Migracion 069: Servicios y mensualidades de organizaciones
--
-- Permite que las organizaciones ofrezcan servicios recurrentes
-- (mensualidades, tarifas fijas) que los miembros pagan automaticamente.
-- Tambien soporta organizaciones benéficas que pagan a sus miembros.
--
-- Las organizaciones de la Asamblea (is_assembly_owned) tienen servicios
-- obligatorios que aplican a todos los miembros del nodo.

-- ===== Marcar organizaciones de la Asamblea =====
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_assembly_owned BOOLEAN NOT NULL DEFAULT false;

-- ===== Tabla de servicios de organizaciones =====
CREATE TABLE IF NOT EXISTS organization_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Tipo de servicio:
  -- 'subscription' = mensualidad recurrente (org cobra al miembro)
  -- 'one_time' = cobro unico para un fin especifico
  -- 'benefit' = la organizacion PAGA al miembro (no cobra)
  service_type TEXT NOT NULL DEFAULT 'subscription',
  amount BIGINT NOT NULL DEFAULT 0,
  -- Frecuencia del cobro/pago
  frequency TEXT NOT NULL DEFAULT 'monthly',
  -- Si es obligatorio (org de Asamblea: todos deben pagar)
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  -- Obligaciones, derechos y deberes del miembro
  obligations TEXT,
  rights TEXT,
  duties TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Propuesta de asamblea que aprobo la creacion (si aplica)
  created_by_proposal UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_services_org ON organization_services(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_services_domain ON organization_services(node_domain);
CREATE INDEX IF NOT EXISTS idx_org_services_active ON organization_services(is_active) WHERE is_active = true;

-- ===== Tabla de suscripciones de usuarios a servicios =====
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES organization_services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  -- 'active' = suscrito y pagando
  -- 'paused' = temporalmente suspendido
  -- 'cancelled' = desuscrito voluntariamente
  -- 'auto' = auto-suscrito por ser org de Asamblea (no puede cancelar)
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  last_charged_at TIMESTAMPTZ,
  next_charge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_subs_user ON organization_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_service ON organization_subscriptions(service_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_active ON organization_subscriptions(status) WHERE status IN ('active', 'auto');
CREATE INDEX IF NOT EXISTS idx_org_subs_next_charge ON organization_subscriptions(next_charge_at) WHERE status IN ('active', 'auto');

-- ===== Tabla de cobros fallidos (deudas pendientes) =====
-- Cuando un cobro mensual no se puede completar por saldo insuficiente
CREATE TABLE IF NOT EXISTS subscription_charge_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES users(id),
  service_name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  failure_reason TEXT,
  charged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_charge_failures_user ON subscription_charge_failures(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_failures_unresolved ON subscription_charge_failures(resolved) WHERE resolved = false;

-- ===== Tipo de propuesta de asamblea para crear organizaciones =====
-- Se maneja via assembly_config, no necesita columna adicional
-- El tipo 'create_assembly_organization' se agrega en el seed o config
