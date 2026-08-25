-- Migracion 110: Filtros de catalogo eticos/dietarios/culturales
-- Permite que cada nodo configure reglas sobre que productos pueden o no pueden
-- estar en el catalogo, segun la filosofia de la comunidad.
-- Ej: ISKCON puede prohibir carne, ajo, cebolla, cafe, alcohol.
--     Plum Village puede prohibir carne, pescado, alcohol.
-- Estas reglas son NODO-ESPECIFICAS. No afectan a otros nodos.
-- La Feria Conuquera NO se modifica.

CREATE TABLE IF NOT EXISTS catalog_dietary_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    -- Categoria del producto (ej: "carne", "ajo", "alcohol", "tabaco")
    category_name TEXT NOT NULL,
    -- Si es true, los productos de esta categoria estan prohibidos
    is_prohibited BOOLEAN NOT NULL DEFAULT false,
    -- Si no esta prohibido pero requiere etiqueta/advertencia
    requires_label BOOLEAN NOT NULL DEFAULT false,
    -- Razon de la regla (ej: "No se consume carne en ISKCON")
    reason TEXT,
    -- Etiqueta a mostrar (ej: "Organico", "Vegano", "Biodinamico")
    label TEXT,
    -- Si la regla esta activa
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(node_domain, category_name)
);

CREATE INDEX IF NOT EXISTS idx_catalog_dietary_rules_domain ON catalog_dietary_rules (node_domain, is_active);

-- Tabla para etiquetas positivas (organico, biodinamico, regenerativo, etc.)
CREATE TABLE IF NOT EXISTS catalog_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#10b981',
    icon TEXT DEFAULT 'leaf',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(node_domain, name)
);

CREATE INDEX IF NOT EXISTS idx_catalog_labels_domain ON catalog_labels (node_domain, is_active);

-- Tabla para asignar etiquetas a productos
CREATE TABLE IF NOT EXISTS product_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_domain TEXT NOT NULL,
    product_id UUID NOT NULL,
    label_id UUID NOT NULL,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_product_labels_product ON product_labels (product_id);
CREATE INDEX IF NOT EXISTS idx_product_labels_label ON product_labels (label_id);
