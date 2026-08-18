-- 045_split_grouped_products.sql
-- Separa los productos agrupados en items individuales identificables.
--
-- Modelo: el producto padre (ej: "Frutas de Temporada") sigue existiendo
-- como CONTENEDOR/GRUPO. Dentro de el, cada item (Mango, Naranja, etc.)
-- es un producto individual con su propio ID, nombre y descripcion.
--
-- El padre agrupa items que valen lo mismo. Si un item cambia de precio,
-- se mueve a otro grupo cambiando su group_id.
--
-- El padre NO se oculta. Se muestra como un grupo expandible.
-- Los items individuales tienen group_id = id del padre.

ALTER TABLE products ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;

-- Tabla temporal para mapear productos agrupados -> items individuales
CREATE TEMP TABLE _split_items (
    group_name TEXT,
    item_name TEXT,
    item_desc TEXT
);

-- Frutas de Temporada (2 TQ/kg)
INSERT INTO _split_items VALUES
('Frutas de Temporada', 'Mango', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Papaya', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Guayaba', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Patilla', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Melon', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Pina', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Lechosa', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Cambur', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Limon', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Naranja', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Mandarina', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.'),
('Frutas de Temporada', 'Aguacate', 'Fruta de temporada. ~2.8 MJ/kg = 0.8 kWh/kg.');

-- Tuberculos Ancestrales y Platanos (2 TQ/kg)
INSERT INTO _split_items VALUES
('Tuberculos Ancestrales y Platanos', 'Name Morado', 'Tuberculo de conuco. ~5-7 MJ/kg = 1.5-2 kWh/kg.'),
('Tuberculos Ancestrales y Platanos', 'Ocumo', 'Tuberculo de conuco. ~5-7 MJ/kg = 1.5-2 kWh/kg.'),
('Tuberculos Ancestrales y Platanos', 'Yuca', 'Tuberculo de conuco. ~5-7 MJ/kg = 1.5-2 kWh/kg.'),
('Tuberculos Ancestrales y Platanos', 'Auyama', 'Tuberculo de conuco. ~5-7 MJ/kg = 1.5-2 kWh/kg.'),
('Tuberculos Ancestrales y Platanos', 'Cambur Morado', 'Tuberculo de conuco. ~5-7 MJ/kg = 1.5-2 kWh/kg.'),
('Tuberculos Ancestrales y Platanos', 'Platano', 'Tuberculo de conuco. ~5-7 MJ/kg = 1.5-2 kWh/kg.');

-- Verduras y Hortalizas de Conuco (2 TQ/kg)
INSERT INTO _split_items VALUES
('Verduras y Hortalizas de Conuco', 'Tomate', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.'),
('Verduras y Hortalizas de Conuco', 'Pimenton', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.'),
('Verduras y Hortalizas de Conuco', 'Pepino', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.'),
('Verduras y Hortalizas de Conuco', 'Berenjena', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.'),
('Verduras y Hortalizas de Conuco', 'Zanahoria', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.'),
('Verduras y Hortalizas de Conuco', 'Remolacha', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.'),
('Verduras y Hortalizas de Conuco', 'Ajo', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.'),
('Verduras y Hortalizas de Conuco', 'Cebolla', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.'),
('Verduras y Hortalizas de Conuco', 'Ahuyama', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.'),
('Verduras y Hortalizas de Conuco', 'Calabacin', 'Verdura de conuco. ~3.2-7.2 MJ/kg = 1-2 kWh/kg.');

-- Hojas Verdes y Aromaticas (2 TQ/manojo)
INSERT INTO _split_items VALUES
('Hojas Verdes y Aromaticas', 'Lechuga', 'Hoja verde. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.'),
('Hojas Verdes y Aromaticas', 'Repollo', 'Hoja verde. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.'),
('Hojas Verdes y Aromaticas', 'Espinaca', 'Hoja verde. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.'),
('Hojas Verdes y Aromaticas', 'Acelga', 'Hoja verde. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.'),
('Hojas Verdes y Aromaticas', 'Cilantro', 'Aromatico. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.'),
('Hojas Verdes y Aromaticas', 'Perejil', 'Aromatico. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.'),
('Hojas Verdes y Aromaticas', 'Cebollin', 'Aromatico. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.'),
('Hojas Verdes y Aromaticas', 'Apio', 'Aromatico. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.'),
('Hojas Verdes y Aromaticas', 'Hierbabuena', 'Aromatico. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.'),
('Hojas Verdes y Aromaticas', 'Toronjil', 'Aromatico. ~3.6-7.2 MJ/kg = 1-2 kWh/kg.');

-- Raices y Bulbos (2 TQ/kg)
INSERT INTO _split_items VALUES
('Raices y Bulbos', 'Apio Raiz', 'Raiz criolla de conuco. Energia similar a tuberculos.'),
('Raices y Bulbos', 'Name Topi', 'Raiz criolla de conuco. Energia similar a tuberculos.'),
('Raices y Bulbos', 'Mapuey', 'Raiz criolla de conuco. Energia similar a tuberculos.'),
('Raices y Bulbos', 'Batata', 'Raiz criolla de conuco. Energia similar a tuberculos.'),
('Raices y Bulbos', 'Borugo', 'Raiz criolla de conuco. Energia similar a tuberculos.'),
('Raices y Bulbos', 'Rabano', 'Raiz criolla de conuco. Energia similar a tuberculos.');

-- Frutos Secos y Mani (11 TQ/kg)
INSERT INTO _split_items VALUES
('Frutos Secos y Mani', 'Nueces', 'Fruto seco. 40.87 MJ/kg = 11.35 kWh/kg.'),
('Frutos Secos y Mani', 'Almendras', 'Fruto seco. 40.87 MJ/kg = 11.35 kWh/kg.'),
('Frutos Secos y Mani', 'Mani', 'Fruto seco. 40.87 MJ/kg = 11.35 kWh/kg.'),
('Frutos Secos y Mani', 'Cacahuates', 'Fruto seco. 40.87 MJ/kg = 11.35 kWh/kg.'),
('Frutos Secos y Mani', 'Avellanas', 'Fruto seco. 40.87 MJ/kg = 11.35 kWh/kg.');

-- Granos Basicos Criollos (10 TQ/kg)
INSERT INTO _split_items VALUES
('Granos Basicos Criollos', 'Maiz Criollo Blanco', 'Grano criollo. 31-37 MJ/kg = 9-10 kWh/kg.'),
('Granos Basicos Criollos', 'Maiz Criollo Amarillo', 'Grano criollo. 31-37 MJ/kg = 9-10 kWh/kg.'),
('Granos Basicos Criollos', 'Cebada', 'Grano criollo. 31-37 MJ/kg = 9-10 kWh/kg.'),
('Granos Basicos Criollos', 'Avena', 'Grano criollo. 31-37 MJ/kg = 9-10 kWh/kg.'),
('Granos Basicos Criollos', 'Centeno', 'Grano criollo. 31-37 MJ/kg = 9-10 kWh/kg.');

-- Arroz y Legumbres (11 TQ/kg)
INSERT INTO _split_items VALUES
('Arroz y Legumbres', 'Arroz Procesado', 'Cereal. 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, FAO.'),
('Arroz y Legumbres', 'Sorgo', 'Cereal. 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, FAO.'),
('Arroz y Legumbres', 'Caraota', 'Legumbre. 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, FAO.'),
('Arroz y Legumbres', 'Frijol', 'Legumbre. 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, FAO.'),
('Arroz y Legumbres', 'Quinchoncho', 'Legumbre. 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, FAO.'),
('Arroz y Legumbres', 'Lentejas', 'Legumbre. 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, FAO.'),
('Arroz y Legumbres', 'Garbanzos', 'Legumbre. 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, FAO.'),
('Arroz y Legumbres', 'Habas', 'Legumbre. 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, FAO.');

-- Harinas Integrales (10 TQ/kg)
INSERT INTO _split_items VALUES
('Harinas Integrales', 'Harina de Maiz', 'Harina integral. ~36 MJ/kg = 10 kWh/kg (grano + molienda).'),
('Harinas Integrales', 'Harina de Trigo Integral', 'Harina integral. ~36 MJ/kg = 10 kWh/kg (grano + molienda).'),
('Harinas Integrales', 'Harina de Yuca (Casabe)', 'Harina integral. ~36 MJ/kg = 10 kWh/kg (grano + molienda).'),
('Harinas Integrales', 'Harina de Platano', 'Harina integral. ~36 MJ/kg = 10 kWh/kg (grano + molienda).'),
('Harinas Integrales', 'Quinoa', 'Harina integral. ~36 MJ/kg = 10 kWh/kg (grano + molienda).');

-- Semillas Criollas Adaptadas (1 TQ/sobre)
INSERT INTO _split_items VALUES
('Semillas Criollas Adaptadas', 'Semilla de Maiz', 'Semilla criolla. ~3.6 MJ/sobre = 1 kWh (seleccion + secado).'),
('Semillas Criollas Adaptadas', 'Semilla de Frijol', 'Semilla criolla. ~3.6 MJ/sobre = 1 kWh (seleccion + secado).'),
('Semillas Criollas Adaptadas', 'Semilla de Caraota', 'Semilla criolla. ~3.6 MJ/sobre = 1 kWh (seleccion + secado).'),
('Semillas Criollas Adaptadas', 'Semilla de Ahuyama', 'Semilla criolla. ~3.6 MJ/sobre = 1 kWh (seleccion + secado).'),
('Semillas Criollas Adaptadas', 'Semilla de Tomate', 'Semilla criolla. ~3.6 MJ/sobre = 1 kWh (seleccion + secado).'),
('Semillas Criollas Adaptadas', 'Semilla de Pimenton', 'Semilla criolla. ~3.6 MJ/sobre = 1 kWh (seleccion + secado).'),
('Semillas Criollas Adaptadas', 'Semilla de Lechuga', 'Semilla criolla. ~3.6 MJ/sobre = 1 kWh (seleccion + secado).'),
('Semillas Criollas Adaptadas', 'Semilla de Cilantro', 'Semilla criolla. ~3.6 MJ/sobre = 1 kWh (seleccion + secado).');

-- Plantulas Medicinales y Aromaticas (1 TQ/maceta)
INSERT INTO _split_items VALUES
('Plantulas Medicinales y Aromaticas', 'Poleo', 'Plantula medicinal. ~3.6 MJ/maceta = 1 kWh.'),
('Plantulas Medicinales y Aromaticas', 'Estevia', 'Plantula medicinal. ~3.6 MJ/maceta = 1 kWh.'),
('Plantulas Medicinales y Aromaticas', 'Malojillo', 'Plantula medicinal. ~3.6 MJ/maceta = 1 kWh.'),
('Plantulas Medicinales y Aromaticas', 'Romero', 'Plantula aromatico. ~3.6 MJ/maceta = 1 kWh.'),
('Plantulas Medicinales y Aromaticas', 'Ruda', 'Plantula medicinal. ~3.6 MJ/maceta = 1 kWh.'),
('Plantulas Medicinales y Aromaticas', 'Oregano', 'Plantula aromatico. ~3.6 MJ/maceta = 1 kWh.'),
('Plantulas Medicinales y Aromaticas', 'Sabila', 'Plantula medicinal. ~3.6 MJ/maceta = 1 kWh.'),
('Plantulas Medicinales y Aromaticas', 'Llanten', 'Plantula medicinal. ~3.6 MJ/maceta = 1 kWh.'),
('Plantulas Medicinales y Aromaticas', 'Calendula', 'Plantula medicinal. ~3.6 MJ/maceta = 1 kWh.');

-- Estacas y Esquejes (1 TQ/unidad)
INSERT INTO _split_items VALUES
('Estacas y Esquejes', 'Estaca de Yuca', 'Estaca para propagacion. ~3.6 MJ/unidad = 1 kWh.'),
('Estacas y Esquejes', 'Estaca de Platano', 'Estaca para propagacion. ~3.6 MJ/unidad = 1 kWh.'),
('Estacas y Esquejes', 'Estaca de Mango', 'Estaca para propagacion. ~3.6 MJ/unidad = 1 kWh.'),
('Estacas y Esquejes', 'Estaca de Aguacate', 'Estaca para propagacion. ~3.6 MJ/unidad = 1 kWh.'),
('Estacas y Esquejes', 'Estaca de Citricos', 'Estaca para propagacion. ~3.6 MJ/unidad = 1 kWh.'),
('Estacas y Esquejes', 'Estaca de Mora', 'Estaca para propagacion. ~3.6 MJ/unidad = 1 kWh.'),
('Estacas y Esquejes', 'Estaca de Parchita', 'Estaca para propagacion. ~3.6 MJ/unidad = 1 kWh.');

-- Abonos Organicos (2 TQ/saco)
INSERT INTO _split_items VALUES
('Abonos Organicos', 'Compost Maduro', 'Abono organico. ~5-7 MJ/kg = 1.5-2 kWh/kg.'),
('Abonos Organicos', 'Humus de Lombriz', 'Abono organico. ~5-7 MJ/kg = 1.5-2 kWh/kg.'),
('Abonos Organicos', 'Estiercol Curado', 'Abono organico. ~5-7 MJ/kg = 1.5-2 kWh/kg.'),
('Abonos Organicos', 'Bokashi', 'Abono organico. ~5-7 MJ/kg = 1.5-2 kWh/kg.'),
('Abonos Organicos', 'Gallinaza', 'Abono organico. ~5-7 MJ/kg = 1.5-2 kWh/kg.');

-- Bioinsumos y Preparados (3 TQ/litro)
INSERT INTO _split_items VALUES
('Bioinsumos y Preparados', 'Biofertilizantes', 'Bioinsumo. ~10 MJ/L = 3 kWh/L.'),
('Bioinsumos y Preparados', 'Biopreparados Fungicos', 'Bioinsumo. ~10 MJ/L = 3 kWh/L.'),
('Bioinsumos y Preparados', 'Te de Compost', 'Bioinsumo. ~10 MJ/L = 3 kWh/L.'),
('Bioinsumos y Preparados', 'Purines', 'Bioinsumo. ~10 MJ/L = 3 kWh/L.'),
('Bioinsumos y Preparados', 'Microorganismos Eficientes', 'Bioinsumo. ~10 MJ/L = 3 kWh/L.');

-- Crear productos individuales a partir de los agrupados
INSERT INTO products (
    id, node_domain, name, description, parent_category, category, subcategory,
    unit, price_per_unit, energy_direct, energy_human, energy_inputs,
    energy_amortization, origin, badge, image_url, is_approved, is_system,
    group_id, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    p.node_domain,
    si.item_name,
    si.item_desc,
    p.parent_category,
    p.category,
    p.subcategory,
    p.unit,
    p.price_per_unit,
    p.energy_direct,
    p.energy_human,
    p.energy_inputs,
    p.energy_amortization,
    p.origin,
    p.badge,
    p.image_url,
    p.is_approved,
    false,
    p.id,
    NOW(),
    NOW()
FROM _split_items si
JOIN products p ON p.name = si.group_name AND p.is_group = false
WHERE NOT EXISTS (
    SELECT 1 FROM products p2
    WHERE p2.node_domain = p.node_domain
      AND p2.name = si.item_name
      AND p2.parent_category = p.parent_category
      AND p2.category = p.category
);

-- Marcar los productos agrupados originales como grupos (contenedores)
-- NO se ocultan: siguen visibles como grupos expandibles
UPDATE products SET is_group = true, group_id = id
WHERE name IN (
    'Frutas de Temporada',
    'Tuberculos Ancestrales y Platanos',
    'Verduras y Hortalizas de Conuco',
    'Hojas Verdes y Aromaticas',
    'Raices y Bulbos',
    'Frutos Secos y Mani',
    'Granos Basicos Criollos',
    'Arroz y Legumbres',
    'Harinas Integrales',
    'Semillas Criollas Adaptadas',
    'Plantulas Medicinales y Aromaticas',
    'Estacas y Esquejes',
    'Abonos Organicos',
    'Bioinsumos y Preparados'
)
AND is_group = false;

-- Limpiar tabla temporal
DROP TABLE _split_items;

-- Indices
CREATE INDEX IF NOT EXISTS idx_products_group_id ON products (group_id);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING btree (LOWER(name));
