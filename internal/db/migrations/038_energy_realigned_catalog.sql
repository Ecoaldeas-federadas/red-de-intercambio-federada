-- Migracion 038: Realineacion completa del catalogo con estandares internacionales
-- Basado en: ICE Database (Univ. Bath), Agribalyse (ADEME/INRAE), Ecoinvent, Pimentel
-- Estandar: 1 TQ = 1 kWh = 3.6 MJ (energia incorporada)
--
-- PASO 1: Actualizar tarifa energetica a valores reales
-- Trabajo manual agricola: 0.61 kWh/h (metabolico ~525 kcal/h)
-- Trabajo general/servicios: 1.0 kWh/h (basal + herramientas manuales)
-- Trabajo tecnico: 3.0 kWh/h (metabolico + herramientas electricas)
-- Formula: base = (vital_food + vital_water + vital_domestic + vital_services) / work_hours
-- base = 8 / 8 = 1.0 TQ/hora (trabajo general)
-- effort_agricultural = 0.61, effort_technical = 3.0

UPDATE energy_tariff SET
  vital_food = 3,
  vital_water = 1,
  vital_domestic = 2,
  vital_services = 2,
  work_hours_per_day = 8,
  work_days_per_month = 22,
  effort_admin = 1.0,
  effort_technical = 3.0,
  effort_agricultural = 0.61
WHERE node_domain = 'default';

-- Insertar tarifa actualizada para todos los nodos existentes que no tengan una
INSERT INTO energy_tariff (node_domain, vital_food, vital_water, vital_domestic, vital_services, work_hours_per_day, work_days_per_month, effort_admin, effort_technical, effort_agricultural)
SELECT DISTINCT node_domain, 3, 1, 2, 2, 8, 22, 1.0, 3.0, 0.61
FROM products
WHERE node_domain IS NOT NULL
  AND node_domain != 'default'
  AND node_domain NOT IN (SELECT node_domain FROM energy_tariff)
ON CONFLICT (node_domain) DO NOTHING;

-- Actualizar tarifas de nodos existentes
UPDATE energy_tariff SET
  vital_food = 3,
  vital_water = 1,
  vital_domestic = 2,
  vital_services = 2,
  work_hours_per_day = 8,
  work_days_per_month = 22,
  effort_admin = 1.0,
  effort_technical = 3.0,
  effort_agricultural = 0.61
WHERE node_domain IN (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL AND node_domain != 'default');

-- PASO 2: Actualizar precios de TODOS los productos existentes a valores reales
-- (1 TQ = 1 kWh = 3.6 MJ, segun bases de datos internacionales)

-- === TRABAJO Y SERVICIOS ===
UPDATE products SET price_per_unit = 1, energy_human = 1, description = 'Siembra, cosecha, limpieza, riego, desmalece. Consumo metabolico ~525 kcal/h = 0.61 kWh.'
WHERE name IN ('Jornal Agricola', 'Hora de labor agricola', 'Hora de Trabajo Agricola');

UPDATE products SET price_per_unit = 1, energy_human = 1, description = 'Limpieza, organizacion, atencion al publico, gestion. Metabolismo basal + herramientas manuales.'
WHERE name IN ('Limpieza de Espacios', 'Trabajo Administrativo y Gestion', 'Hora de Trabajo General');

UPDATE products SET price_per_unit = 3, energy_human = 3, description = 'Mecanica, electricidad, plomeria, carpinteria, reparacion de equipos. Metabolico + herramientas electricas.'
WHERE name IN ('Albanileria y Obra Menor', 'Carpinteria y Ebanisteria', 'Mecanica General', 'Electricidad y Electrotecnia', 'Plomeria y Fontaneria', 'Reparacion de Computadoras', 'Reparacion de Electrodomesticos', 'Reparacion de Telefonos', 'Mantenimiento y Software', 'Mantenimiento de Sistemas Solares', 'Mantenimiento de Vehiculos', 'Terapias Manuales y Alternativas', 'Consulta Medica y Odontologica');

UPDATE products SET price_per_unit = 3, energy_human = 3, description = 'Ensenanza de oficios, agroecologia, salud, musica, alfabetizacion. Trabajo tecnico de instruccion.'
WHERE name IN ('Clases y Tutorias', 'Clases de Musica', 'Talleres de Oficios', 'Talleres de Agroecologia', 'Talleres de Salud Comunitaria', 'Alfabetizacion y Educacion Basica', 'Animacion y Cuentacuentos');

-- Jornadas completas (8 horas)
UPDATE products SET price_per_unit = 5, energy_human = 5, description = 'Jornada completa de trabajo manual agricola (8h x 0.61 kWh/h).'
WHERE name = 'Jornada Agricola Completa';

UPDATE products SET price_per_unit = 8, energy_human = 8, description = 'Jornada completa de trabajo general/servicios (8h x 1.0 kWh/h).'
WHERE name = 'Jornada de Trabajo General';

UPDATE products SET price_per_unit = 24, energy_human = 24, description = 'Jornada completa de trabajo tecnico especializado (8h x 3.0 kWh/h).'
WHERE name = 'Jornada de Trabajo Tecnico';

-- Transporte
UPDATE products SET price_per_unit = 5, energy_direct = 5, description = 'Transporte de mercancia con combustible fosil (~0.5L diesel = 5.8 kWh).'
WHERE name = 'Transporte de Carga';

UPDATE products SET price_per_unit = 1, energy_direct = 1, description = 'Pasaje local en vehiculo compartido.'
WHERE name = 'Pasaje de Personas';

UPDATE products SET price_per_unit = 20, energy_human = 20, description = 'Jornada completa de arriero con animal de carga (8h tecnico + animal).'
WHERE name = 'Servicio de Arriero';

-- === ALIMENTOS: Cosecha Fresca (local, farm-gate) ===
UPDATE products SET price_per_unit = 2, energy_inputs = 2, description = 'Lechuga, repollo, espinaca, acelga, cilantro, perejil, cebollin, apio, hierbabuena, toronjil. Energia incorporada: 3.6-7.2 MJ/kg = 1-2 kWh/kg (riego solar, compostaje, trabajo manual).'
WHERE name IN ('Hojas Verdes y Aromaticas', 'Hortalizas y Hojas Verdes de El Junquito');

UPDATE products SET price_per_unit = 2, energy_inputs = 2, description = 'Name morado, ocumo, yuca, auyama, cambur morado, platano. Tuberculos de conuco: ~5-7 MJ/kg = 1.5-2 kWh/kg.'
WHERE name = 'Tuberculos Ancestrales y Platanos';

UPDATE products SET price_per_unit = 2, energy_inputs = 2, description = 'Tomate, pimenton, pepino, berenjena, zanahoria, remolacha, ajo, cebolla, ahuyama, calabacin. ~3.2-7.2 MJ/kg = 1-2 kWh/kg (cultivo local).'
WHERE name IN ('Verduras y Hortalizas de Conuco', 'Verduras frescas 1kg');

UPDATE products SET price_per_unit = 2, energy_inputs = 2, description = 'Mango, papaya, guayaba, patilla, melon, pina, lechosa, cambur, limon, naranja, mandarina, aguacate. ~2.8 MJ/kg farm-gate = 0.8 kWh/kg + procesamiento local.'
WHERE name = 'Frutas de Temporada';

UPDATE products SET price_per_unit = 2, energy_inputs = 2, description = 'Apio, name topi, mapuey, batata, borugo, rabano. Raices criollas de conuco, energia similar a tuberculos.'
WHERE name = 'Raices y Bulbos';

-- === ALIMENTOS: Granos y Cereales (ciclo de vida completo) ===
UPDATE products SET price_per_unit = 10, energy_inputs = 10, description = 'Maiz criollo blanco y amarillo, cebada, avena, centeno. Energia incorporada: 31-37 MJ/kg = 9-10 kWh/kg (siembra, fertilizacion, cosecha, secado). Fuente: Agribalyse, USDA, Pimentel.'
WHERE name IN ('Granos Basicos Criollos', 'Granos basicos (maiz, frijol) 1kg');

UPDATE products SET price_per_unit = 11, energy_inputs = 11, description = 'Arroz procesado, sorgo, legumbres (caraota, frijol, quinchoncho, lentejas, garbanzos, habas). Energia: 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, Ecoinvent, FAO.'
WHERE name = 'Arroz y Legumbres';

UPDATE products SET price_per_unit = 10, energy_inputs = 10, description = 'Harina de maiz, trigo integral, yuca (casabe), platano, quinoa. Energia incorporada del grano + molienda: ~36 MJ/kg = 10 kWh/kg.'
WHERE name IN ('Harinas Integrales', 'Harina de maiz 50kg');

-- === ALIMENTOS: Transformados ===
UPDATE products SET price_per_unit = 5, energy_direct = 5, description = 'Pan de maiz, trigo integral, arepas, cachapas, bollos, empanadas. Energia: 16-18 MJ/kg = 4.5-5 kWh/kg (molienda + amasado + horneado). Fuente: Agribalyse.'
WHERE name = 'Panaderia y Masas Caseras';

UPDATE products SET price_per_unit = 15, energy_direct = 15, description = 'Azucar, papelon, panela, rapadura, melaza de cana. Energia: 53 MJ/kg = 14.8 kWh/kg (cultivo + refinacion). Fuente: Agribalyse.'
WHERE name IN ('Papelon y Panela', 'Azucar y Edulcorantes');

UPDATE products SET price_per_unit = 10, energy_direct = 10, description = 'Aceite de coco, ajonjoli, palma, vinagre de cana. Energia: 35-40 MJ/L = 9.7-11.1 kWh/L (prensado, extraccion, refinado). Fuente: Agribalyse, Ecoinvent.'
WHERE name IN ('Aceites y Vinagres', 'Aceite Vegetal');

UPDATE products SET price_per_unit = 8, energy_direct = 8, description = 'Dulce de lechosa, cabello de angel, jalea de guayaba, conservas de coco, bocadillo, encurtidos, salsas. Energia: 25-30 MJ/kg = 7-8 kWh/kg (cocccion + conservacion).'
WHERE name IN ('Dulces y Conservas Tradicionales', 'La Tradicional Cafunga de Barlovento', 'Encurtidos y Salsas');

UPDATE products SET price_per_unit = 25, energy_direct = 25, description = 'Cacao fermentado de Barlovento/Chuao, chocolate bean-to-bar 70%, cafe lavado tostado a lena. Energia: 80-90 MJ/kg = 22-25 kWh/kg (fermentacion + secado + torrefaccion).'
WHERE name IN ('Cacao, Chocolate y Cafe', 'Cacao Puro, Chocolates y Cafe de Montana');

-- === ALIMENTOS: Origen Animal ===
UPDATE products SET price_per_unit = 2, energy_inputs = 2, description = 'Leche fresca de vaca, cabra. Energia: 5-7 MJ/L = 1.5-1.7 kWh/L (forraje + ordeño + pasteurizacion). Fuente: Ecoinvent, JRC, USDA.'
WHERE name = 'Leche Fresca';

UPDATE products SET price_per_unit = 8, energy_direct = 8, description = 'Queso fresco, de mano, guayanes, suero, cuajada, yogurt, mantequilla. Energia: 25-36 MJ/kg = 7-10 kWh/kg (10L leche por kg + fermentacion + frío). Fuente: Agribalyse.'
WHERE name IN ('Lacteos Artesanales', 'Quesos Artesanales de Bufala y Cabra');

UPDATE products SET price_per_unit = 8, energy_inputs = 8, description = 'Pollo de patio, gallina, pato, conejo. Energia: 30 MJ/kg = 8.3 kWh/kg (conversion 4.2 kg pienso/kg carne). Fuente: Pimentel, Agribalyse.'
WHERE name = 'Carnes de Pollo y Aves';

UPDATE products SET price_per_unit = 13, energy_inputs = 13, description = 'Cerdo criollo, chivo. Energia: 47.5 MJ/kg = 13.2 kWh/kg (conversion 10.7 kg pienso/kg + climatizacion). Fuente: USDA, Agribalyse.'
WHERE name = 'Carnes de Cerdo y Chivo';

UPDATE products SET price_per_unit = 25, energy_inputs = 25, description = 'Carne de res, vacuno pastoreado. Energia: 80-100 MJ/kg = 22-28 kWh/kg (conversion 31.7 kg forraje/kg). Fuente: Pimentel, Ecoinvent, Agribalyse.'
WHERE name = 'Carnes de Vacuno';

UPDATE products SET price_per_unit = 10, energy_inputs = 10, description = 'Huevos de gallina criolla, pato, codorniz. Energia: 34.4 MJ/kg = 9.6 kWh/kg (mantenimiento ponedoras + alimento). Fuente: Agribalyse.'
WHERE name = 'Huevos Frescos';

UPDATE products SET price_per_unit = 10, energy_inputs = 10, description = 'Pescado fresco de rio, salado, carite, cazon, camarones. Energia estimada: ~35 MJ/kg = 10 kWh/kg (captura + cadena de frio).'
WHERE name = 'Pescados y Mariscos';

-- === ALIMENTOS: Miel ===
UPDATE products SET price_per_unit = 10, energy_inputs = 10, description = 'Miel multifleural de montana, bosque, azahar. Energia: ~35 MJ/L = 10 kWh/L (apicultura + extraccion + filtrado).'
WHERE name IN ('Miel Pura de Abejas', 'Miel 1L');

-- === ALIMENTOS: Bebidas ===
UPDATE products SET price_per_unit = 5, energy_direct = 5, description = 'Chicha de maiz, guarapo de cana, vino de palma, pulque, kombucha. Energia: ~18 MJ/L = 5 kWh/L (fermentacion natural).'
WHERE name = 'Bebidas Fermentadas';

UPDATE products SET price_per_unit = 3, energy_direct = 3, description = 'Te de hierbas, manzanilla, anis, tilo, boldo, hierbabuena seca. Energia: ~10 MJ/kg = 3 kWh/kg (secado + empaque).'
WHERE name = 'Infusiones y Tes';

-- === ALIMENTOS: Condimentos ===
UPDATE products SET price_per_unit = 15, energy_direct = 15, description = 'Comino, oregano, pimienta, aji dulce/picante, onoto, cilantro seco, laurel. Energia: ~53 MJ/kg = 15 kWh/kg (secado + molienda).'
WHERE name = 'Especias y Condimentos';

-- === AGRICULTURA: Semillas ===
UPDATE products SET price_per_unit = 1, energy_inputs = 1, description = 'Poleo, estevia, malojillo, romero, ruda, oregano, sabila, llanten, calendula. Energia: ~3.6 MJ/maceta = 1 kWh (propagacion + sustrato).'
WHERE name IN ('Plantulas Medicinales y Aromaticas', 'Plantulas Medicinales y Semillas Criollas');

UPDATE products SET price_per_unit = 1, energy_inputs = 1, description = 'Semillas de maiz, frijol, caraota, ahuyama, tomate, pimenton, lechuga, cilantro. Energia: ~3.6 MJ/sobre = 1 kWh (seleccion + secado).'
WHERE name = 'Semillas Criollas Adaptadas';

UPDATE products SET price_per_unit = 1, energy_inputs = 1, description = 'Estacas de yuca, platano, frutales (mango, aguacate, citricos), mora, parchita. Energia: ~3.6 MJ/unidad = 1 kWh (corte + preparacion).'
WHERE name = 'Estacas y Esquejes';

-- === AGRICULTURA: Insumos ===
UPDATE products SET price_per_unit = 2, energy_inputs = 2, description = 'Compost maduro, humus de lombriz, estiercol curado, bokashi, gallinaza. Energia: ~5-7 MJ/kg = 1.5-2 kWh/kg (proceso de descomposicion controlada).'
WHERE name = 'Abonos Organicos';

UPDATE products SET price_per_unit = 3, energy_direct = 3, description = 'Biofertilizantes, biopreparados fungicos, te de compost, purines, microorganismos eficientes. Energia: ~10 MJ/L = 3 kWh/L (fermentacion + ingredientes).'
WHERE name = 'Bioinsumos y Preparados';

UPDATE products SET price_per_unit = 1, energy_inputs = 1, description = 'Tierra preparada, sustrato para semilleros, turba, arena de rio. Energia: ~3.6 MJ/saco = 1 kWh (extraccion + mezcla).'
WHERE name = 'Tierra Fertil y Sustratos';

UPDATE products SET price_per_unit = 50, energy_inputs = 50, description = 'Mangueras, aspersores, goteros, bombas manuales, tanques. Energia: PVC + componentes ~50 kWh/juego completo.'
WHERE name = 'Sistemas de Riego';

-- === SALUD Y MEDICINA ===
UPDATE products SET price_per_unit = 8, energy_direct = 8, description = 'Extractos de propoleo, tinturas de moringa, curcuma, jengibre, pomadas de arnica, jarabes. Energia: ~28 MJ/frasco = 8 kWh (extraccion + concentracion + alcohol).'
WHERE name IN ('Tinturas Madres y Botica Conuquera');

UPDATE products SET price_per_unit = 5, energy_direct = 5, description = 'Desodorantes de coco, balsamos labiales de cera de abeja, jabones artesanales, cremas de calendula. Energia: ~18 MJ/unidad = 5 kWh (procesamiento + ingredientes).'
WHERE name = 'Cosmetica Natural sin Quimicos';

UPDATE products SET price_per_unit = 3, energy_direct = 3, description = 'Manzanilla, toronjil, valeriana, eucalipto, llanten, malojillo, sauco, tila deshidratados. Energia: ~10 MJ/kg = 3 kWh (secado al sol + empaque).'
WHERE name = 'Hierbas Medicinales Secas';

UPDATE products SET price_per_unit = 3, energy_direct = 3, description = 'Jabon de lavar, jabon corporal natural, champu solido, dentifrico natural. Energia: ~10 MJ/unidad = 3 kWh (saponificacion + ingredientes).'
WHERE name = 'Jabones y Productos de Higiene';

UPDATE products SET price_per_unit = 5, energy_direct = 5, description = 'Detergente biodegradable, suavizante, limpiador multiusos, desinfectante natural. Energia: ~18 MJ/L = 5 kWh (mezclado + ingredientes).'
WHERE name = 'Detergentes y Suavizantes Naturales';

UPDATE products SET price_per_unit = 5, energy_inputs = 5, description = 'Vendas, gasas, alcohol, yodo, apositos, tiritas, tijeras, manual. Energia: ~18 MJ/juego = 5 kWh (manufactura de componentes).'
WHERE name = 'Botiquin y Primeros Auxilios';

-- === TEXTILES ===
UPDATE products SET price_per_unit = 30, energy_inputs = 30, description = 'Camisas, pantalones, vestidos, faldas, blusas de algodon o lana. Energia: ~108 MJ/unidad = 30 kWh (tela + confeccion + tintes). Fuente: Ecoinvent.'
WHERE name IN ('Prendas de Vestir Artesanales', 'Prenda artesanal (lana/algodon)');

UPDATE products SET price_per_unit = 5, energy_human = 5, description = 'Parches, costuras, ajustes, dobladillos, cremalleras, reformas. Energia: ~5h trabajo general = 5 kWh.'
WHERE name = 'Reparacion y Adaptacion de Prendas';

UPDATE products SET price_per_unit = 8, energy_inputs = 8, description = 'Tela de algodon, lino, lana, cañamo, cruda, teñida natural. Energia: ~30 MJ/m = 8 kWh/m (cultivo + hilado + tejido). Fuente: Ecoinvent.'
WHERE name IN ('Telas Naturales', 'Tela de algodon 1m');

UPDATE products SET price_per_unit = 40, energy_inputs = 40, description = 'Frazadas de lana, mantas de algodon, hamacas de cañamo, colchas tejidas. Energia: ~144 MJ/unidad = 40 kWh (materiales + tejido extenso).'
WHERE name = 'Cobijas, Frazadas y Hamacas';

UPDATE products SET price_per_unit = 5, energy_inputs = 5, description = 'Hilo de coser, lana para tejer, cañamo, estambres, hilos encerados. Energia: ~18 MJ/rollo = 5 kWh (hilado + teñido).'
WHERE name = 'Hilos y Lana para Tejer';

-- === ARTESANIA ===
UPDATE products SET price_per_unit = 15, energy_direct = 15, description = 'Ollas de barro, vasijas, platos, tazas, cantaras, budares. Energia: ~54 MJ/unidad = 15 kWh (extraccion + moldeado + coccion horno).'
WHERE name = 'Vasijas y Vajilla de Barro';

UPDATE products SET price_per_unit = 15, energy_direct = 15, description = 'Figuras, adornos, macetas decorativas, joyeros de arcilla. Energia: ~54 MJ/unidad = 15 kWh (coccion + acabado).'
WHERE name = 'Ceramica Decorativa';

UPDATE products SET price_per_unit = 10, energy_human = 10, description = 'Canastos, cestas, petacas, cajas de fibra vegetal, sombreros de paja. Energia: ~36 MJ/unidad = 10 kWh (recoleccion + tejido manual).'
WHERE name = 'Canastas y Cesteria';

UPDATE products SET price_per_unit = 20, energy_direct = 20, description = 'Cucharas de palo, morteros, pilones, tallas decorativas, juguetes. Energia: ~72 MJ/unidad = 20 kWh (madera + tallado + acabado).'
WHERE name = 'Tallados y Utensilios de Madera';

UPDATE products SET price_per_unit = 80, energy_direct = 80, description = 'Mesas, sillas, bancos, camas, estantes de madera local. Energia: ~288 MJ/unidad = 80 kWh (madera 3 kWh/kg + ebanisteria + acabados).'
WHERE name = 'Muebles Rusticos de Madera';

-- === CONSTRUCCION: Materiales ===
UPDATE products SET price_per_unit = 1, energy_direct = 1, description = 'Bloques de tierra comprimida, adobes, bahareque. Energia: 1.8-3.6 MJ/unidad = 0.5-1 kWh (mezcla + prensado + secado solar). Fuente: ICE Database.'
WHERE name = 'Bloques, Adobe y Bahareque';

UPDATE products SET price_per_unit = 3, energy_inputs = 3, description = 'Madera aserrada, vigas, tablas, listones. Energia: 8.5 MJ/kg = 2.36 kWh/kg (tala + aserrado + secado). Fuente: ICE Database.'
WHERE name = 'Madera de Construccion';

UPDATE products SET price_per_unit = 1, energy_direct = 1, description = 'Piedra de rio, grava, arena, cascajo. Energia: 0.083 MJ/kg = 0.023 kWh/kg (extraccion + clasificacion). Fuente: ICE Database.'
WHERE name = 'Piedra y Agregados';

UPDATE products SET price_per_unit = 4, energy_direct = 4, description = 'Pintura a cal, tierra pigmentada, estucos naturales, impermeabilizantes. Energia: ~15 MJ/L = 4 kWh (mezclado + pigmentos).'
WHERE name = 'Pinturas y Recubrimientos Naturales';

-- === ENERGIA Y COMBUSTIBLES ===
UPDATE products SET price_per_unit = 1319, energy_inputs = 1319, description = 'Panel solar monocristalino 1m2. Energia incorporada: 4750 MJ/m2 = 1319 kWh (silicio grado solar + obleas + cristal). Fuente: ICE Database, Ecoinvent.'
WHERE name = 'Panel Solar Fotovoltaico';

UPDATE products SET price_per_unit = 4, energy_direct = 4, description = 'Lena seca de arboles frutales y de sombra. Energia: 15.3 MJ/kg = 4.25 kWh (corte + secado + transporte). Fuente: Ecoinvent.'
WHERE name = 'Lena Seca para Cocinar';

UPDATE products SET price_per_unit = 6, energy_direct = 6, description = 'Carbon vegetal de hornos artesanales. Energia: ~22 MJ/kg = 6 kWh (pirolisis + transporte).'
WHERE name = 'Carbon Vegetal';

UPDATE products SET price_per_unit = 12, energy_direct = 12, description = 'Diesel/gasoil agricola. Energia: 41.7 MJ/L = 11.6 kWh/L (refinacion + distribucion). Fuente: Ecoinvent, ResearchGate.'
WHERE name = 'Diesel Agricola';

-- === HERRAMIENTAS ===
UPDATE products SET price_per_unit = 50, energy_inputs = 50, description = 'Machetes, palas, picos, rastrillos, azadones. Energia: acero 6 kWh/kg + manufactura ~50 kWh/unidad.'
WHERE name = 'Herramientas de Campo';

UPDATE products SET price_per_unit = 50, energy_inputs = 50, description = 'Martillos, serruchos, limas, destornilladores, alicates. Energia: acero + manufactura ~50 kWh/unidad.'
WHERE name = 'Herramientas de Taller';

UPDATE products SET price_per_unit = 1, energy_human = 1, description = 'Afilar machetes, cuchillos, tijeras, reparacion de mangos. Energia: ~1h trabajo general = 1 kWh.'
WHERE name = 'Afilar y Mantener Herramientas';

UPDATE products SET price_per_unit = 200, energy_inputs = 200, description = 'Taladros, sierras circulares, amoladoras, lijadoras, soldadoras. Energia: acero + motor electrico + electronicos ~200 kWh/unidad.'
WHERE name = 'Equipos Electricos de Taller';

-- === TECNOLOGIA Y ELECTRODOMESTICOS ===
UPDATE products SET price_per_unit = 278, energy_inputs = 278, description = 'Smartphone completo. Energia incorporada: 1000 MJ = 278 kWh (tierras raras + microprocesadores + ensamblado). Fuente: ICE Database, Marspedia.'
WHERE name = 'Telefono Inteligente';

UPDATE products SET price_per_unit = 1250, energy_inputs = 1250, description = 'Laptop completa. Energia: 4500 MJ = 1250 kWh (placa madre + LCD + bateria litio + chasis). Fuente: Ecoinvent, Marspedia.'
WHERE name = 'Computadora Portatil';

UPDATE products SET price_per_unit = 579, energy_inputs = 579, description = 'PC de sobremesa. Energia: 2085 MJ = 579 kWh (torre + componentes). Fuente: Marspedia.'
WHERE name = 'Computadora de Sobremesa';

UPDATE products SET price_per_unit = 1083, energy_inputs = 1083, description = 'Lavadora domestica. Energia: 3900 MJ = 1083 kWh (acero + motor + contrapesos + electronica). Fuente: ICE Database.'
WHERE name = 'Lavadora Domestica';

UPDATE products SET price_per_unit = 1639, energy_inputs = 1639, description = 'Refrigerador domestico. Energia: 5900 MJ = 1639 kWh (compresor + poliuretano + cobre + acero). Fuente: ICE Database.'
WHERE name = 'Refrigerador Domestico';

UPDATE products SET price_per_unit = 268, energy_inputs = 268, description = 'Monitor LCD. Energia: 963 MJ = 268 kWh (pantalla + electronicos). Fuente: ICE Database.'
WHERE name = 'Monitor LCD';

UPDATE products SET price_per_unit = 51, energy_inputs = 51, description = 'Cafetera electrica. Energia: 184 MJ = 51 kWh (plastico + resistencia + cableado). Fuente: ICE Database.'
WHERE name = 'Cafetera Electrica';

UPDATE products SET price_per_unit = 22, energy_inputs = 22, description = 'Secador de pelo. Energia: 79 MJ = 22 kWh (plastico + motor + resistencia). Fuente: ICE Database.'
WHERE name = 'Secador de Pelo';

UPDATE products SET price_per_unit = 10, energy_inputs = 10, description = 'Resistencias, capacitores, cables, conectores, soldadura, plaquetas, fusibles. Energia: ~36 MJ/lote = 10 kWh.'
WHERE name = 'Componentes Electronicos';

-- === TRANSPORTE ===
UPDATE products SET price_per_unit = 100, energy_inputs = 100, description = 'Bicicleta completa. Energia: acero 6 kWh/kg x ~15kg + caucho + ensamblaje ~100 kWh.'
WHERE name = 'Bicicletas y Refacciones';

UPDATE products SET price_per_unit = 18, energy_inputs = 18, description = 'Caballos, burros, mulas. Energia incorporada del animal + mantenimiento: ~67 MJ/kg x peso estimado / vida util.'
WHERE name = 'Animales de Carga y Montura';

-- === CULTURA ===
UPDATE products SET price_per_unit = 100, energy_inputs = 100, description = 'Tambores, maracas, cuatros, guitarras, marimbas, flautas de cana. Energia: madera + cuero + manufactura ~100 kWh/unidad.'
WHERE name = 'Instrumentos Musicales Artesanales';

UPDATE products SET price_per_unit = 15, energy_direct = 15, description = 'Cuadros, murales, retratos, cartelera. Energia: pinturas + tela/lienzo + trabajo ~54 MJ/unidad = 15 kWh.'
WHERE name = 'Pintura y Artes Visuales';

-- === CANASTA BASICA ===
-- Insertar canasta basica familiar semanal
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Canasta Basica Familiar Semanal', 'Alimentacion', 'Canasta Basica', 'Semanal', 'internal', 'canasta',
'Canasta semanal para familia de 4-5 personas: 3kg granos, 2kg verduras, 1kg frutas, 0.5kg carne, 1L leche, 0.5L aceite, 0.5kg azucar, 1 docena huevos, especias. Energia total estimada: ~180 kWh/semana.',
'Necesidad Vital',
'/placeholder.svg', 50, true, true, '', 0, 0, 50, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Canasta Basica Familiar Semanal' AND node_domain = nd.node_domain);

-- Insertar productos nuevos que no existen en el catalogo anterior
-- Jornadas de trabajo
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Jornada Agricola Completa', 'Servicios', 'Trabajo Agricola', 'Jornadas', 'internal', 'jornada',
'Jornada completa de trabajo manual agricola (8 horas x 0.61 kWh/h = 4.88 kWh). Siembra, cosecha, riego, desmalece.',
'Conuquero',
'/placeholder.svg', 5, true, true, '', 0, 5, 0, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jornada Agricola Completa' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Jornada de Trabajo General', 'Servicios', 'Trabajo General', 'Jornadas', 'internal', 'jornada',
'Jornada completa de trabajo general/servicios (8 horas x 1.0 kWh/h = 8 kWh). Limpieza, atencion, gestion, oficios no especializados.',
'General',
'/placeholder.svg', 8, true, true, '', 0, 8, 0, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jornada de Trabajo General' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Jornada de Trabajo Tecnico', 'Servicios', 'Trabajo Tecnico', 'Jornadas', 'internal', 'jornada',
'Jornada completa de trabajo tecnico especializado (8 horas x 3.0 kWh/h = 24 kWh). Mecanica, electricidad, plomeria, reparacion de equipos.',
'Tecnico',
'/placeholder.svg', 24, true, true, '', 0, 24, 0, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Jornada de Trabajo Tecnico' AND node_domain = nd.node_domain);

-- Arroz y legumbres
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Arroz y Legumbres', 'Alimentacion', 'Granos y Cereales', 'Arroz y Legumbres', 'internal', 'kg',
'Arroz procesado, sorgo, caraota, frijol, quinchoncho, lentejas, garbanzos, habas. Energia: 36-43 MJ/kg = 10-12 kWh/kg. Fuente: Agribalyse, Ecoinvent, FAO.',
'Cereal',
'/placeholder.svg', 11, true, true, '', 0, 0, 11, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Arroz y Legumbres' AND node_domain = nd.node_domain);

-- Leche fresca
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Leche Fresca', 'Alimentacion', 'Carnes y Pescados', 'Lacteos Frescos', 'internal', 'litro',
'Leche fresca de vaca, cabra. Energia: 5-7 MJ/L = 1.5-1.7 kWh/L (forraje + ordeño + pasteurizacion). Fuente: Ecoinvent, JRC, USDA.',
'Fresca',
'/placeholder.svg', 2, true, true, '', 0, 0, 2, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Leche Fresca' AND node_domain = nd.node_domain);

-- Carnes separadas
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Carnes de Pollo y Aves', 'Alimentacion', 'Carnes y Pescados', 'Aves', 'internal', 'kg',
'Pollo de patio, gallina, pato, conejo. Energia: 30 MJ/kg = 8.3 kWh/kg (conversion 4.2 kg pienso/kg). Fuente: Pimentel, Agribalyse.',
'De Patio',
'/placeholder.svg', 8, true, true, '', 0, 0, 8, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Carnes de Pollo y Aves' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Carnes de Cerdo y Chivo', 'Alimentacion', 'Carnes y Pescados', 'Cerdo y Chivo', 'internal', 'kg',
'Cerdo criollo, chivo. Energia: 47.5 MJ/kg = 13.2 kWh/kg (conversion 10.7 kg pienso/kg + climatizacion). Fuente: USDA, Agribalyse.',
'Criollo',
'/placeholder.svg', 13, true, true, '', 0, 0, 13, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Carnes de Cerdo y Chivo' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Carnes de Vacuno', 'Alimentacion', 'Carnes y Pescados', 'Vacuno', 'internal', 'kg',
'Carne de res, vacuno pastoreado. Energia: 80-100 MJ/kg = 22-28 kWh/kg (conversion 31.7 kg forraje/kg). Fuente: Pimentel, Ecoinvent, Agribalyse.',
'Pastoreo',
'/placeholder.svg', 25, true, true, '', 0, 0, 25, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Carnes de Vacuno' AND node_domain = nd.node_domain);

-- Electrodomesticicos nuevos
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Telefono Inteligente', 'Tecnologia', 'Electronica', 'Telefonos', 'internal', 'unidad',
'Smartphone completo. Energia incorporada: 1000 MJ = 278 kWh (tierras raras + microprocesadores + ensamblado). Fuente: ICE Database, Marspedia.',
'Dispositivo',
'/placeholder.svg', 278, true, true, '', 0, 0, 278, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Telefono Inteligente' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Computadora Portatil', 'Tecnologia', 'Electronica', 'Computadoras', 'internal', 'unidad',
'Laptop completa. Energia: 4500 MJ = 1250 kWh (placa madre + LCD + bateria litio + chasis). Fuente: Ecoinvent, Marspedia.',
'Dispositivo',
'/placeholder.svg', 1250, true, true, '', 0, 0, 1250, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Computadora Portatil' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Lavadora Domestica', 'Tecnologia', 'Electrodomesticos', 'Lavanderia', 'internal', 'unidad',
'Lavadora domestica. Energia: 3900 MJ = 1083 kWh (acero + motor + contrapesos + electronica). Fuente: ICE Database.',
'Electrodomestico',
'/placeholder.svg', 1083, true, true, '', 0, 0, 1083, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Lavadora Domestica' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Refrigerador Domestico', 'Tecnologia', 'Electrodomesticos', 'Refrigeracion', 'internal', 'unidad',
'Refrigerador domestico. Energia: 5900 MJ = 1639 kWh (compresor + poliuretano + cobre + acero). Fuente: ICE Database.',
'Electrodomestico',
'/placeholder.svg', 1639, true, true, '', 0, 0, 1639, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Refrigerador Domestico' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Panel Solar Fotovoltaico', 'Energia', 'Solar', 'Paneles', 'internal', 'm2',
'Panel solar monocristalino 1m2. Energia incorporada: 4750 MJ/m2 = 1319 kWh (silicio grado solar + obleas + cristal). Fuente: ICE Database, Ecoinvent.',
'Energia Limpia',
'/placeholder.svg', 1319, true, true, '', 0, 0, 1319, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Panel Solar Fotovoltaico' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Diesel Agricola', 'Energia', 'Combustibles', 'Diesel', 'internal', 'litro',
'Diesel/gasoil agricola. Energia: 41.7 MJ/L = 11.6 kWh/L (refinacion + distribucion). Fuente: Ecoinvent, ResearchGate.',
'Combustible',
'/placeholder.svg', 12, true, true, '', 12, 0, 0, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Diesel Agricola' AND node_domain = nd.node_domain);

-- Materiales industriales
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Acero Reciclado', 'Construccion', 'Metales', 'Acero', 'internal', 'kg',
'Acero reciclado en horno de arco electrico. Energia: 20 MJ/kg = 5.56 kWh/kg. Fuente: ICE Database, Ecoinvent.',
'Reciclado',
'/placeholder.svg', 6, true, true, '', 0, 0, 6, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Acero Reciclado' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Acero Virgen', 'Construccion', 'Metales', 'Acero', 'internal', 'kg',
'Acero estructural virgen. Energia: 35 MJ/kg = 9.72 kWh/kg (alto horno + laminacion). Fuente: ICE Database, WorldSteel.',
'Industrial',
'/placeholder.svg', 10, true, true, '', 0, 0, 10, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Acero Virgen' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Aluminio', 'Construccion', 'Metales', 'Aluminio', 'internal', 'kg',
'Aluminio comercial (33% reciclado). Energia: 193 MJ/kg = 53.6 kWh/kg (electrolisis Hall-Heroult). Fuente: ICE Database, Ecoinvent.',
'Ligero',
'/placeholder.svg', 54, true, true, '', 0, 0, 54, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Aluminio' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Vidrio Plano', 'Construccion', 'Materiales', 'Vidrio', 'internal', 'kg',
'Vidrio plano para ventanas. Energia: 15 MJ/kg = 4.17 kWh/kg (fusion de silice >1500C). Fuente: ICE Database.',
'Transparente',
'/placeholder.svg', 4, true, true, '', 0, 0, 4, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Vidrio Plano' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Hormigon Estructural', 'Construccion', 'Materiales', 'Hormigon', 'internal', 'kg',
'Hormigon M20 (1:1.5:3). Energia: 1.55 MJ/kg = 0.43 kWh/kg (calcina de clinker + mezclado). Fuente: ICE Database, Ecoinvent.',
'Estructural',
'/placeholder.svg', 1, true, true, '', 0, 0, 1, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Hormigon Estructural' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Ladrillo de Arcilla', 'Construccion', 'Materiales', 'Ladrillos', 'internal', 'unidad',
'Ladrillo comun de arcilla cocida. Energia: 4.75 MJ/unidad = 1.32 kWh (extraccion + moldeado + coccion). Fuente: ICE Database, Ecoinvent.',
'Cocido',
'/placeholder.svg', 1, true, true, '', 0, 0, 1, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ladrillo de Arcilla' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Bloque de Paja', 'Construccion', 'Materiales', 'Bioconstruccion', 'internal', 'bloque',
'Bloque de paja (straw bale). Energia: 0.91 MJ/kg = 0.25 kWh/kg (empacado agricola). Fuente: ICE Database.',
'Bioconstruccion',
'/placeholder.svg', 1, true, true, '', 0, 0, 1, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Bloque de Paja' AND node_domain = nd.node_domain);

-- Combustibles adicionales
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Gasolina', 'Energia', 'Combustibles', 'Gasolina', 'internal', 'kg',
'Gasolina comercial. Energia: 47.1 MJ/kg = 13.08 kWh/kg (refinacion del petroleo). Fuente: Ecoinvent.',
'Combustible',
'/placeholder.svg', 13, true, true, '', 13, 0, 0, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Gasolina' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Gas GLP', 'Energia', 'Combustibles', 'GLP', 'internal', 'kg',
'Gas licuado de petroleo. Energia: 50.1 MJ/kg = 13.92 kWh/kg (refinacion + envasado). Fuente: Ecoinvent.',
'Domestico',
'/placeholder.svg', 14, true, true, '', 14, 0, 0, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Gas GLP' AND node_domain = nd.node_domain);

INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Biomasa Seca (Pellets)', 'Energia', 'Combustibles', 'Biomasa', 'internal', 'kg',
'Pellets de madera seca. Energia: 15.3 MJ/kg = 4.25 kWh/kg (secado + compactacion). Fuente: Ecoinvent.',
'Renovable',
'/placeholder.svg', 4, true, true, '', 4, 0, 0, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Biomasa Seca (Pellets)' AND node_domain = nd.node_domain);

-- Polimeros
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Tuberia PVC', 'Construccion', 'Materiales', 'Polimeros', 'internal', 'kg',
'Tuberia de PVC. Energia: 10.64-77.2 MJ/kg = 3-21 kWh/kg (polimerizacion etileno + cloro). Fuente: ICE Database, Ecoinvent.',
'Plastico',
'/placeholder.svg', 10, true, true, '', 0, 0, 10, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Tuberia PVC' AND node_domain = nd.node_domain);

-- Agua
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Agua Purificada', 'Recursos Basicos', 'Agua', 'Potable', 'internal', 'litro',
'Agua filtrada/purificada. Energia: 0.5 MJ/L = 0.14 kWh/L (bombeo + microfiltracion). Fuente: ICE Database.',
'Vital',
'/placeholder.svg', 1, true, true, '', 1, 0, 0, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Agua Purificada' AND node_domain = nd.node_domain);

-- Frutos secos
INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, price_per_unit, is_approved, is_system, product_code, energy_direct, energy_human, energy_inputs, energy_amortization)
SELECT node_domain, 'Frutos Secos y Mani', 'Alimentacion', 'Cosecha Fresca', 'Frutos Secos', 'internal', 'kg',
'Nueces, almendras, mani, cachuates, avellanas. Energia: 40.87 MJ/kg = 11.35 kWh/kg (cultivo + secado + descascarado). Fuente: Agribalyse.',
'Seco',
'/placeholder.svg', 11, true, true, '', 0, 0, 11, 0
FROM (SELECT DISTINCT node_domain FROM products WHERE node_domain IS NOT NULL) nd
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Frutos Secos y Mani' AND node_domain = nd.node_domain);
