-- Migracion 115: Filtros de catalogo por ORGANIZACION
-- Permite que cada organizacion dentro de un nodo tenga sus propias reglas
-- sobre que productos puede ofrecer, segun su religion/filosofia.
-- Ej: En un nodo federado, la organizacion "Granja ISKCON" puede prohibir
-- carne en su catalogo, mientras que "Cooperativa Catolica" no tiene
-- esa restriccion. Esto es independiente de las reglas del nodo.
--
-- Las reglas del nodo son el limite superior: si el nodo prohibe alcohol,
-- ninguna organizacion puede vender alcohol.
-- Las reglas de la organizacion son adicionales: la organizacion puede
-- ser mas restrictiva que el nodo pero no menos.

CREATE TABLE IF NOT EXISTS organization_catalog_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    -- Referencia al usuario-organizacion (account_type='organization')
    organization_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Categoria del producto (ej: "carne", "ajo", "alcohol", "tabaco")
    category_name TEXT NOT NULL,
    -- Si es true, esta organizacion no puede ofrecer productos de esta categoria
    is_prohibited BOOLEAN NOT NULL DEFAULT false,
    -- Si no esta prohibido pero requiere etiqueta/advertencia
    requires_label BOOLEAN NOT NULL DEFAULT false,
    -- Razon de la regla (ej: "No se consume carne en ISKCON")
    reason TEXT,
    -- Si la regla esta activa
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, category_name)
);

CREATE INDEX IF NOT EXISTS idx_org_catalog_rules_org ON organization_catalog_rules (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_org_catalog_rules_domain ON organization_catalog_rules (node_domain, is_active);

-- Tabla para que las organizaciones tengan su propio perfil religioso/filosofico
-- Esto permite que el sistema muestre automaticamente que productos no pueden
-- ofrecer y aplique las reglas correspondientes.
CREATE TABLE IF NOT EXISTS organization_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    organization_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- Perfil filosofico/religioso (ej: "iskcon", "adventista", "amish", "plum_village")
    -- Si esta vacio, la organizacion no tiene restricciones religiosas
    faith_profile TEXT DEFAULT '',
    -- Descripcion de la organizacion
    description TEXT,
    -- Si el perfil esta activo
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_profiles_domain ON organization_profiles (node_domain, is_active);
