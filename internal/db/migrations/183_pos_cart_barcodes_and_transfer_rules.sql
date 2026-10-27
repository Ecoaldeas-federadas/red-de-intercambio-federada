-- Migracion 183: Canasta POS obligatoria, codigos de barra con peso, etiquetas NFC/QR,
-- micro-iconos ultraligeros y servicios universales en tienda.
--
-- Principios:
--   1. Ningun intercambio comercial puede ser una transferencia de monto libre:
--      todo cobro POS/QR/NFC debe adjuntar la canasta de productos/servicios reales.
--   2. Servicios universales (Jornal Agricola / Conuco, Trabajo General / Mano Vuelta)
--      estan automaticamente disponibles en la tienda de todo miembro activo.
--   3. Cada item de tienda (store_items) y servicio universal recibe un item_code
--      corto de 5 digitos para codigos de barra EAN-13 con peso/cantidad incrustada
--      (prefijo 2 + 5 digitos item_code + 5 digitos peso/cantidad + check digit).
--   4. Micro-icono 48x48 (image_icon_url, ~1.5 KB) para sincronizacion ultraligera
--      del catalogo del vendedor en enlaces lentos (LoRa / punto a punto).

-- ============ 1. Columnas de micro-icono, servicio universal e item_code ============

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_icon_url TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_universal_service BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_code TEXT DEFAULT '';

ALTER TABLE uploaded_images ADD COLUMN IF NOT EXISTS icon_url TEXT DEFAULT '';

ALTER TABLE store_items ADD COLUMN IF NOT EXISTS item_code TEXT DEFAULT '';
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS image_icon_url TEXT DEFAULT '';
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS is_service BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_store_items_owner_code ON store_items(owner_id, item_code);
CREATE INDEX IF NOT EXISTS idx_products_universal_service ON products(is_universal_service) WHERE is_universal_service = true;
CREATE INDEX IF NOT EXISTS idx_products_item_code ON products(item_code) WHERE item_code IS NOT NULL AND item_code <> '';

-- ============ 2. Marcar servicios universales en el catalogo federado ============
-- El trabajo en el conuco (Jornal Agricola) y el trabajo general / mano vuelta
-- son universales: cualquier miembro puede ofrecerlos sin agregarlos manualmente.

UPDATE products
SET is_universal_service = true
WHERE node_domain = '__FEDERATION__'
  AND item_type = 'service'
  AND (
    catalog_key IN (
      'fed-jornal-agricola',
      'fed-jornada-agricola-completa',
      'fed-jornada-de-trabajo-general',
      'fed-hora-de-trabajo-comunitario',
      'fed-trabajo-en-conuco',
      'fed-mano-vuelta-agricola'
    )
    OR category IN ('Trabajo Agricola', 'Trabajo General')
  );

-- Si no existe un item explicito "Hora de Trabajo en el Conuco" en __FEDERATION__, asegurarlo
INSERT INTO products (
  id, node_domain, catalog_key, item_type, name,
  parent_category, category, subcategory, unit, description, badge,
  price_per_unit, energy_human, is_approved, is_system, is_active, is_hidden,
  origin, is_universal_service, item_code
)
SELECT
  gen_random_uuid(), '__FEDERATION__', 'fed-trabajo-en-el-conuco', 'service',
  'Trabajo en el Conuco (Hora)',
  'Servicios', 'Trabajo Agricola', 'Jornales', 'hora',
  'Hora de trabajo agricola en el conuco o parcela comunitaria (Mano Vuelta). Servicio universal disponible para todos los miembros.',
  'Universal',
  100, 1, true, true, true, false,
  'internal', true, '90001'
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE catalog_key = 'fed-trabajo-en-el-conuco'
);

-- Asignar item_code de 5 digitos (90001..99999) a los productos/servicios federados que no lo tengan
WITH numbered_fed AS (
  SELECT id, (90000 + ROW_NUMBER() OVER (ORDER BY catalog_key, id))::text AS new_code
  FROM products
  WHERE node_domain = '__FEDERATION__' AND COALESCE(item_code, '') = ''
)
UPDATE products p
SET item_code = nf.new_code
FROM numbered_fed nf
WHERE p.id = nf.id;

-- Asignar item_code de 5 digitos (10001..89999) a los store_items existentes que no lo tengan
WITH numbered_store AS (
  SELECT id, (10000 + (ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at, id) % 79999))::text AS new_code
  FROM store_items
  WHERE COALESCE(item_code, '') = ''
)
UPDATE store_items si
SET item_code = ns.new_code
FROM numbered_store ns
WHERE si.id = ns.id;

-- Marcar is_service = true en store_items cuyo producto base sea un servicio o cuya unidad sea de tiempo/servicio
UPDATE store_items si
SET is_service = true
FROM products p
WHERE si.product_id = p.id AND p.item_type = 'service';

UPDATE store_items
SET is_service = true
WHERE lower(COALESCE(unit, '')) IN ('hora', 'jornada', 'sesion', 'clase', 'consulta', 'servicio', 'taller', 'dia');

-- ============ 3. Canasta en cargos POS y transacciones NFC ============

ALTER TABLE pos_charges ADD COLUMN IF NOT EXISTS items_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE nfc_transactions ADD COLUMN IF NOT EXISTS items_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE pending_multisig_payments ADD COLUMN IF NOT EXISTS items_json JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Tabla detallada de lineas de venta en POS (QR, NFC simple, NFC comunitario)
CREATE TABLE IF NOT EXISTS pos_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL DEFAULT '__LOCAL__',
  pos_charge_id UUID REFERENCES pos_charges(id) ON DELETE CASCADE,
  nfc_transaction_id UUID REFERENCES nfc_transactions(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id),
  buyer_id UUID REFERENCES users(id),
  store_item_id UUID REFERENCES store_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  item_code TEXT NOT NULL DEFAULT '',
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unidad',
  quantity NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  is_service BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_tx_items_charge ON pos_transaction_items(pos_charge_id);
CREATE INDEX IF NOT EXISTS idx_pos_tx_items_nfc ON pos_transaction_items(nfc_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pos_tx_items_seller ON pos_transaction_items(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_tx_items_buyer ON pos_transaction_items(buyer_id, created_at DESC);

-- ============ 4. Canastas pre-armadas para etiquetas NFC / QR / Codigos de barra ============
-- Permite guardar una canasta con un codigo corto (ej: 6 caracteres o EAN-13 prefijo 28)
-- para grabarla en etiquetas NFC pequenas (NTAG213 de 144 bytes) o imprimir en codigo de barras/QR.

CREATE TABLE IF NOT EXISTS pos_preset_baskets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL DEFAULT '__LOCAL__',
  short_code TEXT NOT NULL UNIQUE,
  barcode_ean13 TEXT DEFAULT '',
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cents BIGINT NOT NULL DEFAULT 0,
  is_reusable BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_preset_baskets_seller ON pos_preset_baskets(seller_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pos_preset_baskets_barcode ON pos_preset_baskets(barcode_ean13) WHERE barcode_ean13 <> '';
