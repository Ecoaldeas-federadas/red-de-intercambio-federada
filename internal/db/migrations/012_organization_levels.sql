-- Migracion 012: Niveles de organizacion separados de niveles de miembro
--
-- Antes los niveles de organizacion (org_produccion, org_consumo, etc.) estaban
-- mezclados en member_levels. Ahora tienen su propia tabla organization_levels.
-- Los niveles de miembro (nuevo, activo, honorario) quedan en member_levels.

CREATE TABLE IF NOT EXISTS organization_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  level INT NOT NULL DEFAULT 1,
  credit_limit BIGINT NOT NULL DEFAULT -100000,
  debit_limit BIGINT NOT NULL DEFAULT 100000,
  tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  can_cross_node_trade BOOLEAN NOT NULL DEFAULT true,
  can_use_external_bridge BOOLEAN NOT NULL DEFAULT false,
  can_view_audit BOOLEAN NOT NULL DEFAULT true,
  max_members INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, name)
);

-- Indice para busqueda rapida
CREATE INDEX IF NOT EXISTS idx_org_levels_node
  ON organization_levels (node_domain, is_active);

-- Migrar los niveles org_* existentes desde member_levels a organization_levels
-- (solo si ya se habian insertado por la migracion 011 anterior)
INSERT INTO organization_levels (id, node_domain, name, description, level, credit_limit, debit_limit, tax_rate, is_active)
SELECT id, node_domain, name, description, level, credit_limit, debit_limit, COALESCE(tax_rate, 0), is_active
FROM member_levels
WHERE name LIKE 'org_%' AND node_domain = 'localhost'
ON CONFLICT (node_domain, name) DO NOTHING;

-- Eliminar los niveles org_* de member_levels (ya estan en organization_levels)
DELETE FROM member_levels WHERE name LIKE 'org_%';

-- Niveles de organizacion por defecto (si no existen ya)
INSERT INTO organization_levels (node_domain, name, description, level, credit_limit, debit_limit, tax_rate, is_active)
SELECT 'localhost', name, desc_text, lvl, credit, debit, tax, true
FROM (VALUES
  ('org_produccion', 'Organizacion de produccion. Fabrica o produce bienes.', 1, -100000, 100000, 0.02),
  ('org_consumo', 'Organizacion de consumo. Compra bienes para distribuir.', 1, -50000, 50000, 0.01),
  ('org_publica', 'Institucion publica. Sin fines de lucro, exenta de impuestos.', 1, -1000000, 1000000, 0.00),
  ('org_cooperativa', 'Cooperativa. Propiedad compartida de miembros.', 1, -200000, 200000, 0.01)
) AS t(name, desc_text, lvl, credit, debit, tax)
WHERE NOT EXISTS (
  SELECT 1 FROM organization_levels
  WHERE node_domain = 'localhost' AND name = t.name
);

-- Agregar columna organization_level_id a users para vincular organizaciones a su nivel
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_level_id UUID REFERENCES organization_levels(id);
