-- Migracion 064: Nuevas normas de convivencia inspiradas en filosofia de comunidad intencional
--
-- El texto de referencia menciona muchos elementos que enriquecen la
-- vision de la aldea mas alla de lo economico y agroecologico:
-- - Unidades productivas diversas (no solo agricultura)
-- - Bienestar comunitario (meditacion, yoga, fuego compartido)
-- - Aprendizaje intergeneracional
-- - Trabajo remoto / coworking
-- - Turismo rural comunitario
-- - Voluntariado e intercambio de conocimientos
-- - Medicina natural y autocuidado
-- - Transformacion de alimentos
-- - Emprendimientos comunitarios
-- - Filosofia de cooperacion vs competencia

-- ===== NUEVA CATEGORIA: Unidades Productivas =====
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type)
VALUES
('localhost', 'unidades_productivas', 'Diversificacion Productiva', 'La sostenibilidad economica de la aldea se basa en multiples unidades productivas, no en una sola. Estas incluyen: agricultura agroecologica, transformacion de alimentos, productos naturales, turismo rural, bienestar, formacion y talleres. La diversificacion protege a la comunidad de crisis externas.', 'info', 'briefcase', 1, 'informativo'),
('localhost', 'unidades_productivas', 'Transformacion de Alimentos', 'La aldea transforma sus propios alimentos: conservas, fermentados, harinas, aceites, jabones, medicina natural. La transformacion agrega valor y genera ingresos para sostener la comunidad. Cada miembro puede proponer nuevas lineas de transformacion.', 'info', 'package', 2, 'permiso'),
('localhost', 'unidades_productivas', 'Emprendimientos Comunitarios', 'Los miembros pueden desarrollar pequenos emprendimientos que generen ingresos para la comunidad, con aprobacion de la asamblea. Los emprendimientos deben alinearse con los valores de cooperacion, regeneracion y economia solidaria. No se permite la competencia desleal entre miembros.', 'info', 'trending-up', 3, 'permiso'),
('localhost', 'unidades_productivas', 'Turismo Rural Comunitario', 'La aldea puede recibir visitantes y ofrecer experiencias de turismo rural: talleres de agroecologia, caminatas, gastronomia local, estancias. Los ingresos del turismo van al Fondo Comunitario y a las unidades productivas involucradas. El turismo debe respetar la intimidad y el ritmo de vida de la comunidad.', 'info', 'map-pin', 4, 'permiso'),
('localhost', 'unidades_productivas', 'Autosuficiencia Progresiva', 'La meta es que la comunidad produzca, genere valor y pueda financiar progresivamente su propia vida. No se trata de depender eternamente de inversionistas externos. Cada unidad productiva debe tender hacia la autosuficiencia y el excedente se reinvierte en la comunidad.', 'info', 'target', 5, 'informativo'),
('localhost', 'unidades_productivas', 'Prohibicion de Competencia Interna', 'Esta prohibido que un miembro compita deslealmente con otro en la comercializacion de productos similares. La cooperacion va antes que la competencia. Si dos miembros producen lo mismo, deben coordinar precios y canales de venta.', 'leve', 'x-circle', 6, 'prohibicion')
ON CONFLICT DO NOTHING;

-- ===== NUEVA CATEGORIA: Bienestar Comunitario =====
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type)
VALUES
('localhost', 'bienestar', 'Espacios de Bienestar', 'La aldea cuenta con espacios para meditacion, yoga, bienestar y encuentro. Estos espacios son de uso comunitario y estan abiertos a todos los miembros. Su mantenimiento es responsabilidad compartida.', 'info', 'heart', 1, 'permiso'),
('localhost', 'bienestar', 'Fuego Comunitario', 'El fuego compartido es un espacio sagrado de encuentro. Alrededor del fuego cocinamos juntos, aprendemos, celebramos y tomamos decisiones informales. Se mantiene al menos una fogata comunitaria semanal.', 'info', 'flame', 2, 'informativo'),
('localhost', 'bienestar', 'Medicina Natural y Autocuidado', 'La aldea promueve el conocimiento y uso de medicina natural: plantas medicinales, preventivo, alimentacion consciente. Se recuperan saberes ancestrales de la medicina tradicional. La medicina natural no sustituye la atencion medica profesional cuando es necesaria.', 'info', 'leaf', 3, 'deber'),
('localhost', 'bienestar', 'Salud Mental Comunitaria', 'La salud mental es responsabilidad colectiva. Se fomenta la escucha activa, la mediacion de conflictos y el apoyo mutuo. El Circulo de Convivencia ofrece espacios de escucha y mediacion cuando un miembro lo necesita.', 'info', 'users', 4, 'informativo'),
('localhost', 'bienestar', 'Cocina Compartida', 'La aldea tiene una cocina comunitaria donde los miembros pueden cocinar juntos, compartir recetas y preparar alimentos para eventos. Cocinar juntos es una forma de construir comunidad y transmitir conocimientos culinarios.', 'info', 'utensils', 5, 'permiso')
ON CONFLICT DO NOTHING;

-- ===== NUEVA CATEGORIA: Aprendizaje y Conocimiento =====
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type)
VALUES
('localhost', 'aprendizaje', 'Aprendizaje Intergeneracional', 'La aldea es un espacio de aprendizaje para todas las edades: ninos, jovenes y adultos. Los mayores transmiten saberes del campo, los jovenes aportan conocimientos tecnicos. El aprendizaje fluye en todas las direcciones.', 'info', 'book-open', 1, 'informativo'),
('localhost', 'aprendizaje', 'Educacion de Ninos y Jovenes', 'La aldea crea espacios de aprendizaje para ninos y jovenes: huertos educativos, talleres de bioconstruccion, cocina, arte, musica, naturaleza. La educacion es integral y practica, no solo academica.', 'info', 'graduation-cap', 2, 'deber'),
('localhost', 'aprendizaje', 'Recuperacion de Saberes Ancestrales', 'Cada miembro debe participar en la recuperacion y transmision de conocimientos del campo: siembra por fases lunares, pronostico natural del clima, medicina tradicional, tecnicas de conservacion de semillas. Estos saberes se documentan y comparten.', 'info', 'sprout', 3, 'deber'),
('localhost', 'aprendizaje', 'Talleres y Formacion', 'La aldea organiza talleres abiertos sobre agroecologia, bioconstruccion, energia solar, transformacion de alimentos, medicina natural y otras habilidades. Los talleres pueden ser internos o abiertos al publico.', 'info', 'presentation', 4, 'permiso'),
('localhost', 'aprendizaje', 'Trabajo Remoto y Coworking', 'La aldea cuenta con espacios equipados para trabajo remoto (internet, electricidad, escritorios). Los miembros que trabajan remotamente pueden usar estos espacios. Se fomenta que el trabajo remoto sea compatible con la vida comunitaria.', 'info', 'laptop', 5, 'permiso')
ON CONFLICT DO NOTHING;

-- ===== NUEVA CATEGORIA: Convivencia y Cultura =====
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type)
VALUES
('localhost', 'convivencia', 'Cooperacion sobre Competencia', 'La comunidad se basa en cooperacion y no en competencia. En regeneracion y no en explotacion. En colaboracion y no en aislamiento. En pertenencia y no solamente en propiedad. Estos son los valores fundamentales que guian todas las decisiones.', 'info', 'heart', 1, 'informativo'),
('localhost', 'convivencia', 'Aporte Reciproco', 'Cada persona tiene algo que aportar y tambien algo que recibir. No se busca personas que quieran simplemente "vivir gratis en el campo". Se busca companeros de camino: personas dispuestas a trabajar, aprender, compartir responsabilidades, respetar los acuerdos y participar en la construccion colectiva.', 'info', 'repeat', 2, 'informativo'),
('localhost', 'convivencia', 'Voluntariado e Intercambio', 'La aldea recibe voluntarios y personas de otros lugares para intercambiar conocimientos y experiencias. Los voluntarios participan en cayapas y talleres. El intercambio enriquece a la comunidad y a los visitantes.', 'info', 'globe', 3, 'permiso'),
('localhost', 'convivencia', 'Celebraciones Comunitarias', 'La aldea celebra juntos: cosechas, equinoccios, cumpleanos, logros colectivos. Las celebraciones fortalecen los lazos comunitarios. Cada miembro puede proponer y organizar celebraciones.', 'info', 'party-popper', 4, 'permiso'),
('localhost', 'convivencia', 'Respeto al Ritmo de Vida', 'La aldea tiene un ritmo de vida distinto al de la ciudad. Se respeta el silencio, los tiempos de descanso, la contemplacion. No se impone el ritmo acelerado urbano. Cada miembro encuentra su propio ritmo en armonia con la comunidad.', 'info', 'sun', 5, 'informativo'),
('localhost', 'convivencia', 'Prohibicion del Aprovechamiento', 'Esta prohibido aprovecharse del trabajo de otros miembros sin reciprocidad. La comunidad no es un lugar para vivir a costa del esfuerzo ajeno. Quien no aporte sin justificacion sera objeto de revision por el Circulo de Convivencia.', 'grave', 'x-circle', 6, 'prohibicion')
ON CONFLICT DO NOTHING;

-- ===== Ampliar deberes existentes =====
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type)
VALUES
('localhost', 'deberes', 'Crianza Responsable de Animales', 'Los animales de la aldea son criados de manera responsable y respetuosa. Se garantiza bienestar, espacio adecuado, alimentacion natural y trato digno. La crianza es para autoconsumo y excedente comunitario, no para explotacion comercial intensiva.', 'info', 'paw-print', 6, 'deber'),
('localhost', 'deberes', 'Cuidado del Agua', 'El agua es un bien sagrado. Cada miembro debe cuidar las fuentes de agua, evitar la contaminacion y usar sistemas de aprovechamiento (captacion de lluvia, biofiltros, reutilizacion de aguas grises). El desperdicio de agua es una falta grave.', 'info', 'droplets', 7, 'deber')
ON CONFLICT DO NOTHING;

-- ===== Ampliar permitido existente =====
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type)
VALUES
('localhost', 'permitido', 'Bioconstruccion Comunitaria', 'Se permite construir viviendas y espacios sostenibles con materiales locales de baja huella de carbono: adobe, tapia, bahareque, madera certificada, bambu, techos verdes o de paja. Los miembros pueden construir colectivamente sus viviendas mediante cayapas de construccion.', 'info', 'home', 7, 'permiso'),
('localhost', 'permitido', 'Energias Limpias', 'Se permite y fomenta el uso de energias limpias: solar, eolica, microhidraulica. La aldea cuenta con una microrred energetica comunitaria. Cada vivienda puede instalar paneles solares individuales conectados a la microrred.', 'info', 'sun', 8, 'permiso')
ON CONFLICT DO NOTHING;
