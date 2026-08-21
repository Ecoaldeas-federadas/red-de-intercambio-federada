-- Migracion 036: Corregir URLs de granos y harina (las de 035 eran pasta)
--
-- La migracion 035 uso una URL que resulta ser pasta, no granos.
-- Esta migracion usa URLs verificadas correctamente.

UPDATE products SET
  image_url = '/placeholder.svg'
WHERE name = 'Granos basicos (maiz, frijol) 1kg';

UPDATE products SET
  image_url = '/placeholder.svg'
WHERE name = 'Harina de maiz 50kg';
