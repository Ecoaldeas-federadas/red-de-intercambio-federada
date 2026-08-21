-- Migracion 035: Corregir URLs de imagenes de los 7 productos basicos
--
-- La migracion 033 uso URLs inventadas que no existen (404).
-- Esta migracion usa URLs verificadas de Unsplash.

UPDATE products SET
  image_url = '/placeholder.svg'
WHERE name = 'Granos basicos (maiz, frijol) 1kg';

UPDATE products SET
  image_url = '/placeholder.svg'
WHERE name = 'Harina de maiz 50kg';

UPDATE products SET
  image_url = '/placeholder.svg'
WHERE name = 'Verduras frescas 1kg';

UPDATE products SET
  image_url = '/placeholder.svg'
WHERE name = 'Miel 1L';

UPDATE products SET
  image_url = '/placeholder.svg'
WHERE name = 'Prenda artesanal (lana/algodon)';

UPDATE products SET
  image_url = '/placeholder.svg'
WHERE name = 'Tela de algodon 1m';

UPDATE products SET
  image_url = '/placeholder.svg'
WHERE name = 'Hora de labor agricola';
