-- Migracion 120: Allowlist de productos por nodo + compresion de imagenes
--
-- Permite que cada nodo decida que productos estan permitidos o no permitidos
-- en su catalogo. Esto aplica tanto a productos locales como federados.
--
-- Conceptos:
-- - Permitido: el producto puede venderse/usarse en el nodo
-- - No permitido: el producto esta explicitamente prohibido en el nodo
-- - NULL (no decidido): el producto existe pero el nodo no ha decidido

-- Tabla de allowlist por nodo
CREATE TABLE IF NOT EXISTS product_node_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    node_domain TEXT NOT NULL,
    is_allowed BOOLEAN NOT NULL,
    decided_by UUID REFERENCES users(id),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, node_domain)
);

CREATE INDEX IF NOT EXISTS idx_allowlist_node ON product_node_allowlist (node_domain, is_allowed);
CREATE INDEX IF NOT EXISTS idx_allowlist_product ON product_node_allowlist (product_id);

-- Para productos locales, is_approved ya sirve como flag de permitido.
-- Pero necesitamos un campo is_allowed en products para compatibilidad simple
-- en nodos single-node (demo). Para multi-node, usar product_node_allowlist.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_allowed BOOLEAN;
-- NULL = no decidido, true = permitido, false = no permitido

-- Migrar productos locales aprobados a is_allowed = true
UPDATE products SET is_allowed = true WHERE is_approved = true AND is_allowed IS NULL;

-- Campo para thumbnail (imagen comprimida para lista)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_thumb_url TEXT;
-- URL del thumbnail (imagen pequena comprimida para carga rapida en listas)

-- Tabla de imagenes subidas: anadir campos de thumbnail
ALTER TABLE uploaded_images ADD COLUMN IF NOT EXISTS thumb_url TEXT;
ALTER TABLE uploaded_images ADD COLUMN IF NOT EXISTS width INT;
ALTER TABLE uploaded_images ADD COLUMN IF NOT EXISTS height INT;
