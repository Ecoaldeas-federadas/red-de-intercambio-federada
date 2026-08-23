-- Migracion 099: Reducir precio de Huevos Comerciales (Jaula) de 4 a 3 TQ
--
-- El precio de los huevos comerciales en jaula se reduce de 4 TQ/docena a 3 TQ/docena
-- para servir como referencia mas precisa al comparar con precios reales del mercado
-- y validar la canasta basica en varios paises.
--
-- Calculo: 3 TQ/docena / 0.65 kg = 4.62 TQ/kg
--
-- Este producto sirve como vara de medicion para comparar precios reales
-- de huevos en jaula contra el sistema TQ, aunque la comunidad no use
-- este sistema de produccion.

UPDATE products SET
  price_per_unit = 3.00,
  price_per_kg = 4.62,
  energy_inputs = 4.62,
  description = 'Huevos de gallinas criadas en jaula (produccion comercial masiva). Sistema mas barato. Precio de referencia para comparar con precios reales del mercado y validar la canasta basica. Una docena pesa ~0.65 kg. Precio por docena: 3 TQ.'
WHERE name = 'Huevos Comerciales (Jaula)';
