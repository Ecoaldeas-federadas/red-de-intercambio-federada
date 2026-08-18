-- Migracion 043: Federacion de productos entre nodos
-- Cuando un nodo crea un producto nuevo, lo comunica a los demas nodos federados.
-- Cada nodo debe aprobarlo individualmente para que este disponible en su territorio.
-- Si no se aprueba, no se puede usar para producir, comprar ni nada.

-- ============ 1. Tabla de propuestas de productos federados ============
CREATE TABLE IF NOT EXISTS product_federation_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node TEXT NOT NULL,  -- nodo que creo el producto
  source_product_id UUID NOT NULL,  -- id del producto en el nodo origen
  name TEXT NOT NULL,
  parent_category TEXT DEFAULT '',
  category TEXT NOT NULL,
  subcategory TEXT DEFAULT '',
  unit TEXT NOT NULL,
  description TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  price_per_unit BIGINT NOT NULL DEFAULT 0,
  is_composite BOOLEAN NOT NULL DEFAULT false,
  composition JSONB,  -- composicion del producto si es compuesto
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_node, source_product_id)
);

CREATE INDEX IF NOT EXISTS idx_fed_proposals_status ON product_federation_proposals (status);
CREATE INDEX IF NOT EXISTS idx_fed_proposals_source ON product_federation_proposals (source_node);

-- ============ 2. Campo en products para rastrear origen federado ============
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_node TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_product_id UUID;

-- ============ 3. Tipo de mensaje federado para productos ============
-- Se anade al protocolo existente via tabla processed_messages
-- El mensaje se envia a /federation/inbox con Type "ProductProposal"
