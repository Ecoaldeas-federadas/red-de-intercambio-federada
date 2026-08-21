-- Migracion 035: Corregir URLs de imagenes de los 7 productos basicos
--
-- La migracion 033 uso URLs inventadas que no existen (404).
-- Esta migracion usa URLs verificadas de Unsplash.

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Granos basicos (maiz, frijol) 1kg';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Harina de maiz 50kg';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Verduras frescas 1kg';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1587049352846-4a222e784f38?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Miel 1L';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Prenda artesanal (lana/algodon)';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Tela de algodon 1m';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Hora de labor agricola';
