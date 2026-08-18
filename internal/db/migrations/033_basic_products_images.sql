-- Migracion 033: Actualizar imagenes y badges de los 7 productos basicos
--
-- Los 7 productos basicos se insertaron sin imagen ni badge.
-- Esta migracion les asigna imagen y badge.

UPDATE products SET
  badge = 'Criollo',
  image_url = 'https://images.unsplash.com/photo-1551753021-1c0f4f6b1c5b?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Granos basicos (maiz, frijol) 1kg';

UPDATE products SET
  badge = 'Base Criolla',
  image_url = 'https://images.unsplash.com/photo-1568254183919-78a4f43a0a65?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Harina de maiz 50kg';

UPDATE products SET
  badge = 'Del Conuco',
  image_url = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Verduras frescas 1kg';

UPDATE products SET
  badge = 'Pura',
  image_url = 'https://images.unsplash.com/photo-1587049352846-4a222e784f38?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Miel 1L';

UPDATE products SET
  badge = 'Hecho a Mano',
  image_url = 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Prenda artesanal (lana/algodon)';

UPDATE products SET
  badge = 'Natural',
  image_url = 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Tela de algodon 1m';

UPDATE products SET
  badge = 'Conuquero',
  image_url = 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Hora de labor agricola';
