-- Migracion 048: Tabla de reglas de gobernanza (Ley de la Aldea)
--
-- Crea una tabla editable por el admin donde se definen las reglas
-- de convivencia: que esta permitido, que esta prohibido, deberes,
-- estructura de gobernanza, impuestos, proceso de admision y salida.
--
-- Las reglas se muestran:
-- - En la pagina publica /p/gobernanza
-- - En el formulario de admision (aceptacion obligatoria)
-- - En el panel del miembro despues de unirse

CREATE TABLE IF NOT EXISTS governance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain TEXT NOT NULL DEFAULT 'localhost',
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  icon TEXT NOT NULL DEFAULT 'info',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_rules_node ON governance_rules (node_domain, category, is_active);
CREATE INDEX IF NOT EXISTS idx_governance_rules_order ON governance_rules (node_domain, sort_order);

-- Categorias:
-- estructura    - Como se gobierna la aldea
-- deberes       - Obligaciones de los miembros
-- permitido     - Lo que se puede hacer
-- prohibido     - Lo que no se puede hacer
-- faltas_leves  - Infracciones leves y sanciones
-- faltas_graves - Infracciones graves y sanciones
-- faltas_muy_graves - Causales de expulsion
-- admision      - Proceso para unirse
-- salida        - Proceso de retiro y restitucion
-- impuestos     - Como funcionan los impuestos
-- tierra        - Tenencia de la tierra

-- Seed inicial: Ley de la Aldea
-- Estructura de gobernanza
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order) VALUES
('localhost', 'estructura', 'Asamblea General', 'La Asamblea General es el organo maximo de decision. Se reune mensualmente y todos los miembros plenos tienen voz y voto. Las decisiones se toman por consentimiento sociocratico: una propuesta se aprueba cuando nadie presenta una objecion razonada de que cause dano al proposito de la aldea. El lema es: "Suficientemente bueno por ahora, seguro para intentar".', 'info', 'users', 1),
('localhost', 'estructura', 'Circulos Operativos', 'La gobernanza se divide en circulos semi-autonomos vinculados a los departamentos del sistema: Circulo de Agua y Tierra, Circulo de Habitabilidad, Circulo de Agroecologia, Circulo de Economia Solidaria, Circulo de Convivencia y Admisiones. Cada circulo gestiona su area sin esperar aprobacion de la asamblea para decisiones operativas.', 'info', 'circle', 2),
('localhost', 'estructura', 'Junta Directiva del Nodo', 'La Junta Directiva es el organo ejecutivo del nodo. Se compone de miembros elegidos por consentimiento de la asamblea. Sus cargos incluyen: Coordinador General, Tesorero, Secretario, y Coordinadores de cada circulo. Los cargos duran 1 ano y son revocables por la asamblea.', 'info', 'briefcase', 3),
('localhost', 'estructura', 'Doble Enlace Sociocratico', 'Cada circulo elige dos personas que lo conectan con la Asamblea General: un Coordinador (que lleva informacion de arriba hacia abajo) y un Delegado (que lleva las inquietudes del circulo hacia la asamblea). Esto garantiza que la informacion fluya bidireccionalmente.', 'info', 'link', 4),
('localhost', 'estructura', 'Organizaciones', 'Las organizaciones son colectivos de produccion, consumo o servicios registrados en el sistema. Pueden ser: Grupo de Produccion, Grupo de Consumo, Comision, Proyecto, Institucion Publica o Cooperativa. Tienen su propia junta directiva y limites de saldo simetricos mas amplios.', 'info', 'building', 5),
('localhost', 'estructura', 'Departamentos', 'Los departamentos son unidades administrativas con roles y permisos especificos. Cada departamento tiene un jefe, miembros asignados y roles con permisos granulares. Los departamentos se mapean a los circulos operativos.', 'info', 'folder', 6),

-- Deberes
('localhost', 'deberes', 'Produccion Agroecologica', 'Toda siembra en conucos familiares y comunes debe ser 100% agroecologica: libre de agrotquimicos y semillas transgenicas. Solo se permite compost, bioinsumos, microorganismos eficientes y abonos verdes.', 'info', 'leaf', 1),
('localhost', 'deberes', 'Cayapa Semanal (Trabajo Comunitario)', 'Cada miembro adulto debe aportar un minimo de 12 horas semanales de trabajo en proyectos comunes: mantenimiento de caminos, siembra comunitaria, cuidado de animales, reparacion de la microrred o cocina comun. Estas horas se registran en la cuenta TQ.', 'info', 'tool', 2),
('localhost', 'deberes', 'Uso Exclusivo de TQ', 'Todo intercambio comercial dentro de la aldea debe realizarse exclusivamente mediante la plataforma contable TQ. No se permite usar dinero fiat (bolivares, dolares) para transacciones internas.', 'info', 'coins', 3),
('localhost', 'deberes', 'Banco Comunitario de Semillas', 'Cada miembro debe participar en el Banco de Semillas devolviendo un porcentaje superior de semillas nativas tras cada cosecha para que la reserva crezca.', 'info', 'sprout', 4),
('localhost', 'deberes', 'Asistencia a Asambleas', 'La asistencia a las asambleas mensuales es obligatoria. Tres faltas injustificadas consecutivas son una falta leve.', 'info', 'calendar', 5),

-- Permitido
('localhost', 'permitido', 'Bioconstruccion', 'Se permite construir viviendas con materiales locales de baja huella de carbono: adobe, tapia, bahareque, madera certificada, bambu, techos verdes o de paja. El diseño debe ser bioclimatico (ventilacion natural, captacion solar pasiva).', 'info', 'home', 1),
('localhost', 'permitido', 'Banos Secos Composteros', 'El uso de banos secos composteros es obligatorio para todas las viviendas. Las aguas grises deben tratarse con biofiltros de plantas (humedales artificiales).', 'info', 'droplets', 2),
('localhost', 'permitido', 'Microrred Solar', 'Se permite el abastecimiento energetico a traves de la microrred solar e hidraulica de la aldea. Cada vivienda tiene un limite de consumo asignado.', 'info', 'sun', 3),
('localhost', 'permitido', 'Comercio con TQ', 'Se permite comprar y vender libremente dentro de la aldea usando TQ, respetando los limites de saldo simetricos (-500/+500 para nuevos, -1000/+1000 para activos).', 'info', 'shopping-cart', 4),
('localhost', 'permitido', 'Crear Organizaciones', 'Los miembros plenos pueden crear organizaciones de produccion, consumo o servicios con aprobacion de la asamblea.', 'info', 'plus', 5),
('localhost', 'permitido', 'Federacion entre Nodos', 'Se permite el comercio federado con otras ecoaldeas de la red usando TQ, respetando los limites bilaterales establecidos.', 'info', 'globe', 6),

-- Prohibido
('localhost', 'prohibido', 'Agroquimicos y Transgenicos', 'Esta estrictamente prohibido el ingreso, uso o almacenamiento de fertilizantes quimicos sinteticos, pesticidas industriales o semillas transgenicas patentadas.', 'grave', 'x-circle', 1),
('localhost', 'prohibido', 'Venta de Tierra', 'Ningun miembro puede vender su parcela o vivienda a un tercero en el mercado abierto. La tierra pertenece colectivamente a la comunidad organizada (Fideicomiso de la Tierra).', 'grave', 'x-circle', 2),
('localhost', 'prohibido', 'Usura e Intereses', 'Esta prohibido cobrar intereses sobre deudas, prestar con usura o negociar con divisas fiat de forma directa en transacciones internas eludiendo el sistema TQ.', 'grave', 'x-circle', 3),
('localhost', 'prohibido', 'Acumular mas alla del limite', 'Esta prohibido eludir el control de limites de saldo con intercambios informales fuera del sistema para acumular mas de lo permitido.', 'grave', 'x-circle', 4),
('localhost', 'prohibido', 'Quema de plasticos', 'Esta prohibida la quema de cualquier tipo de plastico o basura. Los empaques plasticos de un solo uso deben evitarse al maximo.', 'leve', 'x-circle', 5),
('localhost', 'prohibido', 'Productos no biodegradables', 'Esta prohibido el uso de productos de higiene personal o limpieza del hogar que contengan quimicos no biodegradables. La aldea provee jabones y detergentes ecologicos.', 'leve', 'x-circle', 6),

-- Faltas leves
('localhost', 'faltas_leves', 'Faltar a asambleas', 'Faltar injustificadamente a las asambleas mensuales. Sancion: amonestacion verbal y compromiso de compensar las horas perdidas en la siguiente cayapa.', 'leve', 'alert-triangle', 1),
('localhost', 'faltas_leves', 'No cumplir cayapa', 'No cumplir de forma aislada con las horas de trabajo comunitario semanal. Sancion: compensar las horas pendientes en la siguiente semana.', 'leve', 'alert-triangle', 2),
('localhost', 'faltas_leves', 'Ruidos fuera de horario', 'Hacer ruidos molestos fuera del horario de silencio (10:00 PM a 6:00 AM). Sancion: amonestacion verbal del Circulo de Convivencia.', 'leve', 'alert-triangle', 3),

-- Faltas graves
('localhost', 'faltas_graves', 'Desperdicio de agua comun', 'Desperdicio consciente del agua comun de la aldea. Sancion: suspension temporal de la capacidad de comprar en la Tienda Comunitaria y jornadas de trabajo extra.', 'grave', 'alert-octagon', 1),
('localhost', 'faltas_graves', 'Comercio con fiat', 'Comercio no autorizado usando dinero fiat (bolivares o dolares) dentro de la aldea para eludir el sistema TQ. Sancion: bloqueo temporal de cuenta TQ y jornadas obligatorias.', 'grave', 'alert-octagon', 2),
('localhost', 'faltas_graves', 'Maltrato animal', 'Maltrato a animales de la aldea. Sancion: suspension temporal y mediacion del Circulo de Armonia.', 'grave', 'alert-octagon', 3),
('localhost', 'faltas_graves', 'Inactividad prolongada', 'Dejar de producir en el conuco o ausentarse de las jornadas de trabajo comun por mas de 3 meses sin justificacion. Sancion: revision de membresia por la asamblea.', 'grave', 'alert-octagon', 4),

-- Faltas muy graves (expulsion)
('localhost', 'faltas_muy_graves', 'Introducir agrotquimicos', 'Introduccion voluntaria de agrotquimicos o semillas transgenicas. Causal de expulsion obligatoria.', 'muy_grave', 'ban', 1),
('localhost', 'faltas_muy_graves', 'Agresion fisica o verbal grave', 'Agresion fisica o verbal grave a cualquier miembro de la comunidad. Causal de expulsion.', 'muy_grave', 'ban', 2),
('localhost', 'faltas_muy_graves', 'Robo de bienes comunes', 'Robo verificado de bienes comunes o conucos vecinos. Causal de expulsion.', 'muy_grave', 'ban', 3),
('localhost', 'faltas_muy_graves', 'Sabotaje tecnico', 'Sabotaje a los sistemas comunes (agua, energia, microrred). Causal de expulsion.', 'muy_grave', 'ban', 4),
('localhost', 'faltas_muy_graves', 'Especulacion inmobiliaria', 'Acumulacion o especulacion con el valor de la vivienda o el terreno. Causal de expulsion.', 'muy_grave', 'ban', 5),

-- Admision
('localhost', 'admision', 'Fase 1: Aspirante (1-3 meses)', 'La persona o familia vive en el area de visitantes. Participa diariamente en cayapas comunes y talleres de agroecologia. Tiene acceso limitado a la Tienda Comunitaria en TQ (cuenta de visitante con limite estricto). No puede construir.', 'info', 'user-plus', 1),
('localhost', 'admision', 'Fase 2: Residente Provisional (6-12 meses)', 'Tras recibir el consentimiento de la comunidad, se le asigna un espacio temporal. Se integra a un circulo de trabajo. Puede proponer ideas (voz) pero no tiene voto en decisiones estructurales.', 'info', 'user-check', 2),
('localhost', 'admision', 'Fase 3: Miembro Pleno (Conuquero Federado)', 'Aprobado por consentimiento en el Circulo de Convivencia y refrendado en Asamblea General. Se firma el Acuerdo de Vida Conuquera, se le asigna parcela y conuco, y se abren los limites completos de TQ (-500/+500 simetricos).', 'info', 'award', 3),

-- Salida
('localhost', 'salida', 'Retiro Voluntario', 'Un miembro puede retirarse voluntariamente comunicando su decision al Circulo de Convivencia. Se aplica la Formula de Restitucion No Especulativa (FRNE) para reembolsar su inversion en materiales.', 'info', 'log-out', 1),
('localhost', 'salida', 'Formula de Restitucion No Especulativa (FRNE)', 'R_neto = I_ini - D_desgaste - C_restauracion +/- B_TQ - T_salida. Donde I_ini = inversion en materiales, D_desgaste = amortizacion anual, C_restauracion = costo de reparar danos, B_TQ = balance TQ, T_salida = 15% de retencion solidaria para el Fondo Comunitario.', 'info', 'calculator', 2),
('localhost', 'salida', 'Pago Diferido', 'El reembolso se paga en cuotas mensuales distribuidas en 12-24 meses usando el Factor de Conversion vigente, o cuando una nueva familia tome posesion de la parcela. No se paga de inmediato para no desestabilizar la economia del nodo.', 'info', 'calendar', 3),
('localhost', 'salida', 'Expulsion', 'Si el Circulo de Armonia agota la mediacion y el miembro reincide en faltas graves o comete una falta muy grave, la Asamblea General decide por consentimiento la desincorporacion. El terreno y usufructo regresan inmediatamente al control comun.', 'grave', 'user-x', 4),

-- Impuestos
('localhost', 'impuestos', 'Impuesto de Transaccion', 'Cada transaccion en TQ tiene un porcentaje de impuesto definido por el nivel del miembro (ej: 1% para activos, 0% para instituciones publicas). El impuesto va al Fondo Comunitario.', 'info', 'percent', 1),
('localhost', 'impuestos', 'Fondo Comunitario', 'El Fondo Comunitario es una cuenta especial que recibe los impuestos y se usa para proyectos comunales aprobados por la asamblea: infraestructura, equipos, emergencias.', 'info', 'piggy-bank', 2),
('localhost', 'impuestos', 'Aprobacion de Gastos', 'Los gastos del Fondo Comunitario deben ser aprobados por la asamblea (mayoria simple). Los cambios a la tasa de impuesto requieren 2/3 de la asamblea.', 'info', 'check-square', 3),

-- Tierra
('localhost', 'tierra', 'Fideicomiso Comunitario de la Tierra', 'La tierra de la ecoaldea pertenece unica y exclusivamente a la comunidad organizada. Ningun miembro tiene titulo de propiedad individual sobre la tierra. Es indivisible e inalienable.', 'info', 'map', 1),
('localhost', 'tierra', 'Derecho de Usufructo', 'A cada miembro o familia admitida se le otorga un derecho de usufructo exclusivo sobre una parcela habitacional y su conuco. Este derecho dura mientras mantenga su membresia activa.', 'info', 'key', 2),
('localhost', 'tierra', 'Prohibicion de Venta Directa', 'Un habitante nunca puede vender su parcela o vivienda a un tercero en el mercado abierto. Si decide marcharse, el derecho de usufructo regresa a la Asamblea, que lo asigna a una nueva familia.', 'grave', 'lock', 3)
ON CONFLICT DO NOTHING;

-- Permiso para gestionar reglas de gobernanza
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'governance.manage', 'Gestionar reglas de gobernanza (Ley de la Aldea)', 'admin', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'governance.manage');
