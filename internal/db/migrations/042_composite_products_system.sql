-- Migracion 042: Sistema de productos compuestos
-- Permite que cualquier usuario cree productos compuestos en su tienda
-- seleccionando materias primas y productos base del catalogo aprobado.
-- El precio se calcula automaticamente, no se ingresa manualmente.
-- Los productos compuestos personales NO requieren aprobacion de asamblea.

-- ============ 1. Tabla de composiciones de productos ============
-- Cada producto (del catalogo o de tienda) puede tener una composicion
-- que detalla de que esta hecho y en que cantidad
CREATE TABLE IF NOT EXISTS product_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,  -- puede ser products.id o store_items.id
  product_type TEXT NOT NULL DEFAULT 'catalog',  -- 'catalog' o 'store_item'
  component_product_id UUID REFERENCES products(id),  -- materia prima o producto base
  component_name TEXT NOT NULL,  -- nombre del componente (denormalizado)
  component_unit TEXT NOT NULL DEFAULT 'unidad',  -- unidad del componente
  component_price BIGINT NOT NULL DEFAULT 0,  -- precio unitario del componente al momento de crear
  quantity NUMERIC NOT NULL DEFAULT 1,  -- cantidad usada
  subtotal BIGINT NOT NULL DEFAULT 0,  -- component_price * quantity (calculado)
  component_category TEXT NOT NULL DEFAULT 'materia_prima',  -- materia_prima, producto_base, trabajo, embalaje, envio, otro
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compositions_product ON product_compositions (product_id);
CREATE INDEX IF NOT EXISTS idx_compositions_component ON product_compositions (component_product_id);

-- ============ 2. Anadir campos a store_items para productos compuestos ============
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS is_composite BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS composite_description TEXT DEFAULT '';

-- ============ 3. Anadir campo a products para marcar compuestos aprobados ============
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_composite BOOLEAN NOT NULL DEFAULT false;

-- ============ 4. Categorias de componentes para el selector ============
-- Estas son las categorias que aparecen en el selector de componentes
-- cuando un usuario crea un producto compuesto:
-- materia_prima: materias primas del catalogo (arcilla, madera, tela, etc.)
-- producto_base: productos compuestos aprobados por asamblea (vaso de arcilla, etc.)
-- trabajo: horas de trabajo (alfareria, carpinteria, costura, etc.)
-- embalaje: tipos de envase/embalaje aprobados
-- envio: costos de envio por distancia aprobados
-- otro: otros costos aprobados

-- ============ 5. Insertar productos base de embalaje y envio ============
-- Estos son productos "base" que se usan como componentes al crear compuestos
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT nd.node_domain, p.name, p.parent, p.cat, p.subcat, 'internal', p.unit, p.descr, p.badge, p.img, p.price, true, true, '', 0, 0, p.price, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
CROSS JOIN (VALUES
  -- Embalajes
  ('Envase de Vidrio 200ml', 'Embalaje', 'Envases', 'Vidrio', 'unidad', 'Envase de vidrio reutilizable 200ml para jugos, mermeladas, etc. Energia: vidrio 12.7 MJ/kg x 0.3kg = 3.8 MJ = 1 TQ. Fuente: ICE Database.', 'Retornable', 'https://images.unsplash.com/photo-1582131503261-f807197e9a4c?auto=format&fit=crop&w=600&q=80', 2),
  ('Envase de Vidrio 500ml', 'Embalaje', 'Envases', 'Vidrio', 'unidad', 'Envase de vidrio reutilizable 500ml. Energia: vidrio 12.7 MJ/kg x 0.5kg = 6.4 MJ = 2 TQ. Fuente: ICE Database.', 'Retornable', 'https://images.unsplash.com/photo-1582131503261-f807197e9a4c?auto=format&fit=crop&w=600&q=80', 2),
  ('Envase de Vidrio 1L', 'Embalaje', 'Envases', 'Vidrio', 'unidad', 'Envase de vidrio reutilizable 1 litro. Energia: vidrio 12.7 MJ/kg x 0.8kg = 10.2 MJ = 3 TQ. Fuente: ICE Database.', 'Retornable', 'https://images.unsplash.com/photo-1582131503261-f807197e9a4c?auto=format&fit=crop&w=600&q=80', 3),
  ('Envase de Barro 500ml', 'Embalaje', 'Envases', 'Barro', 'unidad', 'Envase de barro artesanal 500ml. Energia: arcilla 2.5 MJ/kg x 0.5kg + coccion = 7 MJ = 2 TQ. Fuente: ICE Database.', 'Artesanal', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80', 3),
  ('Bolsa de Tela de Algodon', 'Embalaje', 'Envases', 'Tela', 'unidad', 'Bolsa reutilizable de tela de algodon. Energia: tela 143 MJ/kg x 0.05kg = 7 MJ = 2 TQ. Fuente: ICE Database.', 'Reutilizable', 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80', 2),
  ('Bolsa de Papel Kraft', 'Embalaje', 'Envases', 'Papel', 'unidad', 'Bolsa de papel kraft reciclable. Energia: papel 25 MJ/kg x 0.03kg = 0.75 MJ = 0.2 TQ. Fuente: ICE Database.', 'Reciclable', 'https://images.unsplash.com/photo-1582131503261-f807197e9a4c?auto=format&fit=crop&w=600&q=80', 1),
  ('Hoja de Platanero (envoltorio)', 'Embalaje', 'Envases', 'Natural', 'unidad', 'Hoja de platanero para envolver alimentos. Energia: ~0.1 TQ (recoleccion natural).', 'Biodegradable', 'https://images.unsplash.com/photo-1582131503261-f807197e9a4c?auto=format&fit=crop&w=600&q=80', 1),
  -- Envios por distancia
  ('Envio Local (dentro del nodo)', 'Envio', 'Entrega', 'Local', 'entrega', 'Entrega dentro de la comunidad/nodo. Energia: ~1 kWh (caminata o bicicleta).', 'Local', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 1),
  ('Envio Vecino (nodo cercano)', 'Envio', 'Entrega', 'Vecino', 'entrega', 'Entrega a nodo vecino federado. Energia: ~5 kWh (transporte menor).', 'Federado', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 5),
  ('Envio Lejano (nodo distante)', 'Envio', 'Entrega', 'Lejano', 'entrega', 'Entrega a nodo distante federado. Energia: ~15 kWh (transporte mayor).', 'Federado', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 15),
  ('Recogida en Parcela', 'Envio', 'Entrega', 'Recogida', 'entrega', 'El comprador recoge directamente en la parcela/punto del productor. Sin costo de envio. Energia: 0.', 'Sin Envio', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80', 0)
) AS p(name, parent, cat, subcat, unit, descr, badge, img, price)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = p.name AND node_domain = nd.node_domain);
