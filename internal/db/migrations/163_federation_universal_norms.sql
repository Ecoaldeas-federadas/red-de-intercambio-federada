-- Migracion 163: Normas federadas universales
--
-- Estas normas se cargan SIEMPRE, incluso cuando el nodo se instala
-- "vacio" (sin preset). Contienen la informacion basica sobre:
-- - Como funciona el trueque y el credito mutuo
-- - Como funciona la federacion entre nodos
-- - El modelo de precios energeticos (TQ no es dinero)
--
-- Estas normas aplican a TODAS las comunidades, independientemente de
-- su filosofia, religion o cultura. Las normas especificas de cada
-- comunidad (conucos, cayapa, Sabbath, dieta Ital, etc.) las agrega
-- el preset seleccionado o el admin manualmente.
--
-- Usa 'localhost' como node_domain (MigrateDomainData lo convierte a __LOCAL__).

-- ===== Categoria: trueque (Como funciona el credito mutuo) =====
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type) VALUES
('localhost', 'trueque', 'TQ no es dinero', 'TQ registra energia, contribuciones y compromisos. No es dinero bancario, no genera intereses, no se puede convertir a fiat. Es una unidad contable que mide el aporte de cada miembro a la comunidad.', 'info', 'coins', 1, 'informativo'),
('localhost', 'trueque', 'Limites Simetricos', 'Cada miembro tiene un limite de saldo simetrico: puede tener saldo positivo (credito suministrado) o negativo (obligacion de contribuir). Ninguno de los dos signos es inherentemente bueno o malo. El limite se configura por nivel de miembro.', 'info', 'scale', 2, 'informativo'),
('localhost', 'trueque', 'Saldo Positivo = Credito', 'Un saldo positivo significa que el miembro ha suministrado mas bienes o trabajo de los que ha recibido. Es un credito a favor de la comunidad. No genera intereses ni ventajas.', 'info', 'trending-up', 3, 'informativo'),
('localhost', 'trueque', 'Saldo Negativo = Compromiso', 'Un saldo negativo significa que el miembro ha recibido mas de lo que ha aportado. Es un compromiso de contribuir en el futuro con bienes o trabajo equivalente. No es una deuda con intereses.', 'info', 'trending-down', 4, 'informativo'),
('localhost', 'trueque', 'Prohibicion de Intereses', 'Esta estrictamente prohibido cobrar intereses sobre saldos TQ. El sistema no genera intereses automaticamente. Cobrar intereses contradice el proposito del trueque y es causal de sancion.', 'grave', 'x-circle', 5, 'prohibicion'),
('localhost', 'trueque', 'Prohibicion de Acumulacion', 'Esta prohibido eludir los limites de saldo con intercambios informales fuera del sistema para acumular mas de lo permitido. Los limites existen para evitar concentracion de poder.', 'grave', 'x-circle', 6, 'prohibicion'),
('localhost', 'trueque', 'Registro Obligatorio', 'Toda transaccion comercial dentro de la comunidad debe registrarse en el sistema TQ. Las transacciones informales fuera del sistema eluden el control de limites y perjudican la transparencia.', 'info', 'clipboard', 7, 'deber'),
('localhost', 'trueque', 'Transferencias entre Miembros', 'Cualquier miembro puede transferir TQ a otro miembro dentro del mismo nodo. La transferencia es instantanea y no tiene costo. El unico limite es no exceder el saldo maximo o minimo configurado.', 'info', 'arrow-right-left', 8, 'permiso'),
('localhost', 'trueque', 'Pagos con QR y NFC', 'Se pueden realizar pagos escaneando codigos QR o usando tarjetas NFC en terminales habilitadas. El sistema soporta pagos con monto fijo (tipo pago movil) o monto libre.', 'info', 'smartphone', 9, 'permiso')
ON CONFLICT DO NOTHING;

-- ===== Categoria: federacion (Como funciona la federacion entre nodos) =====
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type) VALUES
('localhost', 'federacion', 'Nodos Autonomos', 'Cada nodo de la federacion es independiente y autonomo. Cada comunidad define sus propias reglas, horarios, productos y gobernanza. La federacion no impone normas internas, solo define como los nodos se comunican entre si.', 'info', 'server', 1, 'informativo'),
('localhost', 'federacion', 'Protocolo de Federacion', 'La federacion usa un protocolo de comunicacion cifrado (mTLS) entre nodos. Todos los nodos derivados deben poder federarse con el repositorio principal, como los servidores de correo interoperan via SMTP.', 'info', 'lock', 2, 'informativo'),
('localhost', 'federacion', 'Niveles de Nodo Federado', 'Existen tres niveles: Nodo Nuevo (nivel 1, sin voto en la federacion), Nodo Aceptado (nivel 2, con voto) y Nodo Pleno (nivel 3). El nivel se determina por el tiempo de operacion y la confianza de la red.', 'info', 'award', 3, 'informativo'),
('localhost', 'federacion', 'Sistema de Padrino', 'Un nodo nivel 2+ puede patrocinar a un nodo nuevo. El padrino es responsable de la deuda del nodo patrocinado si este incumple. El padrino libera su garantia cuando el nodo patrocinado alcanza el nivel apropiado.', 'info', 'users', 4, 'informativo'),
('localhost', 'federacion', 'Piscina Global', 'La piscina global es un saldo compartido entre todos los nodos federados. Un saldo ganado con el nodo B se puede gastar con el nodo C. Esto permite comercio multilateral sin acuerdos bilaterales individuales.', 'info', 'globe', 5, 'informativo'),
('localhost', 'federacion', 'Piscinas Bilaterales', 'Ademas de la piscina global, dos nodos pueden establecer piscinas bilaterales con limites especificos. Estas son independientes de la piscina global y permiten acuerdos comerciales preferentes.', 'info', 'handshake', 6, 'informativo'),
('localhost', 'federacion', 'Paridad entre Monedas', 'Cada nodo emite su propia moneda local (TQ). La paridad entre monedas de diferentes nodos se calcula automaticamente y puede ajustarse. El comercio federado respeta la paridad vigente.', 'info', 'scale', 7, 'informativo'),
('localhost', 'federacion', 'Prohibicion de Aislamiento', 'Esta prohibido aislar un nodo de la federacion. Toda modificacion debe mantener compatibilidad de federacion. Crear un "walled garden" que impida la comunicacion con otros nodos contradice el proposito del software.', 'grave', 'x-circle', 8, 'prohibicion'),
('localhost', 'federacion', 'Comercio Federado', 'Los miembros pueden comprar y vender productos con miembros de otros nodos federados. Las transacciones usan la paridad vigente y respetan los limites de la piscina global o bilateral.', 'info', 'shopping-cart', 9, 'permiso'),
('localhost', 'federacion', 'Federacion de Productos', 'Los productos aprobados por un nodo se pueden distribuir a otros nodos para aprobacion individual. Esto permite que un producto validado en una comunidad este disponible en toda la red.', 'info', 'package', 10, 'informativo')
ON CONFLICT DO NOTHING;

-- ===== Categoria: energia (Modelo de precios energeticos) =====
INSERT INTO governance_rules (node_domain, category, title, description, severity, icon, sort_order, rule_type) VALUES
('localhost', 'energia', 'Precios Energeticos', 'Los precios de los productos se calculan segun la energia incorporada por kg de material, siguiendo el estandar internacional ICE Database (University of Bath). Esto permite precios justos independientes del dinero fiat.', 'info', 'zap', 1, 'informativo'),
('localhost', 'energia', 'TQ Registra Energia', 'Un TQ representa una unidad de energia. No es dinero. Cuando compras un producto, estas intercambiando energia por energia. Tu trabajo es energia. Los materiales son energia incorporada.', 'info', 'atom', 2, 'informativo'),
('localhost', 'energia', 'Calculo por Rendimiento', 'Para productos transformados, especificas cuanto compraste y cuantos productos salen. El sistema calcula el costo por unidad automaticamente. Ej: 5kg de tomate -> 30 frascos de salsa = costo por frasco.', 'info', 'calculator', 3, 'informativo'),
('localhost', 'energia', 'Componentes del Precio', 'El precio de un producto compuesto incluye: materia prima, trabajo, embalaje y envio. Cada componente se calcula por separado y se suma. El trabajo se mide en horas y se convierte a TQ.', 'info', 'layers', 4, 'informativo'),
('localhost', 'energia', 'Productos Compuestos', 'Cualquier miembro puede crear productos compuestos combinando materias primas aprobadas. El precio se calcula automaticamente segun los componentes. Ej: salsa = tomate + ajo + aceite + frasco + trabajo.', 'info', 'package', 5, 'permiso')
ON CONFLICT DO NOTHING;
