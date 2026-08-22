-- Migracion 092: Eliminar huevos frescos viejos y ajustar precio comercial
--
-- Problemas:
-- 1. "Huevos Frescos" sigue existiendo con precio 10 TQ - es el producto
--    viejo incorrecto que nunca se elimino. Ya tenemos las 3 categorias
--    correctas (comercial, criollo, gallina feliz).
-- 2. El huevo comercial debe ser mas barato (3 TQ) para desincentivar
--    la produccion en jaula y promover sistemas mas sanos.

-- === ELIMINAR HUEVOS FRESCOS VIEJOS ===
-- El producto "Huevos Frescos" fue reemplazado por "Huevos Comerciales (Jaula)"
-- en la migracion 090, pero el UPDATE cambio el nombre, no elimino el viejo.
-- Si por algun motivo sigue existiendo con el nombre viejo, lo eliminamos.
DELETE FROM products WHERE name = 'Huevos Frescos';

-- Tambien eliminar cualquier variante que haya quedado
DELETE FROM products WHERE name LIKE 'Huevos Frescos%' AND name NOT LIKE 'Huevos Comerciales%';

-- === AJUSTAR HUEVOS COMERCIALES A 3 TQ ===
-- El usuario quiere que el huevo comercial sea el mas barato (3 TQ)
-- para desincentivar la produccion en jaula.
-- Precio base: 3 TQ / 0.65 kg = 4.62 TQ/kg
UPDATE products SET
  price_per_kg = 4.62,
  price_per_unit = 3.00,
  energy_inputs = 4.62,
  description = 'Huevos de gallinas criadas en jaula (produccion comercial masiva). Sistema mas barato pero menos sano. Energia total: ~17 MJ/kg = 4.62 kWh/kg. Precio base: 4.62 TQ/kg. Una docena pesa ~0.65 kg. Precio por docena: 4.62 x 0.65 = 3.00 TQ. Precio bajo intencionalmente para desincentivar la produccion en jaula y promover sistemas mas sanos (criollo y gallina feliz).',
  badge = 'Comercial'
WHERE name = 'Huevos Comerciales (Jaula)';
