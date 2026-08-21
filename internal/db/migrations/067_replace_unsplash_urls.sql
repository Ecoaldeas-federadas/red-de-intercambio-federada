-- Migracion 067: No reemplaza URLs de Unsplash.
-- Las fotos reales de Unsplash se mantienen. El frontend ya tiene
-- handlers onError que muestran un placeholder cuando una imagen
-- no carga (404, red caida, etc). No es necesario reemplazar URLs
-- en la base de datos.
-- Esta migracion existe solo para mantener el numero de secuencia.
SELECT 1;
