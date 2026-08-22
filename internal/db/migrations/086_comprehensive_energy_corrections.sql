-- Migracion 086: Correccion comprehensiva de valores de energia
--
-- Se revisaron TODOS los productos del catalogo comparando con bases de
-- datos internacionales (Agribalyse, FAO, Pimentel, Ecoinvent, ICE Database,
-- JRC Europa, estudios LCA de UK, EU, Iran, Albania, Canada, Nigeria).
--
-- PROBLEMAS ENCONTRADOS:
--
-- 1. Abonos Organicos: unidad "saco" pero precio 2 TQ (valor por kg).
--    Un saco de compost pesa ~25 kg. Energia real: 0.32 MJ/kg = 0.09 kWh/kg
--    (compost artesanal). Por saco: 0.09 x 25 = 2.25 kWh -> 2 TQ.
--    Resultado: el precio por saco era correcto por casualidad, pero la
--    descripcion decia "1.5-2 kWh/kg" lo cual es incorrecto. Corregir.
--
-- 2. Granos y cereales: valores demasiado altos.
--    Sistema: maiz 10 kWh/kg, arroz 11 kWh/kg, harina 10 kWh/kg
--    Realidad: maiz 1.9-4.9 MJ/kg = 0.5-1.4 kWh/kg (Albania, Canada, Iran)
--              arroz ~7 MJ/kg = 1.9 kWh/kg (Agribalyse)
--              trigo 3.9 MJ/kg = 1.1 kWh/kg (Piringer & Steinberg 2006)
--    Pero estos son valores farm-gate. En sistema de conuco con trabajo
--    manual y sin fertilizantes quimicos, la energia es mayor por menor
--    rendimiento. Usamos valores de conuco: ~2-3x mas que industrial.
--    Corregir a: maiz 3, arroz 4, harina 4 (era 10, 11, 10)
--
-- 3. Papelon/Panela: valor demasiado alto.
--    Sistema: 15 kWh/kg (53 MJ/kg)
--    Realidad: 4.8-5.2 MJ/kg (estudio NCS) a ~40 MJ/kg (tradicional con bagasse)
--    Produccion artesanal con lena: ~15 MJ/kg = 4 kWh/kg
--    Corregir a: 5 (era 15)
--
-- 4. Panaderia: valor razonable pero un poco alto.
--    Sistema: 5 kWh/kg (18 MJ/kg)
--    Realidad: 5.21 MJ/kg industrial, 9-33 MJ/kg EU (JRC)
--    Artesanal con horno a lena: ~10 MJ/kg = 3 kWh/kg
--    Corregir a: 4 (era 5)
--
-- 5. Cacao/Chocolate/Cafe: valor demasiado alto.
--    Sistema: 25 kWh/kg (80-90 MJ/kg)
--    Realidad: chocolate 91 MJ/kg (FOB UK), pero cacao fermentado artesanal
--    es mucho menor. Cafe tostado a lena: ~20-30 MJ/kg
--    Corregir a: 15 (era 25)
--
-- 6. Miel: valor razonable.
--    Sistema: 10 kWh/L (35 MJ/L)
--    Realidad: 23.8 MJ/kg (lavender honey, Turquia)
--    Corregir a: 7 (era 10)
--
-- 7. Aceites: valor razonable pero un poco alto.
--    Sistema: 10 kWh/L (35-40 MJ/L)
--    Realidad: aceite girasol ~20 MJ/L (refinado), coco ~15 MJ/L
--    Prensado en frio artesanal: ~15 MJ/L = 4 kWh/L
--    Corregir a: 6 (era 10)
--
-- 8. Especias: valor demasiado alto.
--    Sistema: 15 kWh/kg (53 MJ/kg)
--    Realidad: secado + molienda ~10-15 MJ/kg = 3-4 kWh/kg
--    Corregir a: 4 (era 15)
--
-- 9. Diesel: valor correcto (12 kWh/L = 41.7 MJ/L). No cambiar.
--
-- 10. Lena: valor correcto (4 kWh/kg = 15.3 MJ/kg). No cambiar.
--
-- 11. Carbon vegetal: valor razonable (6 kWh/kg). No cambiar.
--
-- 12. Productos frescos (verduras, frutas, tuberculos): valores correctos
--     para conuco local (1-2 kWh/kg). No cambiar.
--
-- 13. Leche: valor correcto (2 kWh/L). No cambiar.
--
-- 14. Productos lacteos: valor correcto (8 kWh/kg). No cambiar.
--
-- 15. Electronicos y electrodomesticos: valores correctos (ICE Database).
--     No cambiar.
--
-- 16. Materiales construccion: valores correctos (ICE Database). No cambiar.
--
-- 17. Textiles: valores correctos (Ecoinvent). No cambiar.
--
-- 18. Herramientas: valores correctos. No cambiar.
--
-- ADEMAS: Agregar campo price_per_kg para mostrar el precio por kilo
-- ademas del precio por unidad (docena, saco, litro, etc.)

-- Agregar columna price_per_kg a products (precio de referencia por kilo)
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC(12,2) DEFAULT 0;

-- === CORRECCIONES POR PRODUCTO ===

-- Granos basicos: maiz, cebada, avena, centeno
-- Realidad: 0.5-1.4 kWh/kg industrial, ~3 kWh/kg conuco
UPDATE products SET
  price_per_unit = 3, energy_inputs = 3,
  price_per_kg = 3,
  description = 'Maiz criollo blanco y amarillo, cebada, avena, centeno. Energia: ~10 MJ/kg = 3 kWh/kg (conuco: siembra manual, cosecha, secado). Industrial: 1.9-4.9 MJ/kg. Fuente: Agribalyse, Albania LCA, Canada LCA, Iran LCA.'
WHERE name IN ('Granos Basicos Criollos', 'Granos basicos (maiz, frijol) 1kg');

-- Arroz y legumbres
-- Realidad: arroz ~7 MJ/kg = 1.9 kWh/kg industrial, ~4 kWh/kg conuco
UPDATE products SET
  price_per_unit = 4, energy_inputs = 4,
  price_per_kg = 4,
  description = 'Arroz procesado, sorgo, legumbres (caraota, frijol, quinchoncho, lentejas, garbanzos, habas). Energia: ~14 MJ/kg = 4 kWh/kg (conuco). Industrial: 7 MJ/kg. Fuente: Agribalyse, Ecoinvent, FAO.'
WHERE name = 'Arroz y Legumbres';

-- Harinas
-- Realidad: trigo 3.9 MJ/kg + molienda ~2 MJ/kg = ~6 MJ/kg = 1.7 kWh/kg
-- Conuco: ~4 kWh/kg
UPDATE products SET
  price_per_unit = 4, energy_inputs = 4,
  price_per_kg = 4,
  description = 'Harina de maiz, trigo integral, yuca (casabe), platano, quinoa. Energia: ~14 MJ/kg = 4 kWh/kg (grano + molienda artesanal). Industrial: 6 MJ/kg. Fuente: Agribalyse, Piringer & Steinberg 2006.'
WHERE name IN ('Harinas Integrales', 'Harina de maiz 50kg');

-- Panaderia
-- Realidad: 5.21 MJ/kg industrial, 9-33 MJ/kg EU, artesanal lena ~10 MJ/kg
UPDATE products SET
  price_per_unit = 4, energy_direct = 4,
  price_per_kg = 4,
  description = 'Pan de maiz, trigo integral, arepas, cachapas, bollos, empanadas. Energia: ~14 MJ/kg = 4 kWh/kg (molienda + amasado + horneado artesanal). Industrial: 5.2 MJ/kg. Fuente: JRC Europa, Agribalyse, FOB UK.'
WHERE name = 'Panaderia y Masas Caseras';

-- Papelon y Panela
-- Realidad: 4.8-5.2 MJ/kg (NCS moderno), ~15 MJ/kg (tradicional con lena)
UPDATE products SET
  price_per_unit = 5, energy_direct = 5,
  price_per_kg = 5,
  description = 'Azucar, papelon, panela, rapadura, melaza de cana. Energia: ~18 MJ/kg = 5 kWh/kg (cultivo + coccion con lena). NCS moderno: 5 MJ/kg. Fuente: TechScience NCS study, LCA panela Ecuador.'
WHERE name IN ('Papelon y Panela', 'Azucar y Edulcorantes');

-- Aceites y Vinagres
-- Realidad: girasol ~20 MJ/L refinado, coco ~15 MJ/L, prensado frio ~15 MJ/L
UPDATE products SET
  price_per_unit = 6, energy_direct = 6,
  price_per_kg = 6,
  description = 'Aceite de coco, ajonjisi, palma, vinagre de cana. Energia: ~20 MJ/L = 6 kWh/L (prensado en frio + extraccion). Refinado industrial: 20-40 MJ/L. Fuente: Agribalyse, IOPscience coconut oil LCA, Sciencedirect sunflower oil LCA.'
WHERE name IN ('Aceites y Vinagres', 'Aceite Vegetal');

-- Dulces y Conservas
-- Realidad: ~10-15 MJ/kg (cocccion + conservacion artesanal)
UPDATE products SET
  price_per_unit = 5, energy_direct = 5,
  price_per_kg = 5,
  description = 'Dulce de lechosa, cabello de angel, jalea de guayaba, conservas de coco, bocadillo, encurtidos, salsas. Energia: ~18 MJ/kg = 5 kWh/kg (cocccion + conservacion). Fuente: Agribalyse.'
WHERE name IN ('Dulces y Conservas Tradicionales', 'La Tradicional Cafunga de Barlovento', 'Encurtidos y Salsas');

-- Cacao, Chocolate y Cafe
-- Realidad: chocolate 91 MJ/kg industrial, cacao artesanal ~20-30 MJ/kg
UPDATE products SET
  price_per_unit = 15, energy_direct = 15,
  price_per_kg = 15,
  description = 'Cacao fermentado de Barlovento/Chuao, chocolate bean-to-bar 70%, cafe lavado tostado a lena. Energia: ~54 MJ/kg = 15 kWh/kg (fermentacion + secado + torrefaccion artesanal). Chocolate industrial: 91 MJ/kg. Fuente: FOB UK, Agribalyse.'
WHERE name IN ('Cacao, Chocolate y Cafe', 'Cacao Puro, Chocolates y Cafe de Montana');

-- Miel
-- Realidad: 23.8 MJ/kg (lavender honey Turquia)
UPDATE products SET
  price_per_unit = 7, energy_inputs = 7,
  price_per_kg = 7,
  description = 'Miel multifleural de montana, bosque, azahar. Energia: ~25 MJ/kg = 7 kWh/kg (apicultura + extraccion + filtrado). Fuente: Energy balance lavender honey, Turquia.'
WHERE name IN ('Miel Pura de Abejas', 'Miel 1L');

-- Bebidas Fermentadas
-- Realidad: ~5-10 MJ/L (fermentacion natural)
UPDATE products SET
  price_per_unit = 3, energy_direct = 3,
  price_per_kg = 3,
  description = 'Chicha de maiz, guarapo de cana, vino de palma, pulque, kombucha. Energia: ~10 MJ/L = 3 kWh/L (fermentacion natural). Fuente: Agribalyse.'
WHERE name = 'Bebidas Fermentadas';

-- Especias y Condimentos
-- Realidad: secado + molienda ~10-15 MJ/kg = 3-4 kWh/kg
UPDATE products SET
  price_per_unit = 4, energy_direct = 4,
  price_per_kg = 4,
  description = 'Comino, oregano, pimienta, aji dulce/picante, onoto, cilantro seco, laurel. Energia: ~14 MJ/kg = 4 kWh/kg (secado + molienda). Fuente: Agribalyse.'
WHERE name = 'Especias y Condimentos';

-- Abonos Organicos (unidad: saco ~25 kg)
-- Realidad: compost 0.28-0.35 MJ/kg (industrial), 319 MJ/Mg = 0.32 MJ/kg (on-farm)
-- Por kg: 0.09 kWh/kg. Por saco 25 kg: 2.25 kWh -> 2 TQ
-- El precio por saco era correcto pero la descripcion era incorrecta
UPDATE products SET
  price_per_unit = 2, energy_inputs = 2,
  price_per_kg = 0,
  description = 'Compost maduro, humus de lombriz, estiercol curado, bokashi, gallinaza. Energia: ~0.3 MJ/kg = 0.09 kWh/kg (proceso de descomposicion controlada). Un saco de ~25 kg = ~2 kWh. Fuente: Nigeria organic fertilizer study, Italy on-farm compost LCA.'
WHERE name = 'Abonos Organicos';

-- Bioinsumos (unidad: litro)
-- Realidad: ~10 MJ/L = 3 kWh/L (fermentacion + ingredientes)
-- Valor correcto, no cambiar precio pero agregar price_per_kg
UPDATE products SET
  price_per_kg = 3,
  description = 'Biofertilizantes, biopreparados fungicos, te de compost, purines, microorganismos eficientes. Energia: ~10 MJ/L = 3 kWh/L (fermentacion + ingredientes). Fuente: Agribalyse.'
WHERE name = 'Bioinsumos y Preparados';

-- Fertilizantes Organicos (si existe como producto separado)
UPDATE products SET
  price_per_kg = 0,
  description = 'Fertilizantes organicos: compost, humus, estiercol curado. Energia: ~0.3 MJ/kg = 0.09 kWh/kg. Fuente: Nigeria organic fertilizer study, Italy on-farm compost LCA.'
WHERE name = 'Fertilizantes Organicos';

-- Hongos Comestibles
-- Realidad: ~133 MJ/ton compost = 0.13 MJ/kg compost, pero el huevo en si
-- tiene mas energia por el sustrato + climatizacion: ~5-8 MJ/kg
UPDATE products SET
  price_per_unit = 3, energy_inputs = 3,
  price_per_kg = 3,
  description = 'Hongos comestibles (champinones, setas, hongos ostra). Energia: ~10 MJ/kg = 3 kWh/kg (sustrato + climatizacion + cosecha). Fuente: Iran mushroom LCA.'
WHERE name = 'Hongos Comestibles';

-- Plaguicidas Naturales
-- Realidad: preparados botanicos ~5-10 MJ/L = 1.5-3 kWh/L
UPDATE products SET
  price_per_unit = 2, energy_inputs = 2,
  price_per_kg = 2,
  description = 'Plaguicidas naturales: extractos de neem, ajo, ajonjoli, repelentes botanicos. Energia: ~7 MJ/L = 2 kWh/L (extraccion + ingredientes). Fuente: Agribalyse.'
WHERE name = 'Plaguicidas Naturales';

-- === ACTUALIZAR price_per_kg PARA PRODUCTOS QUE YA ESTAN CORRECTOS ===

-- Productos frescos por kg (ya correctos)
UPDATE products SET price_per_kg = price_per_unit WHERE unit = 'kg' AND price_per_kg = 0;
UPDATE products SET price_per_kg = price_per_unit WHERE unit = 'litro' AND price_per_kg = 0;
UPDATE products SET price_per_kg = price_per_unit WHERE unit = 'L' AND price_per_kg = 0;

-- Huevos: precio por docena = 3 TQ, precio por kg = 4 TQ
-- (una docena pesa ~0.65 kg, energia por kg = 4.2 kWh)
UPDATE products SET price_per_kg = 4 WHERE name = 'Huevos Frescos';

-- Leche: precio por L = 2 TQ, precio por kg ~ 2 TQ (1L leche ~1.03 kg)
UPDATE products SET price_per_kg = 2 WHERE name = 'Leche Fresca';

-- === CANASTA BASICA: recalcular con valores corregidos ===
-- Granos: 3kg x 3 = 9 (era 30)
-- Verduras: 2kg x 2 = 4 (sin cambio)
-- Frutas: 1kg x 2 = 2 (sin cambio)
-- Pollo: 0.5kg x 5 = 2.5 (era 4)
-- Leche: 1L x 2 = 2 (sin cambio)
-- Aceite: 0.5L x 6 = 3 (era 5)
-- Papelon: 0.5kg x 5 = 2.5 (era 7.5)
-- Huevos: 1 docena x 3 = 3 (era 10)
-- Especias: ~1
-- Total: 9+4+2+2.5+2+3+2.5+3+1 = 29 TQ (era 66)
UPDATE products SET
  price_per_unit = 30,
  energy_direct = 0, energy_human = 0, energy_inputs = 30, energy_amortization = 0,
  description = 'Canasta semanal para familia de 4-5 personas. Contenido: 3kg granos basicos (maiz, frijol, arroz) = 9 TQ, 2kg verduras frescas = 4 TQ, 1kg frutas de temporada = 2 TQ, 0.5kg carne de pollo = 2.5 TQ, 1L leche fresca = 2 TQ, 0.5L aceite vegetal = 3 TQ, 0.5kg panela/azucar = 2.5 TQ, 1 docena huevos = 3 TQ, 100g especias = 1 TQ. Energia total: ~29 TQ. Precio redondeado: 30 TQ.'
WHERE name = 'Canasta Basica Familiar Semanal';
