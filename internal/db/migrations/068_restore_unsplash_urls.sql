-- Migracion 068: Restaurar URLs originales de Unsplash en products
-- La migracion 067 (version erronea) reemplazo todas las URLs de
-- Unsplash con /placeholder.svg. Esta migracion restaura las URLs
-- originales producto por producto, sin resetear la base de datos.
-- Solo actualiza productos que tienen /placeholder.svg (los que
-- fueron afectados por la 067). Los que ya tienen otra URL no se tocan.

UPDATE products SET image_url = '/images/products/alimentacion/hojas-verdes.jpg' WHERE name = 'Hortalizas y Hojas Verdes de El Junquito' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/tuberculos.jpg' WHERE name = 'Tuberculos Ancestrales y Platanos' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/cacao-chocolate-cafe.jpg' WHERE name = 'Cacao Puro, Chocolates y Cafe de Montana' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/granos-basicos.jpg' WHERE name = 'Granos basicos (maiz, frijol) 1kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/harinas-integrales.jpg' WHERE name = 'Harina de maiz 50kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/verduras-hortalizas.jpg' WHERE name = 'Verduras frescas 1kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/miel-pura.jpg' WHERE name = 'Miel 1L' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/textiles/camisa-algodon.jpg' WHERE name = 'Prenda artesanal (lana/algodon)' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/textiles/tela-algodon.jpg' WHERE name = 'Tela de algodon 1m' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/servicios/jornal-agricola.jpg' WHERE name = 'Hora de labor agricola' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/granos-basicos.jpg' WHERE name = 'Granos basicos (maiz, frijol) 1kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/harinas-integrales.jpg' WHERE name = 'Harina de maiz 50kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/frutas-temporada.jpg' WHERE name = 'Frutas de Temporada' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/raices-bulbos.jpg' WHERE name = 'Raices y Bulbos' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/alimentacion/panaderia.jpg