-- Migracion 033: Actualizar imagenes y badges de los 7 productos basicos
--
-- Los 7 productos basicos se insertaron sin imagen ni badge.
-- Esta migracion les asigna imagen y badge verificados.

UPDATE products SET
  badge = 'Criollo',
  image_url = '/placeholder.svg'
WHERE name = 'Granos basicos (maiz, frijol) 1kg';

UPDATE products SET
  badge = 'Base Criolla',
  image_url = '/placeholder.svg'
WHERE name = 'Harina de maiz 50kg';

UPDATE products SET
  badge = 'Del Conuco',
  image_url = '/placeholder.svg'
WHERE name = 'Verduras frescas 1kg';

UPDATE products SET
  badge = 'Pura',
  image_url = '/placeholder.svg'
WHERE name = 'Miel 1L';

UPDATE products SET
  badge = 'Hecho a Mano',
  image_url = '/placeholder.svg'
WHERE name = 'Prenda artesanal (lana/algodon)';

UPDATE products SET
  badge = 'Natural',
  image_url = '/placeholder.svg'
WHERE name = 'Tela de algodon 1m';

UPDATE products SET
  badge = 'Conuquero',
  image_url = '/placeholder.svg'
WHERE name = 'Hora de labor agricola';
