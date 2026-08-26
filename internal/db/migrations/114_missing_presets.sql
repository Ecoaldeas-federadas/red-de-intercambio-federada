-- Migracion 114: Presets faltantes (Camphill, Oasis Sufi, Granjas Halal, Convivencialidad)
-- Anade los presets que no estaban en la migracion 109.
-- No modifica presets existentes. No afecta a la Feria Conuquera.

INSERT INTO node_presets (id, name, description, category, icon, has_demo_data, config) VALUES
-- Camphill (antroposofica, biodinamica, economia asociativa)
('camphill', 'Camphill (Antroposofica)', 'Comunidades donde personas con discapacidades y terapeutas viven juntos. Agricultura biodinamica, contabilidad de economia asociativa, trabajo como terapia.', 'cristiana', 'flower', true,
 '{"node_name":"Comunidad Camphill","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Talleres y granja biodinamica"},"colors":{"primary":"#7c3aed"}}'),
-- Oasis Sufi
('oasis_sufi', 'Oasis Sufi', 'Zawiyas rurales sufies, dhikr en el campo, agricultura organica, caridad (sadaqah) integrada.', 'islamica', 'sparkles', true,
 '{"node_name":"Zawiya Rural","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Dhikr y agricultura organica"},"colors":{"primary":"#0d9488"}}'),
-- Granjas Halal
('granjas_halal', 'Granjas Halal', 'Agricultura halal organica, dhabiha, sin alcohol ni carne no halal. Comunidad musulmana productora.', 'islamica', 'wheat', true,
 '{"node_name":"Granja Halal","commerce_schedule":[],"commerce_hours_enabled":false,"catalog_rules":[{"category":"alcohol","is_prohibited":true,"reason":"Prohibido en Islam"},{"category":"cerdo","is_prohibited":true,"reason":"Haram - carne de cerdo prohibida"},{"category":"carne_no_halal","is_prohibited":true,"reason":"Debe ser dhabiha (sacrificio halal)"}],"public_settings":{"footer_schedule":"Mercado halal organico semanal"},"colors":{"primary":"#059669"}}'),
-- Convivencialidad (Ivan Illich)
('convivencialidad', 'Convivencialidad (Ivan Illich)', 'Herramientas conviviales, desescolarizacion, anti-consumo, tecnologia apropiada. Comunidades que rechazan el crecimiento.', 'filosofica', 'scale', true,
 '{"node_name":"Comunidad Convivencial","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Trueque y herramientas conviviales"},"colors":{"primary":"#475569"}}')
ON CONFLICT (id) DO NOTHING;
