-- Migracion 068: Restaurar URLs originales de Unsplash en products
-- La migracion 067 (version erronea) reemplazo todas las URLs de
-- Unsplash con /placeholder.svg. Esta migracion restaura las URLs
-- originales producto por producto, sin resetear la base de datos.
-- Solo actualiza productos que tienen /placeholder.svg (los que
-- fueron afectados por la 067). Los que ya tienen otra URL no se tocan.

UPDATE products SET image_url = '/images/products/photo-1542838132-92c53300491e.jpg' WHERE name = 'Hortalizas y Hojas Verdes de El Junquito' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1578269830911-6159f1aee3b4.jpg' WHERE name = 'Tuberculos Ancestrales y Platanos' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1578269830911-6159f1aee3b4.jpg' WHERE name = 'Cacao Puro, Chocolates y Cafe de Montana' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1551892374-ecf8754cf8b0.jpg' WHERE name = 'Granos basicos (maiz, frijol) 1kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1551892374-ecf8754cf8b0.jpg' WHERE name = 'Harina de maiz 50kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1542838132-92c53300491e.jpg' WHERE name = 'Verduras frescas 1kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/commons-photo-1587049352846-4a222e784f38.jpg' WHERE name = 'Miel 1L' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1591047139829-d91aecb6caea.jpg' WHERE name = 'Prenda artesanal (lana/algodon)' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1605000797499-95a51c5269ae.jpg' WHERE name = 'Tela de algodon 1m' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1592982537447-7440770cbfc9.jpg' WHERE name = 'Hora de labor agricola' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1765144815957-6bc44c13fc2c.jpg' WHERE name = 'Granos basicos (maiz, frijol) 1kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1699315529894-402495fddb8b.jpg' WHERE name = 'Harina de maiz 50kg' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/commons-photo-1619566636856-adf8ab172aa0.jpg' WHERE name = 'Frutas de Temporada' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/photo-1578269830911-6159f1aee3b4.jpg' WHERE name = 'Raices y Bulbos' AND image_url = '/placeholder.svg';
UPDATE products SET image_url = '/images/products/commons-photo-1509444154694-2c20049b1c1e.jpg