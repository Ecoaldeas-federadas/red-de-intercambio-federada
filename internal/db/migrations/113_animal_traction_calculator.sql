-- Migracion 113: Parametros de traccion animal para la calculadora
-- Anade tipos de trabajo con animales (bueyes, caballos, mulas, asnos)
-- como parametros de calculadora. Estos son estimados y configurables.
-- No afecta a parametros existentes ni a la Feria Conuquera.
--
-- IMPORTANTE: Los valores de kwh_per_unit son ESTIMACIONES basadas en
-- literatura agricola tradicional. No son mediciones cientificas exactas.
-- Cada comunidad debe ajustarlos segun su realidad local.

-- Categoria para trabajo animal
INSERT INTO calculator_categories (node_domain, parameter_type, name, description)
SELECT '__LOCAL__', 'work', 'Traccion Animal', 'Trabajo con animales de carga y tiro (bueyes, caballos, mulas, asnos)'
WHERE NOT EXISTS (
    SELECT 1 FROM calculator_categories
    WHERE node_domain = '__LOCAL__' AND parameter_type = 'work' AND name = 'Traccion Animal'
);

-- Parametros de traccion animal (estimaciones configurables)
-- Fuente: literatura agricola tradicional, FAO, estudios de traccion animal
-- Estos valores son referencias, no mediciones exactas.
INSERT INTO calculator_parameters (node_domain, parameter_type, category, subcategory, name, description, unit, kwh_per_unit, effort_factor, approved)
SELECT '__LOCAL__', 'work', 'Traccion Animal', subcat, name, desc, 'horas', kwh, eff, true
FROM (VALUES
    -- Bueyes (traccion pesada)
    ('Bueyes', 'Arado con bueyes', 'Arar tierra con yunta de bueyes y arado de madera', 1.20, 1.5),
    ('Bueyes', 'Rastrillo con bueyes', 'Rastrillar con yunta de bueyes', 0.80, 1.3),
    ('Bueyes', 'Transporte con bueyes', 'Transportar carga en carreta tirada por bueyes', 0.60, 1.2),
    ('Bueyes', 'Trilla con bueyes', 'Trillar grano con bueyes pisando la parva', 0.40, 1.1),
    -- Caballos (traccion rapida)
    ('Caballos', 'Arado con caballo', 'Arar tierra con caballo y arado', 1.00, 1.4),
    ('Caballos', 'Transporte con caballo', 'Transportar carga o personas a caballo', 0.50, 1.2),
    ('Caballos', 'Cosecha con caballo', 'Cosechar con caballo y carro', 0.70, 1.3),
    -- Mulas y asnos (traccion media)
    ('Mulas/Asnos', 'Transporte con mula', 'Transportar carga con mula o asno', 0.35, 1.1),
    ('Mulas/Asnos', 'Arado con mula', 'Arar con mula (terreno pequeno)', 0.70, 1.2),
    ('Mulas/Asnos', 'Carga en montana', 'Transportar carga en terreno montañoso con mula', 0.45, 1.3),
    -- Cuidado de animales de tiro
    ('Cuidado', 'Alimentacion de animales de tiro', 'Preparar y dar alimento a animales de trabajo', 0.08, 1.0),
    ('Cuidado', 'Higiene de animales de tiro', 'Limpiar y cuidar animales de trabajo', 0.06, 1.0),
    ('Cuidado', 'Herraje de animales', 'Herrar o revisar cascos de animales de tiro', 0.15, 1.0)
) AS t(subcat, name, desc, kwh, eff)
WHERE NOT EXISTS (
    SELECT 1 FROM calculator_parameters
    WHERE node_domain = '__LOCAL__' AND parameter_type = 'work'
    AND category = 'Traccion Animal' AND name = t.name
);

-- Categoria para insumos de traccion animal (forraje, agua, etc.)
INSERT INTO calculator_categories (node_domain, parameter_type, name, description)
SELECT '__LOCAL__', 'material', 'Insumos Traccion Animal', 'Insumos para mantener animales de trabajo (forraje, agua, sal)'
WHERE NOT EXISTS (
    SELECT 1 FROM calculator_categories
    WHERE node_domain = '__LOCAL__' AND parameter_type = 'material' AND name = 'Insumos Traccion Animal'
);

INSERT INTO calculator_parameters (node_domain, parameter_type, category, subcategory, name, description, unit, kwh_per_unit, effort_factor, approved)
SELECT '__LOCAL__', 'material', 'Insumos Traccion Animal', subcat, name, desc, unit, kwh, 1.0, true
FROM (VALUES
    ('Forraje', 'Heno/forraje fresco', 'Forraje para alimentacion diaria de animales', 'kg', 0.005),
    ('Forraje', 'Grano/avena', 'Grano para alimentacion de animales de trabajo', 'kg', 0.015),
    ('Forraje', 'Sal mineral', 'Suplemento mineral para animales', 'kg', 0.001),
    ('Agua', 'Agua para animales', 'Agua de bebida para animales de tiro', 'litros', 0.0002),
    ('Sanidad', 'Medicina veterinaria basica', 'Medicamentos basicos para animales de tiro', 'dosis', 0.010),
    ('Estabulo', 'Paja para cama', 'Paja para cama de animales en estabulo', 'kg', 0.002)
) AS t(subcat, name, desc, unit, kwh)
WHERE NOT EXISTS (
    SELECT 1 FROM calculator_parameters
    WHERE node_domain = '__LOCAL__' AND parameter_type = 'material'
    AND category = 'Insumos Traccion Animal' AND name = t.name
);
