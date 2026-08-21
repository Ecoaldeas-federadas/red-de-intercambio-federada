-- Migracion 071: Reglas de gobernanza sobre organizaciones, servicios y juntas directivas
--
-- Agrega reglas publicas sobre:
-- - Organizaciones de la Asamblea
-- - Servicios de organizaciones (mensualidades, cobros, pagos)
-- - Juntas directivas con reuniones propias
-- - Impuestos por nivel

INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, is_active)
SELECT 'localhost', cat, title, desc_text, sev, icon, sort, true
FROM (VALUES
  -- ===== Estructura: Organizaciones de la Asamblea =====
  ('estructura', 'Organizaciones de la Asamblea',
   'La Asamblea puede crear organizaciones que le pertenecen. Todos los miembros del nodo son automaticamente miembros de estas organizaciones. Sus decisiones se votan en la Asamblea General.',
   'info', 'Users', 10),
  ('estructura', 'Junta Directiva de Organizaciones',
   'Cada organizacion tiene su propia junta directiva con reuniones, votaciones y actas separadas. La junta toma decisiones operativas que no requieren aprobacion de la asamblea.',
   'info', 'Crown', 11),
  ('estructura', 'Dos Espacios de Decision',
   'Cada organizacion tiene dos espacios de decision: la Asamblea (todos los miembros) y la Junta Directiva (solo directivos). Ambos tienen sesiones, propuestas, votaciones, actas y asistencia.',
   'info', 'Users', 12),

  -- ===== Unidades Productivas: Servicios =====
  ('unidades_productivas', 'Servicios de Organizaciones',
   'Las organizaciones pueden ofrecer servicios: mensualidades, cobros, pagos a miembros, o servicios gratuitos. Cada servicio define obligaciones, derechos y deberes.',
   'info', 'FileText', 5),
  ('unidades_productivas', 'Servicios Obligatorios',
   'Los servicios obligatorios aplican a todos los miembros. En organizaciones de la Asamblea, todos los miembros del nodo deben pagar. En organizaciones regulares, requieren votacion de los miembros.',
   'info', 'CheckCircle', 6),
  ('unidades_productivas', 'Servicios Voluntarios',
   'Los servicios voluntarios permiten a cada miembro suscribirse o cancelar libremente. Ningun miembro esta obligado a usar un servicio voluntario.',
   'info', 'CheckCircle', 7),
  ('unidades_productivas', 'Servicios que Pagan al Miembro',
   'Algunas organizaciones pagan a sus miembros mensualmente por trabajo o servicios prestados. El monto se transfiere automaticamente cada mes.',
   'info', 'Coins', 8),
  ('unidades_productivas', 'Servicios Gratuitos',
   'Los servicios pueden ser gratuitos (monto cero). En ese caso, solo se registra la membresia sin cobro. Por ejemplo, una cuota por ser miembro puede ser gratuita.',
   'info', 'Info', 9),
  ('unidades_productivas', 'Cobro Automatico Mensual',
   'El sistema cobra o paga automaticamente los servicios activos segun la frecuencia configurada (mensual, trimestral, anual). Los miembros reciben notificaciones de cada cobro.',
   'info', 'Calendar', 10),

  -- ===== Impuestos: Por Nivel =====
  ('impuestos', 'Impuestos por Nivel de Miembro',
   'Cada nivel de miembro tiene su propia tasa de impuesto. Los miembros nuevos (brote) pagan mas, los fundadores (raiz) pagan menos, como incentivo para ascender.',
   'info', 'Percent', 5),
  ('impuestos', 'Impuestos por Nivel de Organizacion',
   'Las organizaciones pagan impuestos segun su nivel. Las instituciones publicas estan exentas (0%). Las de produccion pagan 2%, las de consumo 1%.',
   'info', 'Percent', 6),
  ('impuestos', 'Destino de los Impuestos',
   'Todos los impuestos llegan automaticamente a la cuenta de la Asamblea. La Asamblea decide a donde distribuir ese dinero mediante propuestas de distribucion de fondos.',
   'info', 'PiggyBank', 7)
) AS t(cat, title, desc_text, sev, icon, sort)
WHERE NOT EXISTS (
  SELECT 1 FROM governance_rules
  WHERE node_domain = 'localhost' AND title = t.title
);

-- Tambien insertar para otros nodos existentes (distintos de localhost)
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, is_active)
SELECT DISTINCT u.node_domain, t.cat, t.title, t.desc_text, t.sev, t.icon, t.sort, true
FROM users u
CROSS JOIN (VALUES
  ('estructura', 'Organizaciones de la Asamblea',
   'La Asamblea puede crear organizaciones que le pertenecen. Todos los miembros del nodo son automaticamente miembros de estas organizaciones. Sus decisiones se votan en la Asamblea General.',
   'info', 'Users', 10),
  ('estructura', 'Junta Directiva de Organizaciones',
   'Cada organizacion tiene su propia junta directiva con reuniones, votaciones y actas separadas. La junta toma decisiones operativas que no requieren aprobacion de la asamblea.',
   'info', 'Crown', 11),
  ('estructura', 'Dos Espacios de Decision',
   'Cada organizacion tiene dos espacios de decision: la Asamblea (todos los miembros) y la Junta Directiva (solo directivos). Ambos tienen sesiones, propuestas, votaciones, actas y asistencia.',
   'info', 'Users', 12),
  ('unidades_productivas', 'Servicios de Organizaciones',
   'Las organizaciones pueden ofrecer servicios: mensualidades, cobros, pagos a miembros, o servicios gratuitos. Cada servicio define obligaciones, derechos y deberes.',
   'info', 'FileText', 5),
  ('unidades_productivas', 'Servicios Obligatorios',
   'Los servicios obligatorios aplican a todos los miembros. En organizaciones de la Asamblea, todos los miembros del nodo deben pagar. En organizaciones regulares, requieren votacion de los miembros.',
   'info', 'CheckCircle', 6),
  ('unidades_productivas', 'Servicios Voluntarios',
   'Los servicios voluntarios permiten a cada miembro suscribirse o cancelar libremente. Ningun miembro esta obligado a usar un servicio voluntario.',
   'info', 'CheckCircle', 7),
  ('unidades_productivas', 'Servicios que Pagan al Miembro',
   'Algunas organizaciones pagan a sus miembros mensualmente por trabajo o servicios prestados. El monto se transfiere automaticamente cada mes.',
   'info', 'Coins', 8),
  ('unidades_productivas', 'Servicios Gratuitos',
   'Los servicios pueden ser gratuitos (monto cero). En ese caso, solo se registra la membresia sin cobro. Por ejemplo, una cuota por ser miembro puede ser gratuita.',
   'info', 'Info', 9),
  ('unidades_productivas', 'Cobro Automatico Mensual',
   'El sistema cobra o paga automaticamente los servicios activos segun la frecuencia configurada (mensual, trimestral, anual). Los miembros reciben notificaciones de cada cobro.',
   'info', 'Calendar', 10),
  ('impuestos', 'Impuestos por Nivel de Miembro',
   'Cada nivel de miembro tiene su propia tasa de impuesto. Los miembros nuevos (brote) pagan mas, los fundadores (raiz) pagan menos, como incentivo para ascender.',
   'info', 'Percent', 5),
  ('impuestos', 'Impuestos por Nivel de Organizacion',
   'Las organizaciones pagan impuestos segun su nivel. Las instituciones publicas estan exentas (0%). Las de produccion pagan 2%, las de consumo 1%.',
   'info', 'Percent', 6),
  ('impuestos', 'Destino de los Impuestos',
   'Todos los impuestos llegan automaticamente a la cuenta de la Asamblea. La Asamblea decide a donde distribuir ese dinero mediante propuestas de distribucion de fondos.',
   'info', 'PiggyBank', 7)
) AS t(cat, title, desc_text, sev, icon, sort)
WHERE u.node_domain != 'localhost' AND u.node_domain IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM governance_rules
    WHERE node_domain = u.node_domain AND title = t.title
  );
