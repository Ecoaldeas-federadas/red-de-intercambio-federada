-- Migracion 109: Preconfiguraciones de nodo (presets)
-- Permite que al instalar o arrancar el demo, se elija un perfil preconfigurado
-- que cargue datos, horarios, reglas, textos y colores segun la filosofia de la comunidad.
-- Cada nodo es independiente. La Feria Conuquera NO se modifica.

CREATE TABLE IF NOT EXISTS node_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    icon TEXT NOT NULL DEFAULT 'globe',
    -- Configuracion JSON completa del preset:
    -- {
    --   "node_name": "Fundacion Las Delicias",
    --   "commerce_schedule": [...],
    --   "catalog_rules": [...],
    --   "public_settings": {...},
    --   "governance": {...},
    --   "colors": {...},
    --   "footer_schedule": "..."
    -- }
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Si es true, es un preset demo con datos de ejemplo completos
    has_demo_data BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Presets predefinidos (15+ perfiles)
-- Cada uno con configuracion basica. Los datos demo completos los carga demo_seed.go.
-- ON CONFLICT va una sola vez al final del INSERT (no despues de cada fila).

INSERT INTO node_presets (id, name, description, category, icon, has_demo_data, config) VALUES
-- 1. Adventistas
('adventista', 'Adventistas del Septimo Dia', 'Puestos de avanzada, sostén propio, Sabbath Lock (viernes-sabado al ponerse el sol). Fundacion Las Delicias.', 'cristiana', 'book-open', true,
 '{"node_name":"Puesto de Avanzada","commerce_schedule":[{"name":"Reposo del Sabado","day_of_week":5,"start_time":"18:00","end_time":"18:00","crosses_midnight":true,"end_day_of_week":6,"block_type":"block_all","block_message":"Santificando el Sabado. Las transacciones se reanudaran al ponerse el sol del sabado."}],"commerce_hours_enabled":true,"public_settings":{"footer_schedule":"Actividad continua excepto Sabado (puesta del sol viernes a sabado)"},"colors":{"primary":"#1e40af"}}'),
-- 2. Amish / Menonitas
('amish', 'Amish / Menonitas', 'Traccion animal, sin celulares, Ordnung. Tótem NFC fijo en el galpon de trueque.', 'cristiana', 'wheat', true,
 '{"node_name":"Comunidad Plain","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Subasta comunitaria mensual"},"colors":{"primary":"#000000"}}'),
-- 3. Hutteritas
('hutterita', 'Hutteritas', 'Colonias comunales, bienes en comun, ~100 personas/colonia. Contabilidad departamental sin cuentas personales.', 'cristiana', 'users', true,
 '{"node_name":"Colonia Hutterita","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Produccion agricola continua"},"colors":{"primary":"#4338ca"}}'),
-- 4. Bruderhof
('bruderhof', 'Bruderhof', 'Bienes comunes (Hechos 2:44), agricultura regenerativa + manufactura. Auditoria departamental de energia.', 'cristiana', 'heart', true,
 '{"node_name":"Comunidad Bruderhof","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Comunidad de bienes comunes"},"colors":{"primary":"#059669"}}'),
-- 5. Cuáqueros
('cuakero', 'Cuáqueros (Quakers)', 'Consenso espiritual, simplicidad, tierra como guardia no propiedad.', 'cristiana', 'scale', true,
 '{"node_name":"Aldea Cuáquera","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Reuniones de consenso mensuales"},"colors":{"primary":"#6b7280"}}'),
-- 6. Catholic Land Movement
('catholic_land', 'Catholic Land Movement', 'Homesteading catolico familiar. Rerum Novarum, Mater et Magistra.', 'cristiana', 'home', true,
 '{"node_name":"Granja Catolica Familiar","commerce_schedule":[{"name":"Domingo de descanso","day_of_week":0,"start_time":null,"end_time":null,"crosses_midnight":false,"block_type":"block_all","block_message":"Descanso dominical. Las transacciones se reanudaran el lunes."}],"commerce_hours_enabled":true,"public_settings":{"footer_schedule":"Mercado sabatino"},"colors":{"primary":"#7c2d12"}}'),
-- 7. Monasterios (Trapenses/Ortodoxos)
('monasterio', 'Monasterios (Trapenses/Ortodoxos)', 'Agricultura liturgica, organica, trabajo manual sin mecanizacion. Monte Athos, trapenses.', 'cristiana', 'flower', true,
 '{"node_name":"Granja Monastica","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Produccion according al calendario liturgico"},"colors":{"primary":"#4c1d95"}}'),
-- 8. Twelve Tribes
('twelve_tribes', 'Twelve Tribes', 'Rastafari mesianico, bienes comunes, dieta Ital, agricultura organica.', 'cristiana', 'star', true,
 '{"node_name":"Comunidad Twelve Tribes","commerce_schedule":[{"name":"Sabbath","day_of_week":5,"start_time":"18:00","end_time":"18:00","crosses_midnight":true,"end_day_of_week":6,"block_type":"block_all","block_message":"Santificando el Sabbath."}],"commerce_hours_enabled":true,"public_settings":{"footer_schedule":"Dieta Ital, bienes comunes"},"colors":{"primary":"#15803d"}}'),
-- 9. Muridiyya / Baye Fall
('baye_fall', 'Muridiyya / Baye Fall (Senegal)', 'El trabajo es oracion. Oasis en el Sahel, agricultura organica, solar.', 'islamica', 'sun', true,
 '{"node_name":"Daara Baye Fall","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Trabajo como oracion - actividad continua"},"colors":{"primary":"#b45309"}}'),
-- 10. Kibbutz Lotan
('kibbutz', 'Kibbutz Lotan (Eco-judaismo)', 'Permacultura en desierto, Tikkun Olam, Shabbat como concepto eco-judio, eco-kashrut.', 'judia', 'sprout', true,
 '{"node_name":"Kibbutz Ecologico","commerce_schedule":[{"name":"Shabbat","day_of_week":5,"start_time":"18:00","end_time":"19:00","crosses_midnight":true,"end_day_of_week":6,"block_type":"block_all","block_message":"Shabbat Shalom. Las transacciones se reanudaran al ponerse el sol del sabado."}],"commerce_hours_enabled":true,"public_settings":{"footer_schedule":"Shabbat: viernes a sabado al ponerse el sol"},"colors":{"primary":"#0ea5e9"}}'),
-- 11. ISKCON / Hare Krishna
('iskcon', 'ISKCON / Hare Krishna', 'Simple living high thinking, proteccion de vacas, filtros dieteticos (sin carne, huevo, ajo, cebolla, cafe, alcohol).', 'hindu', 'leaf', true,
 '{"node_name":"Granja Krishna","commerce_schedule":[],"commerce_hours_enabled":false,"catalog_rules":[{"category":"carne","is_prohibited":true,"reason":"No se consume carne en ISKCON"},{"category":"huevos","is_prohibited":true,"reason":"No se consumen huevos"},{"category":"ajo","is_prohibited":true,"reason":"Modo de la pasion"},{"category":"cebolla","is_prohibited":true,"reason":"Modo de la pasion"},{"category":"cafe","is_prohibited":true,"reason":"Estimulante"},{"category":"alcohol","is_prohibited":true,"reason":"Intoxicante"}],"public_settings":{"footer_schedule":"Simple living, high thinking"},"colors":{"primary":"#ca8a04"}}'),
-- 12. Plum Village (Budistas)
('plum_village', 'Plum Village (Budistas)', 'Happy Farms organicas, mindfulness en agricultura, veganismo, Engaged Buddhism.', 'budista', 'heart', true,
 '{"node_name":"Aldea del Ciruelo","commerce_schedule":[],"commerce_hours_enabled":false,"catalog_rules":[{"category":"carne","is_prohibited":true,"reason":"Dieta vegana - no violencia hacia animales"},{"category":"pescado","is_prohibited":true,"reason":"Dieta vegana"},{"category":"alcohol","is_prohibited":true,"reason":"Preceptos budistas"}],"public_settings":{"footer_schedule":"Mindfulness en cada accion"},"colors":{"primary":"#be185d"}}'),
-- 13. Sikh / Khalsa Garden
('sikh', 'Sikh - Khalsa Garden', 'Langar organico, seva (servicio desinteresado), agricultura para comunidad.', 'sikh', 'wheat', true,
 '{"node_name":"Khalsa Garden","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Langar: comida para todos, seva continua"},"colors":{"primary":"#f59e0b"}}'),
-- 14. Bahá'í Adasiyyih
('bahai', 'Bahai - Adasiyyih', 'Agricultura como base fundamental de la comunidad. Modelo de granja de Abdu l-Baha.', 'bahai', 'globe', true,
 '{"node_name":"Comunidad Bahai","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Agricultura como base de la comunidad"},"colors":{"primary":"#0891b2"}}'),
-- 15. Andinos (Ayllu/Ayni)
('andino', 'Andinos - Ayllu/Ayni/Minka', 'Reciprocidad andina: ayni (trabajo reciproco), minka (trabajo colectivo), trueque chhalaku.', 'indigena', 'mountain', true,
 '{"node_name":"Ayllu Andino","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Feria de trueque y minga comunitaria"},"colors":{"primary":"#a16207"}}'),
-- 16. Mesoamericanos (Milpa)
('mesoamericano', 'Mesoamericanos - Milpa/Toltecayotl', 'Milpa (maiz+frijol+calabaza), metepantle, soberania alimentaria.', 'indigena', 'sprout', true,
 '{"node_name":"Comunidad Milpera","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Tianguis de trueque semanal"},"colors":{"primary":"#92400e"}}'),
-- 17. Ubuntu / Ujamaa
('ubuntu', 'Ubuntu / Ujamaa (Tanzania)', 'Communalismo africano, igualdad, villagizacion. Soy porque nosotros somos.', 'africana', 'users', true,
 '{"node_name":"Aldea Ujamaa","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Ubuntu: soy porque nosotros somos"},"colors":{"primary":"#b45309"}}'),
-- 18. Findhorn
('findhorn', 'Findhorn (Escocia)', 'Co-creacion con inteligencias de la naturaleza, devas, CSA organico-biodinamico.', 'new_age', 'sparkles', true,
 '{"node_name":"Ecoaldea Findhorn","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"CSA organico-biodinamico semanal"},"colors":{"primary":"#16a34a"}}'),
-- 19. Ecoaldeas espirituales
('ecosalde_espiritual', 'Ecoaldeas Espirituales', 'Yoga, permacultura, ceremonias, retiros. InanItah, PachaMama, WuWei.', 'new_age', 'sun', true,
 '{"node_name":"Ecoaldea Espiritual","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Retiros y permacultura"},"colors":{"primary":"#db2777"}}'),
-- 20. Wiccan / Druida
('pagano', 'Wiccan / Druida / Pagano', 'Wheel of the Year (8 sabbats), agricultura por ciclos estacionales.', 'pagana', 'moon', true,
 '{"node_name":"Comunidad Pagana","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Celebracion de los 8 sabbats del Wheel of the Year"},"colors":{"primary":"#6d28d9"}}'),
-- 21. Transition Towns
('transition_town', 'Transition Towns', 'Permacultura, moneda local, relocalizacion, resiliencia comunitaria.', 'ecologica', 'tree-pine', true,
 '{"node_name":"Transition Town","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Mercado local semanal de trueque"},"colors":{"primary":"#65a30d"}}'),
-- 22. GEN - Ecoaldeas seculares
('gen_ecoaldea', 'GEN - Ecoaldea Secular', 'Sociocracia, cayapas (trabajo comunitario), FRNE, permacultura.', 'ecologica', 'leaf', true,
 '{"node_name":"Ecoaldea GEN","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Asambleas de consentimiento sociocratico"},"colors":{"primary":"#0d9488"}}'),
-- 23. Feria Conuquera (preset especial - NO se usa para instalar, solo referencia)
('feria_conuquera', 'Feria Conuquera (referencia)', 'Nodo real existente. Primer sabado de cada mes. NO modificar.', 'existente', 'sprout', false,
 '{"node_name":"Feria Conuquera","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{"footer_schedule":"Primer sabado de cada mes (9:00 AM a 1:00 PM). Venta en moneda local."},"colors":{"primary":"#16a34a"}}'),
-- 24. Vacio (sin datos)
('vacio', 'Vacio (sin datos preconfigurados)', 'Instalar el nodo sin ninguna preconfiguracion. Todo se configura manualmente.', 'general', 'circle', false,
 '{"node_name":"","commerce_schedule":[],"commerce_hours_enabled":false,"public_settings":{},"colors":{}}')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_node_presets_category ON node_presets (category, is_active);
CREATE INDEX IF NOT EXISTS idx_node_presets_active ON node_presets (is_active) WHERE is_active = true;
