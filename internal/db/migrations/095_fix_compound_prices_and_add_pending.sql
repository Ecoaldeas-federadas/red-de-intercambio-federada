-- Migracion 095: Corregir precios 094 + agregar productos compuestos pendientes
--
-- PARTE 1: Corregir los calculos de la migracion 094.
--          El metodo correcto es: calcular energia del lote completo,
--          dividir por el peso total del lote para obtener MJ/kg,
--          luego price_per_kg = MJ/kg / 3.6 (kWh/kg = TQ/kg),
--          y price_per_unit = price_per_kg * weight_kg.
--
-- PARTE 2: Agregar los productos faltantes como productos compuestos
--          (is_composite = true) con precio 0 e ingredientes en cantidad 0.
--          La persona despues edita el producto compuesto, agrega las
--          cantidades correctas de cada ingrediente, y el sistema
--          calcula el precio automaticamente.

-- =====================================================================
-- PARTE 1: CORREGIR PRECIOS DE MIGRACION 094
-- =====================================================================
-- Metodo: Energia total del lote / peso total del lote = MJ/kg
--         price_per_kg = ROUND(MJ/kg / 3.6)  (1 TQ = 1 kWh = 3.6 MJ)
--         price_per_unit = ROUND(price_per_kg * weight_kg)
--         Si price_per_unit < 1, redondear a 1 (precio minimo)

-- 1. Casabe: 1.2 kg yuca -> 6 tortas de ~100g (600g total)
--    Energia: yuca (3 x 1.2 = 3.6) + cocción 40 min budare (4) = 7.6 MJ
--    MJ/kg: 7.6/0.6 = 12.7 -> 3.5 kWh/kg -> price_per_kg = 4
--    weight_kg = 0.1, price_per_unit = 4 x 0.1 = 0.4 -> 1 TQ
UPDATE products SET
  weight_kg = 0.1,
  price_per_kg = 4,
  price_per_unit = 1,
  energy_direct = 2,
  energy_human = 1,
  energy_inputs = 1,
  energy_amortization = 0,
  description = 'Casabe artesanal de yuca amarga. Pan ancestral indigena: yuca rallada, prensada en sebucan, tostada en budare. Lote: 1.2 kg yuca -> 6 tortas de ~100g. Energia lote: yuca (3.6 MJ) + cocción 40 min (4 MJ) = 7.6 MJ. Por kg: 12.7 MJ/kg = 3.5 kWh/kg. Por unidad (100g): 1 TQ. Fuente: recetas tradicionales + LCA yuca. Documentado en Feria Conuquera (Flor de Tilo).'
WHERE name = 'Casabe Artesanal';

-- 2. Naiboa: 2 casabe (200g) + 50g papelon + 30g queso + anis -> 1 unidad ~280g
--    Energia: casabe (12.7 x 0.2 = 2.5) + papelon (15 x 0.05 = 0.75) + queso (10 x 0.03 = 0.3) + horneado 10 min (2) = 5.55 MJ
--    MJ/kg: 5.55/0.28 = 19.8 -> 5.5 kWh/kg -> price_per_kg = 6
--    weight_kg = 0.28, price_per_unit = 6 x 0.28 = 1.68 -> 2 TQ
UPDATE products SET
  weight_kg = 0.28,
  price_per_kg = 6,
  price_per_unit = 2,
  energy_direct = 3,
  energy_human = 1,
  energy_inputs = 2,
  energy_amortization = 0,
  description = 'Naiboa artesanal. Primer dulce netamente venezolano. Dos tortas de casabe rellenas con melado de papelon, queso blanco rallado y semillas de anis, horneadas. Lote: 2 casabe (200g) + 50g papelon + 30g queso -> 1 unidad 280g. Energia lote: 5.55 MJ. Por kg: 19.8 MJ/kg = 5.5 kWh/kg. Por unidad (280g): 2 TQ. Fuente: Wikipedia, EcuRed. Documentado en Feria Conuquera (Flor de Tilo).'
WHERE name = 'Naiboa Artesanal';

-- 3. Catalinas: 280g harina + 250g papelon + 100g mantequilla + 1 huevo -> 8 unidades ~88g (700g total)
--    Energia: harina (14 x 0.28 = 3.9) + papelon (15 x 0.25 = 3.75) + mantequilla (30 x 0.1 = 3) + huevo (1) + horneado 20 min (3) = 14.65 MJ
--    MJ/kg: 14.65/0.7 = 20.9 -> 5.8 kWh/kg -> price_per_kg = 6
--    weight_kg = 0.088, price_per_unit = 6 x 0.088 = 0.53 -> 1 TQ
UPDATE products SET
  weight_kg = 0.088,
  price_per_kg = 6,
  price_per_unit = 1,
  energy_direct = 3,
  energy_human = 1,
  energy_inputs = 2,
  energy_amortization = 0,
  description = 'Catalinas (paledonias/cucas negras). Galletas dulces especiadas. Lote: 280g harina + 250g papelon + 100g mantequilla + 1 huevo -> 8 unidades de ~88g. Energia lote: 14.65 MJ. Por kg: 20.9 MJ/kg = 5.8 kWh/kg. Por unidad (88g): 1 TQ. Fuente: recetas tradicionales. Documentado en Feria Conuquera (Flor de Tilo).'
WHERE name = 'Catalinas Artesanales';

-- 4. Besito de coco: 200g coco + 300g harina + 200g papelon + 2 huevos -> 20 unidades ~37g (750g total)
--    Energia: coco (6 x 0.2 = 1.2) + harina (14 x 0.3 = 4.2) + papelon (15 x 0.2 = 3) + huevos (2) + horneado 25 min (3) = 13.4 MJ
--    MJ/kg: 13.4/0.75 = 17.9 -> 5 kWh/kg -> price_per_kg = 5
--    weight_kg = 0.037, price_per_unit = 5 x 0.037 = 0.19 -> 1 TQ
UPDATE products SET
  weight_kg = 0.037,
  price_per_kg = 5,
  price_per_unit = 1,
  energy_direct = 2,
  energy_human = 1,
  energy_inputs = 2,
  energy_amortization = 0,
  description = 'Besito de coco artesanal. Dulce tradicional caribeno. Lote: 200g coco + 300g harina + 200g papelon + 2 huevos -> 20 unidades de ~37g. Energia lote: 13.4 MJ. Por kg: 17.9 MJ/kg = 5 kWh/kg. Por unidad (37g): 1 TQ. Fuente: chefspencil.com, 196flavors.com. Documentado en Feria Conuquera.'
WHERE name = 'Besito de Coco Artesanal';

-- 5. Cafunga: 500g cambur + 200g papelon + 100g coco + especias -> 5 unidades ~160g (800g total)
--    Energia: cambur (1.8 x 0.5 = 0.9) + papelon (15 x 0.2 = 3) + coco (6 x 0.1 = 0.6) + cocción 1h (4) = 8.5 MJ
--    MJ/kg: 8.5/0.8 = 10.6 -> 2.9 kWh/kg -> price_per_kg = 3
--    weight_kg = 0.16, price_per_unit = 3 x 0.16 = 0.48 -> 1 TQ
UPDATE products SET
  weight_kg = 0.16,
  price_per_kg = 3,
  price_per_unit = 1,
  energy_direct = 1,
  energy_human = 1,
  energy_inputs = 1,
  energy_amortization = 0,
  description = 'Cafunga de Barlovento. Dulce afrovenezolano ancestral. Lote: 500g cambur + 200g papelon + 100g coco -> 5 unidades de ~160g. Energia lote: 8.5 MJ. Por kg: 10.6 MJ/kg = 2.9 kWh/kg. Por unidad (160g): 1 TQ. Productora: Estilita Ruiz. Fuente: Blog oficial Feria Conuquera, Haiman El Troudi.'
WHERE name = 'Cafunga de Barlovento';

-- 6. Pan artesanal: 600g harina + 400g agua -> 1 hogaza ~800g
--    Energia: harina (14 x 0.6 = 8.4) + horneado 45 min 230°C (7) = 15.4 MJ
--    MJ/kg: 15.4/0.8 = 19.3 -> 5.4 kWh/kg -> price_per_kg = 5
--    unit = kg, weight_kg = 1, price_per_unit = 5
UPDATE products SET
  weight_kg = 1,
  price_per_kg = 5,
  price_per_unit = 5,
  energy_direct = 2,
  energy_human = 1,
  energy_inputs = 2,
  energy_amortization = 0,
  description = 'Pan artesanal de masa madre. Fermentacion natural 24h, horneado en horno artesanal. Lote: 600g harina + 400g agua -> 1 hogaza 800g. Energia lote: 15.4 MJ. Por kg: 19.3 MJ/kg = 5.4 kWh/kg. Precio: 5 TQ/kg. Fuente: LCA pan artesanal. Documentado en Feria Conuquera (Flor de Tilo).'
WHERE name = 'Pan Artesanal de Masa Madre';

-- 7. Arepa de auyama: 200g harina maiz + 100g auyama + agua -> 6 arepas ~100g (600g total)
--    Energia: harina (14 x 0.2 = 2.8) + auyama (3 x 0.1 = 0.3) + cocción 20 min budare (2) = 5.1 MJ
--    MJ/kg: 5.1/0.6 = 8.5 -> 2.4 kWh/kg -> price_per_kg = 2
--    weight_kg = 0.1, price_per_unit = 2 x 0.1 = 0.2 -> 1 TQ
UPDATE products SET
  weight_kg = 0.1,
  price_per_kg = 2,
  price_per_unit = 1,
  energy_direct = 1,
  energy_human = 1,
  energy_inputs = 1,
  energy_amortization = 0,
  description = 'Arepa de auyama artesanal. Lote: 200g harina + 100g auyama -> 6 arepas de ~100g. Energia lote: 5.1 MJ. Por kg: 8.5 MJ/kg = 2.4 kWh/kg. Por unidad (100g): 1 TQ. Fuente: recetas tradicionales. Documentado en Feria Conuquera.'
WHERE name = 'Arepa de Auyama Artesanal';

-- 8. Arepa de platano: igual estructura que auyama
UPDATE products SET
  weight_kg = 0.1,
  price_per_kg = 2,
  price_per_unit = 1,
  energy_direct = 1,
  energy_human = 1,
  energy_inputs = 1,
  energy_amortization = 0,
  description = 'Arepa de platano artesanal. Lote: 200g harina + 100g platano -> 6 arepas de ~100g. Energia lote: 5 MJ. Por kg: 8.3 MJ/kg = 2.3 kWh/kg. Por unidad (100g): 1 TQ. Fuente: recetas tradicionales + Lombriz Roja Urbana. Documentado en Feria Conuquera.'
WHERE name = 'Arepa de Platano Artesanal';

-- 9. Torta de platano: 500g platano + 100g papelon + especias -> 4 porciones ~150g (600g total)
--    Energia: platano (2 x 0.5 = 1) + papelon (15 x 0.1 = 1.5) + horneado 30 min (3) = 5.5 MJ
--    MJ/kg: 5.5/0.6 = 9.2 -> 2.6 kWh/kg -> price_per_kg = 3
--    weight_kg = 0.15, price_per_unit = 3 x 0.15 = 0.45 -> 1 TQ
UPDATE products SET
  weight_kg = 0.15,
  price_per_kg = 3,
  price_per_unit = 1,
  energy_direct = 1,
  energy_human = 1,
  energy_inputs = 1,
  energy_amortization = 0,
  description = 'Torta de platano artesanal. Lote: 500g platano + 100g papelon -> 4 porciones de ~150g. Energia lote: 5.5 MJ. Por kg: 9.2 MJ/kg = 2.6 kWh/kg. Por porcion (150g): 1 TQ. Fuente: Prensa Rural. Documentado en Feria Conuquera.'
WHERE name = 'Torta de Platano Artesanal';

-- 10. Papelon con limon: 200g papelon + 1L agua + 2 limones -> 1L
--     Energia: papelon (15 x 0.2 = 3) + limon (3 x 0.1 = 0.3) + disolucion 20 min (1) = 4.3 MJ
--     MJ/L: 4.3 -> 1.2 kWh/L -> price_per_kg = 1
UPDATE products SET
  weight_kg = 1,
  price_per_kg = 1,
  price_per_unit = 1,
  energy_direct = 1,
  energy_human = 0,
  energy_inputs = 1,
  energy_amortization = 0,
  description = 'Papelon con limon (aguapanela). Lote: 200g papelon + 1L agua + 2 limones -> 1L. Energia lote: 4.3 MJ. Por L: 1.2 kWh/L = 1 TQ/L. Fuente: recetas tradicionales + Wikipedia. Documentado en Feria Conuquera.'
WHERE name = 'Papelon con Limon';

-- 11-13. Bebidas fermentadas (aguamiel, hidromiel, cocomiel) - precios ya correctos en 1 TQ/L
-- Solo actualizar descripciones con metodo de calculo

UPDATE products SET
  description = 'Aguamiel. Lote: 150g miel + 1L agua -> 1L. Energia: miel (0.53 MJ) + fermentacion espontanea (0) = 0.53 MJ/L = 0.15 kWh/L. Precio minimo: 1 TQ/L. Fuente: todohidromiel.com. Documentado en Feria Conuquera (Lechivita).'
WHERE name = 'Aguamiel';

UPDATE products SET
  description = 'Hidromiel (vino de miel). Lote: 300g miel + 2L agua + levadura -> 2L. Energia: miel (1.05 MJ) + levadura (0.1) = 1.15 MJ / 2L = 0.58 MJ/L = 0.16 kWh/L. Precio minimo: 1 TQ/L. Fermentacion 2-4 semanas. Fuente: todohidromiel.com, FAUBA. Documentado en Feria Conuquera (Lechivita).'
WHERE name = 'Hidromiel (Vino de Miel)';

UPDATE products SET
  description = 'Cocomiel. Lote: 200g miel + 100g coco + 1L agua -> 1L. Energia: miel (0.7) + coco (0.6) + cocción (1.5) = 2.8 MJ/L = 0.8 kWh/L. Precio: 1 TQ/L. Fuente: Ultimas Noticias. Documentado en Feria Conuquera (Lechivita).'
WHERE name = 'Cocomiel';

-- 14-15. Harinas (yuca, cambur) - precios ya correctos en 3 TQ/kg
UPDATE products SET
  description = 'Harina de yuca artesanal. Lote: 2.5 kg yuca -> 1 kg harina (rendimiento 40%). Energia: yuca (7.5 MJ) + secado (3) + molienda (1) = 11.5 MJ/kg = 3.2 kWh/kg. Precio: 3 TQ/kg. Fuente: LCA cassava flour Nigeria, CIAT. Documentado en Feria Conuquera (Luis Angel Leisiaga).'
WHERE name = 'Harina de Yuca Artesanal';

UPDATE products SET
  description = 'Harina de cambur artesanal. Lote: 5 kg cambur verde -> 1 kg harina (rendimiento 20%). Energia: cambur (9 MJ) + secado (2) + molienda (1) = 12 MJ/kg = 3.3 kWh/kg. Precio: 3 TQ/kg. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).'
WHERE name = 'Harina de Cambur Artesanal';

-- 16. Jabon: Lote 500g aceite -> 5-6 barras de 90g (~500g total)
--     Energia: LCA WCO soap 8 MJ/kg + proceso (2) = 10 MJ/kg = 2.8 kWh/kg -> price_per_kg = 3
--     weight_kg = 0.09, price_per_unit = 3 x 0.09 = 0.27 -> 1 TQ
UPDATE products SET
  weight_kg = 0.09,
  price_per_kg = 3,
  price_per_unit = 1,
  energy_direct = 1,
  energy_human = 1,
  energy_inputs = 1,
  energy_amortization = 0,
  description = 'Jabon artesanal de aceite reciclado. Saponificacion en frio. Lote: 500g aceite -> 5-6 barras de 90g. Energia: LCA WCO soap 10 MJ/kg = 2.8 kWh/kg. Por barra (90g): 1 TQ. Curado 4-6 semanas. Fuente: Springer LCA, MDPI Sustainability. Documentado en Feria Conuquera (Territorio K-ribe).'
WHERE name = 'Jabon Artesanal de Aceite Reciclado';

-- 17. Desodorante: Lote 150g ingredientes -> 3 barras de 50g
--     Energia: ingredientes (8 x 0.15 = 1.2) + mezclado (0.5) = 1.7 MJ / 0.15 kg = 11.3 MJ/kg = 3.1 kWh/kg -> price_per_kg = 3
--     weight_kg = 0.05, price_per_unit = 3 x 0.05 = 0.15 -> 1 TQ
UPDATE products SET
  weight_kg = 0.05,
  price_per_kg = 3,
  price_per_unit = 1,
  energy_direct = 1,
  energy_human = 1,
  energy_inputs = 1,
  energy_amortization = 0,
  description = 'Desodorante natural artesanal. Lote: 150g ingredientes -> 3 barras de 50g. Energia: 11.3 MJ/kg = 3.1 kWh/kg. Por barra (50g): 1 TQ. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Territorio K-ribe).'
WHERE name = 'Desodorante Natural Artesanal';

-- 18-22. Insumos agroecologicos - precios ya correctos en 1 TQ
-- Solo actualizar descripciones

UPDATE products SET
  description = 'Humus de lombriz solido. Vermicompostaje con Eisenia foetida, 2-3 meses. Energia: LCA vermicompostaje 2 MJ/kg = 0.6 kWh/kg. Precio minimo: 1 TQ/kg. Fuente: MDPI, scielo.org.mx. Documentado en Feria Conuquera (Lombriz Roja Urbana).'
WHERE name = 'Humus de Lombriz Solido';

UPDATE products SET
  description = 'Humus de lombriz liquido (lixiviado). Energia: 1 MJ/L = 0.3 kWh/L. Precio minimo: 1 TQ/L. Presentaciones: 500cc, 1000cc, 1500cc. Fuente: Lombriz Roja Urbana. Documentado en Feria Conuquera.'
WHERE name = 'Humus de Lombriz Liquido';

UPDATE products SET
  description = 'Pie de cria de lombriz roja californiana (Eisenia foetida). Energia: 3 MJ/kg = 0.8 kWh/kg. Precio minimo: 1 TQ/kg. Presentaciones: 300g, 400g, 1.5kg, 2kg. Fuente: Lombriz Roja Urbana. Documentado en Feria Conuquera.'
WHERE name = 'Pie de Cria de Lombriz Roja Californiana';

UPDATE products SET
  description = 'Compost maduro artesanal. Compostaje 2-6 meses. Energia: LCA compostaje 1.5 MJ/kg = 0.4 kWh/kg. Precio minimo: 1 TQ/kg. Fuente: MDPI. Documentado en Feria Conuquera.'
WHERE name = 'Compost Maduro Artesanal';

UPDATE products SET
  description = 'Microorganismos de montana (MM). Fermentacion de lactobacilos y levaduras con melaza. Energia: 2 MJ/L = 0.6 kWh/L. Precio minimo: 1 TQ/L. Fuente: Lombriz Roja Urbana. Documentado en Feria Conuquera.'
WHERE name = 'Microorganismos de Montana';

-- 23. Croquetas de soya: Lote 200g soya + 50g harina -> 10 croquetas ~25g (250g total)
--     Energia: soya (15 x 0.2 = 3) + harina (14 x 0.05 = 0.7) + cocción 15 min (2) = 5.7 MJ
--     MJ/kg: 5.7/0.25 = 22.8 -> 6.3 kWh/kg -> price_per_kg = 6
--     weight_kg = 0.025, price_per_unit = 6 x 0.025 = 0.15 -> 1 TQ
UPDATE products SET
  weight_kg = 0.025,
  price_per_kg = 6,
  price_per_unit = 1,
  energy_direct = 2,
  energy_human = 1,
  energy_inputs = 2,
  energy_amortization = 0,
  description = 'Croquetas de soya artesanales. Lote: 200g soya + 50g harina -> 10 croquetas de ~25g. Energia lote: 5.7 MJ. Por kg: 22.8 MJ/kg = 6.3 kWh/kg. Por unidad (25g): 1 TQ. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).'
WHERE name = 'Croquetas de Soya Artesanales';

-- 24. Torticas veganas: Lote 200g harina + 100g vegetales -> 10 torticas ~30g (300g total)
--     Energia: harina (14 x 0.2 = 2.8) + vegetales (3 x 0.1 = 0.3) + horneado 20 min (2) = 5.1 MJ
--     MJ/kg: 5.1/0.3 = 17 -> 4.7 kWh/kg -> price_per_kg = 5
--     weight_kg = 0.03, price_per_unit = 5 x 0.03 = 0.15 -> 1 TQ
UPDATE products SET
  weight_kg = 0.03,
  price_per_kg = 5,
  price_per_unit = 1,
  energy_direct = 2,
  energy_human = 1,
  energy_inputs = 2,
  energy_amortization = 0,
  description = 'Torticas veganas artesanales. Lote: 200g harina + 100g vegetales -> 10 torticas de ~30g. Energia lote: 5.1 MJ. Por kg: 17 MJ/kg = 4.7 kWh/kg. Por unidad (30g): 1 TQ. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).'
WHERE name = 'Torticas Veganas Artesanales';

-- 25. Chimichurri de mango: Lote 300g mango + 100g vinagre -> 1 frasco ~250g
--     Energia: mango (3 x 0.3 = 0.9) + vinagre (10 x 0.1 = 1) + cocción 30 min (2) = 3.9 MJ
--     MJ/kg: 3.9/0.25 = 15.6 -> 4.3 kWh/kg -> price_per_kg = 4
--     weight_kg = 0.25, price_per_unit = 4 x 0.25 = 1 -> 1 TQ
UPDATE products SET
  weight_kg = 0.25,
  price_per_kg = 4,
  price_per_unit = 1,
  energy_direct = 1,
  energy_human = 1,
  energy_inputs = 2,
  energy_amortization = 0,
  description = 'Chimichurri de mango artesanal. Lote: 300g mango + 100g vinagre -> 1 frasco 250g. Energia lote: 3.9 MJ. Por kg: 15.6 MJ/kg = 4.3 kWh/kg. Por frasco (250g): 1 TQ. Fuente: Desde La Plaza. Documentado en Feria Conuquera (Luis Angel Leisiaga).'
WHERE name = 'Chimichurri de Mango Artesanal';

-- 26-27. Plantas y semillas - precios ya correctos en 1 TQ
UPDATE products SET
  description = 'Plantas medicinales vivas en maceta. Energia: tierra + semilla/estaca + riego + manejo 2-6 meses = 3.6 MJ/maceta = 1 kWh. Precio: 1 TQ/maceta. Fuente: Blog oficial Feria Conuquera. Documentado en Feria Conuquera (Dokobaka, Madre Selva).'
WHERE name = 'Plantas Medicinales (Maceta)';

UPDATE products SET
  description = 'Semillas criollas y ancestrales. Energia: cosecha + secado + seleccion + almacenamiento = 3.6 MJ/sobre = 1 kWh. Precio: 1 TQ/sobre. 30 especies de leguminosas ancestrales. Fuente: Blog oficial, Diario VEA. Documentado en Feria Conuquera.'
WHERE name = 'Semillas Criollas Ancestrales';

-- =====================================================================
-- PARTE 2: AGREGAR PRODUCTOS COMPUESTOS PENDIENTES CON PRECIO 0
-- =====================================================================
-- Estos productos se agregan como is_composite = true con precio 0.
-- Los ingredientes se agregan a product_compositions con quantity = 0
-- para que el precio calculado sea 0.
-- La persona despues edita el producto compuesto, agrega las cantidades
-- correctas de cada ingrediente, y el sistema calcula el precio automaticamente.

-- Funcion helper: insertar producto compuesto y sus componentes
-- Para cada producto:
-- 1. INSERT INTO products con is_composite=true, price=0
-- 2. INSERT INTO product_compositions con quantity=0 para cada ingrediente

-- === PASTELITOS DE VEGETALES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Pastelitos de Vegetales Artesanales', 'Alimentacion', 'Gastronomia Artesanal', 'Fritos', 'internal', 'unidad',
'Pastelitos de vegetales artesanales. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: harina de trigo, auyama, caraota, queso, aceite para fritura. Precio: 0 TQ (sin definir - editar componente). Documentado en Feria Conuquera.',
'Hecho en Casa', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pastelitos de Vegetales Artesanales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', 'Harina de Trigo', 'kg', 0, 0, 0, 'materia_prima', 0
FROM products p
WHERE p.name = 'Pastelitos de Vegetales Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = 'Harina de Trigo');

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', 'Auyama', 'kg', 0, 0, 0, 'materia_prima', 1
FROM products p
WHERE p.name = 'Pastelitos de Vegetales Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = 'Auyama');

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', 'Caraota', 'kg', 0, 0, 0, 'materia_prima', 2
FROM products p
WHERE p.name = 'Pastelitos de Vegetales Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = 'Caraota');

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', 'Queso Blanco', 'kg', 0, 0, 0, 'materia_prima', 3
FROM products p
WHERE p.name = 'Pastelitos de Vegetales Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = 'Queso Blanco');

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', 'Aceite Vegetal', 'L', 0, 0, 0, 'materia_prima', 4
FROM products p
WHERE p.name = 'Pastelitos de Vegetales Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = 'Aceite Vegetal');

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', 'Trabajo Humano (horas)', 'hora', 0, 0, 0, 'trabajo', 5
FROM products p
WHERE p.name = 'Pastelitos de Vegetales Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = 'Trabajo Humano (horas)');

-- === AJIACO ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Ajiaco Artesanal', 'Alimentacion', 'Gastronomia Artesanal', 'Platos Preparados', 'internal', 'porcion',
'Ajiaco artesanal. Plato tradicional tachirense. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: carne, tuberculos, vegetales, especias. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera (conuquero tachirense, 40 anos de experiencia).',
'Hecho en Casa', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ajiaco Artesanal' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Carne de Res', 'kg', 0),
  ('Yuca', 'kg', 1),
  ('Name', 'kg', 2),
  ('Ocumo', 'kg', 3),
  ('Auyama', 'kg', 4),
  ('Maiz', 'kg', 5),
  ('Caraota', 'kg', 6),
  ('Especias', 'kg', 7),
  ('Agua', 'L', 8),
  ('Trabajo Humano (horas)', 'hora', 9)
) AS c(name, unit, order)
WHERE p.name = 'Ajiaco Artesanal'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === HAMBURGUESAS VEGETARIANAS ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Hamburguesas Vegetarianas Artesanales', 'Alimentacion', 'Gastronomia Artesanal', 'Vegetariano', 'internal', 'unidad',
'Hamburguesas vegetarianas artesanales. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: granos, vegetales, condimentos, harina. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Vegetariano', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Hamburguesas Vegetarianas Artesanales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Granos (Caraota/Frijol)', 'kg', 0),
  ('Vegetales', 'kg', 1),
  ('Harina de Trigo', 'kg', 2),
  ('Condimentos', 'kg', 3),
  ('Aceite Vegetal', 'L', 4),
  ('Trabajo Humano (horas)', 'hora', 5)
) AS c(name, unit, order)
WHERE p.name = 'Hamburguesas Vegetarianas Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === TACOS DE GRANOS ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Tacos de Granos Artesanales', 'Alimentacion', 'Gastronomia Artesanal', 'Vegetariano', 'internal', 'unidad',
'Tacos de granos artesanales con encurtidos y chimichurri de mango. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: granos, tortilla, encurtidos, chimichurri de mango. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera (Luis Angel Leisiaga).',
'Vegetariano', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tacos de Granos Artesanales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Granos (Caraota/Frijol)', 'kg', 0),
  ('Harina de Maiz', 'kg', 1),
  ('Encurtidos', 'kg', 2),
  ('Chimichurri de Mango', 'frasco', 3),
  ('Trabajo Humano (horas)', 'hora', 4)
) AS c(name, unit, order)
WHERE p.name = 'Tacos de Granos Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === CHICHAS ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Chichas Artesanales', 'Alimentacion', 'Bebidas', 'Bebidas Naturales', 'internal', 'L',
'Chichas artesanales. Bebida fermentada tradicional. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: cereales (arroz/maiz), papelon, especias. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Hecho en Casa', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'L', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Chichas Artesanales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Arroz', 'kg', 0),
  ('Maiz', 'kg', 1),
  ('Papelon', 'kg', 2),
  ('Especias', 'kg', 3),
  ('Agua', 'L', 4),
  ('Trabajo Humano (horas)', 'hora', 5)
) AS c(name, unit, order)
WHERE p.name = 'Chichas Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === HARINA BUEN PAN ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Harina Buen Pan', 'Alimentacion', 'Gastronomia Artesanal', 'Harinas Alternativas', 'internal', 'kg',
'Harina "Buen Pan" para panaderia. Mezcla propietaria de Luis Angel Leisiaga. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Sin gluten, sin aditivos, sin conservantes. Apta para panquecas, ponques, galletas, brownies, pies, alfajores, bizcochos, waffles. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera (Luis Angel Leisiaga).',
'De Conuco', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Harina Buen Pan' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Harina de Yuca', 'kg', 0),
  ('Harina de Cambur', 'kg', 1),
  ('Harina de Trigo', 'kg', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Harina Buen Pan'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === FRUTOS DESHIDRATADOS ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Frutos Deshidratados Artesanales', 'Alimentacion', 'Gastronomia Artesanal', 'Deshidratados', 'internal', 'kg',
'Frutos deshidratados artesanales. Secado solar o electrico. PRODUCTO COMPUESTO - editar para agregar frutas y cantidades correctas. Frutas estimadas: mango, cambur, papaya, guayaba. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'De Conuco', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Frutos Deshidratados Artesanales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Mango', 'kg', 0),
  ('Cambur', 'kg', 1),
  ('Papaya', 'kg', 2),
  ('Guayaba', 'kg', 3),
  ('Trabajo Humano (horas)', 'hora', 4)
) AS c(name, unit, order)
WHERE p.name = 'Frutos Deshidratados Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === ENCURTIDOS ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Encurtidos Artesanales', 'Alimentacion', 'Condimentos', 'Encurtidos', 'internal', 'frasco',
'Encurtidos artesanales. Fermentacion de vegetales en vinagre. PRODUCTO COMPUESTO - editar para agregar vegetales y cantidades correctas. Ingredientes estimados: vegetales, vinagre, sal, especias. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera (Luis Angel Leisiaga).',
'Hecho en Casa', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Encurtidos Artesanales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Vegetales (Cebolla/Zanahoria/Pimenton)', 'kg', 0),
  ('Vinagre', 'L', 1),
  ('Sal', 'kg', 2),
  ('Especias', 'kg', 3),
  ('Trabajo Humano (horas)', 'hora', 4)
) AS c(name, unit, order)
WHERE p.name = 'Encurtidos Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === INFUSIONES NATURALES MEZCLADAS ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Infusiones Naturales Mezcladas', 'Alimentacion', 'Bebidas', 'Infusiones', 'internal', 'caja',
'Infusiones naturales mezcladas. Secado y mezclado de hierbas. PRODUCTO COMPUESTO - editar para agregar hierbas y cantidades correctas. Hierbas estimadas: moringa, toronjil, manzanilla, malojillo, jengibre. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera (SanaTe).',
'Botica Natural', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Infusiones Naturales Mezcladas' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Moringa', 'kg', 0),
  ('Toronjil', 'kg', 1),
  ('Manzanilla', 'kg', 2),
  ('Malojillo', 'kg', 3),
  ('Jengibre', 'kg', 4),
  ('Curcuma', 'kg', 5),
  ('Trabajo Humano (horas)', 'hora', 6)
) AS c(name, unit, order)
WHERE p.name = 'Infusiones Naturales Mezcladas'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === VINOS ARTESANALES DE FRUTAS ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Vinos Artesanales de Frutas', 'Alimentacion', 'Bebidas', 'Fermentados', 'internal', 'L',
'Vinos artesanales de frutas. Fermentacion 2-4 semanas. PRODUCTO COMPUESTO - editar para agregar frutas y cantidades correctas. Ingredientes estimados: frutas, papelon/azucar, levadura, agua. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'De Conuco', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'L', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Vinos Artesanales de Frutas' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Frutas', 'kg', 0),
  ('Papelon', 'kg', 1),
  ('Levadura', 'g', 2),
  ('Agua', 'L', 3),
  ('Trabajo Humano (horas)', 'hora', 4)
) AS c(name, unit, order)
WHERE p.name = 'Vinos Artesanales de Frutas'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === LICORES ARTESANALES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Licores Artesanales', 'Alimentacion', 'Bebidas', 'Fermentados', 'internal', 'L',
'Licores artesanales. Infusion o destilacion. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: base alcoholica, frutas, especias. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'De Conuco', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'L', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Licores Artesanales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Base Alcoholica', 'L', 0),
  ('Frutas', 'kg', 1),
  ('Especias', 'kg', 2),
  ('Papelon', 'kg', 3),
  ('Trabajo Humano (horas)', 'hora', 4)
) AS c(name, unit, order)
WHERE p.name = 'Licores Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === ACEITE DE COCO COSMETICO ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Aceite de Coco Cosmetico', 'Salud y Medicina', 'Higiene Natural', 'Cosmetica', 'internal', 'frasco',
'Aceite de coco cosmetico artesanal. Prensado en frio. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingrediente: coco. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Limpieza Natural', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Aceite de Coco Cosmetico' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Coco', 'unidad', 0),
  ('Trabajo Humano (horas)', 'hora', 1)
) AS c(name, unit, order)
WHERE p.name = 'Aceite de Coco Cosmetico'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === ARCILLA PARA LA PIEL ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Arcilla para la Piel', 'Salud y Medicina', 'Higiene Natural', 'Cosmetica', 'internal', 'frasco',
'Arcilla mineral para mascarillas faciales. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingrediente: arcilla mineral. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Limpieza Natural', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Arcilla para la Piel' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Arcilla Mineral', 'kg', 0),
  ('Trabajo Humano (horas)', 'hora', 1)
) AS c(name, unit, order)
WHERE p.name = 'Arcilla para la Piel'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === CREMAS Y EMULSIONES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cremas y Emulsiones Naturales', 'Salud y Medicina', 'Higiene Natural', 'Cosmetica', 'internal', 'frasco',
'Cremas y emulsiones naturales artesanales. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: aceites vegetales, agua, cera, aceites esenciales. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Limpieza Natural', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cremas y Emulsiones Naturales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Aceite de Coco', 'L', 0),
  ('Cera de Abejas', 'kg', 1),
  ('Aceites Esenciales', 'ml', 2),
  ('Agua', 'L', 3),
  ('Trabajo Humano (horas)', 'hora', 4)
) AS c(name, unit, order)
WHERE p.name = 'Cremas y Emulsiones Naturales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === MASCARILLAS FACIALES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Mascarillas Faciales Naturales', 'Salud y Medicina', 'Higiene Natural', 'Cosmetica', 'internal', 'frasco',
'Mascarillas faciales naturales artesanales. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: arcilla, aceites, extractos vegetales. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Limpieza Natural', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mascarillas Faciales Naturales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Arcilla Mineral', 'kg', 0),
  ('Aceite de Coco', 'L', 1),
  ('Extractos Vegetales', 'ml', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Mascarillas Faciales Naturales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === LABIALES NATURALES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Labiales Naturales', 'Salud y Medicina', 'Higiene Natural', 'Cosmetica', 'internal', 'unidad',
'Labiales naturales artesanales. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: cera, aceites, colorantes naturales (onoto). Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Limpieza Natural', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Labiales Naturales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Cera de Abejas', 'kg', 0),
  ('Aceite de Coco', 'L', 1),
  ('Onoto (colorante natural)', 'kg', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Labiales Naturales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === BALSAMOS Y TINTURAS ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Balsamos y Tinturas Naturales', 'Salud y Medicina', 'Higiene Natural', 'Cosmetica', 'internal', 'frasco',
'Balsamos y tinturas naturales artesanales. Maceracion de extractos vegetales. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: extractos vegetales, alcohol, aceites. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Limpieza Natural', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Balsamos y Tinturas Naturales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Extractos Vegetales', 'ml', 0),
  ('Alcohol', 'L', 1),
  ('Aceites Esenciales', 'ml', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Balsamos y Tinturas Naturales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === PLANTAS ORNAMENTALES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Plantas Ornamentales (Maceta)', 'Agricultura', 'Vivero', 'Ornamentales', 'internal', 'maceta',
'Plantas ornamentales vivas en maceta. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: tierra, semilla/estaca, maceta. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Agroecologico', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'unidad', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plantas Ornamentales (Maceta)' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Tierra Abonada', 'kg', 0),
  ('Semilla/Estaca', 'unidad', 1),
  ('Maceta', 'unidad', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Plantas Ornamentales (Maceta)'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === PLANTAS FRUTALES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Plantas Frutales (Maceta)', 'Agricultura', 'Vivero', 'Frutales', 'internal', 'maceta',
'Plantas frutales vivas en maceta. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: tierra, semilla/estaca, maceta. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Agroecologico', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'unidad', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Plantas Frutales (Maceta)' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Tierra Abonada', 'kg', 0),
  ('Semilla/Estaca', 'unidad', 1),
  ('Maceta', 'unidad', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Plantas Frutales (Maceta)'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === MATAS DE MORINGA ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Matas de Moringa', 'Agricultura', 'Vivero', 'Medicinales', 'internal', 'maceta',
'Matas de moringa (Moringa oleifera). PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: tierra, estaca/semilla, maceta. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Agroecologico', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'unidad', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Matas de Moringa' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Tierra Abonada', 'kg', 0),
  ('Estaca/Semilla de Moringa', 'unidad', 1),
  ('Maceta', 'unidad', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Matas de Moringa'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === MORINGA EN POLVO ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Moringa en Polvo', 'Alimentacion', 'Condimentos', 'Superfoods', 'internal', 'kg',
'Moringa en polvo. Hojas de moringa secadas y molidas. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingrediente: hojas de moringa. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera (SanaTe).',
'De Conuco', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Moringa en Polvo' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Hojas de Moringa', 'kg', 0),
  ('Trabajo Humano (horas)', 'hora', 1)
) AS c(name, unit, order)
WHERE p.name = 'Moringa en Polvo'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === GOTAS DE NIN ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Gotas de Nin', 'Salud y Medicina', 'Medicina Natural', 'Extractos', 'internal', 'frasco',
'Gotas de Nin. Extracto medicinal de la planta Nin (Justicia pectoralis). PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: extracto de nin, alcohol, agua. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera (SanaTe).',
'Botica Natural', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'ml', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Gotas de Nin' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Extracto de Nin (Justicia pectoralis)', 'ml', 0),
  ('Alcohol', 'ml', 1),
  ('Agua', 'ml', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Gotas de Nin'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === BIOFERTILIZANTES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Biofertilizantes Artesanales', 'Agricultura', 'Insumos Agroecologicos', 'Bioinsumos', 'internal', 'L',
'Biofertilizantes artesanales. Fermentacion anaerobica. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: estiercol, melaza, minerales, microorganismos. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Agroecologico', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'L', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Biofertilizantes Artesanales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Estiercol', 'kg', 0),
  ('Melaza/Papelon', 'kg', 1),
  ('Minerales', 'kg', 2),
  ('Microorganismos de Montana', 'L', 3),
  ('Agua', 'L', 4),
  ('Trabajo Humano (horas)', 'hora', 5)
) AS c(name, unit, order)
WHERE p.name = 'Biofertilizantes Artesanales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === CONTROLES BIOLOGICOS ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Controles Biologicos', 'Agricultura', 'Insumos Agroecologicos', 'Bioinsumos', 'internal', 'frasco',
'Controles biologicos artesanales. Hongos/bacterias beneficiosas para control de plagas. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Agroecologico', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'kg', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Controles Biologicos' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Hongos Beneficiosos', 'g', 0),
  ('Bacterias Beneficiosas', 'g', 1),
  ('Agua', 'L', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Controles Biologicos'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === CESTERIA ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Cesteria Artesanal', 'Artesania', 'Manualidades', 'Cesteria', 'internal', 'unidad',
'Cesteria artesanal. Tejido manual de fibras vegetales. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: fibras vegetales (mimbre, paja, bejuco). Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Artesanal', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'unidad', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cesteria Artesanal' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Fibras Vegetales (Mimbre/Paja/Bejuco)', 'kg', 0),
  ('Trabajo Humano (horas)', 'hora', 1)
) AS c(name, unit, order)
WHERE p.name = 'Cesteria Artesanal'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === HORNOS DE BARRO ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Horno de Barro Artesanal', 'Artesania', 'Construccion Artesanal', 'Hornos', 'internal', 'unidad',
'Horno de barro artesanal. Construccion manual. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: barro, arena, ladrillos. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Artesanal', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'unidad', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Horno de Barro Artesanal' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Barro/Arcilla', 'kg', 0),
  ('Arena', 'kg', 1),
  ('Ladrillos', 'unidad', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Horno de Barro Artesanal'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === LAMPARAS DE ACEITE RECICLADO ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Lampara de Aceite Reciclado', 'Artesania', 'Manualidades', 'Iluminacion', 'internal', 'unidad',
'Lampara de aceite reciclado artesanal. Ensamblaje manual. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: aceite reciclado, mecha, recipiente. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Reciclado', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'unidad', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lampara de Aceite Reciclado' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Aceite Reciclado', 'L', 0),
  ('Mecha', 'unidad', 1),
  ('Recipiente', 'unidad', 2),
  ('Trabajo Humano (horas)', 'hora', 3)
) AS c(name, unit, order)
WHERE p.name = 'Lampara de Aceite Reciclado'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === PANALES Y TOALLAS NO DESECHABLES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Panales y Toallas Higienicas de Tela', 'Artesania', 'Manualidades', 'Higiene Reutilizable', 'internal', 'set',
'Panales y toallas higienicas de tela no desechables. Costura artesanal. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: tela de algodon, botones/velcros. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Reutilizable', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'set', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Panales y Toallas Higienicas de Tela' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Tela de Algodon', 'm', 0),
  ('Botones/Velcros', 'unidad', 1),
  ('Trabajo Humano (horas)', 'hora', 2)
) AS c(name, unit, order)
WHERE p.name = 'Panales y Toallas Higienicas de Tela'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);

-- === PRODUCTOS DE LIMPIEZA NATURALES ===
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, is_composite, product_code, energy_direct, energy_human, energy_inputs, energy_amortization, price_per_kg, base_unit, weight_kg)
SELECT node_domain, 'Productos de Limpieza Naturales', 'Salud y Medicina', 'Higiene Natural', 'Limpieza', 'internal', 'L',
'Productos de limpieza naturales artesanales. Sin quimicos industriales. PRODUCTO COMPUESTO - editar para agregar ingredientes y cantidades correctas. Ingredientes estimados: vinagre, bicarbonato, aceites esenciales, jabon natural. Precio: 0 TQ (sin definir). Documentado en Feria Conuquera.',
'Limpieza Natural', '', 0, true, true, true, '', 0, 0, 0, 0, 0, 'L', 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Productos de Limpieza Naturales' AND node_domain = nd.node_domain);

INSERT INTO product_compositions (product_id, product_type, component_name, component_unit, component_price, quantity, subtotal, component_category, sort_order)
SELECT p.id, 'catalog', c.name, c.unit, 0, 0, 0, 'materia_prima', c.order
FROM products p
CROSS JOIN (VALUES
  ('Vinagre', 'L', 0),
  ('Bicarbonato de Sodio', 'kg', 1),
  ('Aceites Esenciales', 'ml', 2),
  ('Jabon Natural', 'unidad', 3),
  ('Agua', 'L', 4),
  ('Trabajo Humano (horas)', 'hora', 5)
) AS c(name, unit, order)
WHERE p.name = 'Productos de Limpieza Naturales'
AND NOT EXISTS (SELECT 1 FROM product_compositions pc WHERE pc.product_id = p.id AND pc.component_name = c.name);
