-- Migracion 100: Convertir datos de calculadora de 'localhost' a '__LOCAL__'
-- Las migraciones anteriores (010) sembraron datos con node_domain='localhost'.
-- Ahora todos los datos locales deben usar '__LOCAL__' para que funcionen
-- independientemente del dominio real del nodo.

UPDATE calculator_parameters
SET node_domain = '__LOCAL__'
WHERE node_domain IN ('localhost', 'default');

UPDATE calculator_categories
SET node_domain = '__LOCAL__'
WHERE node_domain IN ('localhost', 'default');
