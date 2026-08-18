-- Migracion 023: Tabla store_items + owner_id + product_id + product_code
--
-- Problemas:
-- 1. La columna product_code no existia pero las queries la seleccionaban
-- 2. La tabla store_items no existia en ninguna migracion
-- 3. store_items no tenia owner_id para saber de quien es cada tienda
-- 4. store_items no tenia product_id para vincular al catalogo de productos

-- 1. product_code en products (por si la migracion 022 no se ejecuto)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code TEXT DEFAULT '';

-- 2. Crear tabla store_items si no existe
CREATE TABLE IF NOT EXISTS store_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  origin TEXT DEFAULT 'internal',
  price_trueque BIGINT NOT NULL DEFAULT 0,
  stock BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  external_op_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_items_node ON store_items (node_domain, is_active);
CREATE INDEX IF NOT EXISTS idx_store_items_owner ON store_items (owner_id);
CREATE INDEX IF NOT EXISTS idx_store_items_product ON store_items (product_id);

-- 3. Asegurar que los productos seed existen para el nodo 'localhost' tambien
-- (la migracion 018 los inserto solo para 'default')
INSERT INTO products (node_domain, name, category, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code)
SELECT 'localhost', name, category, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code
FROM products
WHERE node_domain = 'default' AND is_system = true
ON CONFLICT DO NOTHING;
