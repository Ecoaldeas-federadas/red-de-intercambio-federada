-- Migracion 036: Corregir URLs de granos y harina (las de 035 eran pasta)
--
-- La migracion 035 uso una URL que resulta ser pasta, no granos.
-- Esta migracion usa URLs verificadas correctamente.

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1765144815957-6bc44c13fc2c?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Granos basicos (maiz, frijol) 1kg';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1699315529894-402495fddb8b?auto=format&fit=crop&w=600&q=80'
WHERE name = 'Harina de maiz 50kg';
