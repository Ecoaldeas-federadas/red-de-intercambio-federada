-- Migracion 062: Corregir reglas de gobernanza con terminologia real y valores dinamicos
--
-- Problemas corregidos:
-- 1. Las reglas mencionaban "circulos" pero el sistema tiene "departamentos"
-- 2. Decia "asamblea mensual" pero la frecuencia es configurable (default 3 meses)
-- 3. Limites hardcoded (-500/+500) cuando son configurables por nivel de miembro
-- 4. "Doble enlace sociocratico" mencionaba coordinador/delegado pero los
--    departamentos tienen jefe y miembros
--
-- Solucion: usar placeholders {assembly_frequency}, {quorum_ordinaria}, etc.
-- que el backend reemplaza con los valores reales de la configuracion.

-- Actualizar regla de Asamblea General (frecuencia dinamica)
UPDATE governance_rules SET description =
'La Asamblea General es el organo maximo de decision. Se reune cada {assembly_frequency} meses y todos los miembros plenos tienen voz y voto. Las decisiones se toman por consentimiento sociocratico: una propuesta se aprueba cuando nadie presenta una objecion razonada de que cause dano al proposito de la aldea. El lema es: "Suficientemente bueno por ahora, seguro para intentar".'
WHERE category = 'estructura' AND title = 'Asamblea General';

-- Actualizar regla de Departamentos (antes "Circulos Operativos")
UPDATE governance_rules SET
  title = 'Departamentos Operativos',
  description = 'La gobernanza operativa se divide en departamentos: cada uno gestiona su area sin esperar aprobacion de la asamblea para decisiones operativas. Los departamentos tienen un jefe, miembros asignados y roles con permisos especificos. Para crear o modificar departamentos, un administrador lo hace desde el panel de Departamentos.'
WHERE category = 'estructura' AND title = 'Circulos Operativos';

-- Actualizar regla de Junta Directiva
UPDATE governance_rules SET description =
'La Junta Directiva es el organo ejecutivo del nodo. Se compone de miembros elegidos por consentimiento de la asamblea. Los cargos duran 1 ano y son revocables por la asamblea. El administrador del nodo y los jefes de departamento forman parte de la junta.'
WHERE category = 'estructura' AND title = 'Junta Directiva del Nodo';

-- Eliminar la regla de "Doble Enlace Sociocratico" (no existe en el sistema)
DELETE FROM governance_rules WHERE category = 'estructura' AND title = 'Doble Enlace Sociocratico';

-- Actualizar regla de organizaciones
UPDATE governance_rules SET description =
'Las organizaciones son colectivos de produccion, consumo o servicios registrados en el sistema. Pueden ser: Grupo de Produccion, Grupo de Consumo, Comision, Proyecto, Institucion Publica o Cooperativa. Tienen su propia asamblea y limites de saldo simetricos mas amplios.'
WHERE category = 'estructura' AND title = 'Organizaciones';

-- Actualizar regla de departamentos (descripcion)
UPDATE governance_rules SET description =
'Los departamentos son unidades administrativas con roles y permisos especificos. Cada departamento tiene un jefe, miembros asignados y roles con permisos granulares. Los departamentos pueden tener su propia asamblea interna con quorum configurable.'
WHERE category = 'estructura' AND title = 'Departamentos';

-- Actualizar regla de limites (dinamico)
UPDATE governance_rules SET description =
'Se permite comprar y vender libremente dentro de la aldea usando TQ, respetando los limites de saldo simetricos configurados para cada nivel de miembro (ej: {limit_new_negative}/+{limit_new_positive} para nuevos, {limit_active_negative}/+{limit_active_positive} para activos).'
WHERE category = 'permitido' AND title = 'Comercio con TQ';

-- Actualizar regla de acumulacion (dinamico)
UPDATE governance_rules SET description =
'Esta prohibido eludir el control de limites de saldo con intercambios informales fuera del sistema para acumular mas de lo permitido por tu nivel de miembro.'
WHERE category = 'prohibido' AND title = 'Acumular mas alla del limite';

-- Actualizar regla de asistencia a asambleas (frecuencia dinamica)
UPDATE governance_rules SET description =
'La asistencia a las asambleas ordinarias (cada {assembly_frequency} meses) es obligatoria. Tres faltas injustificadas consecutivas son una falta leve.'
WHERE category = 'deberes' AND title = 'Asistencia a Asambleas';

-- Actualizar regla de impuesto de transaccion (dinamico)
UPDATE governance_rules SET description =
'Cada transaccion en TQ tiene un porcentaje de impuesto definido por el nivel del miembro. El impuesto va al Fondo Comunitario. La tasa de impuesto individual es {tax_individual_rate} y para organizaciones es {tax_org_default_rate}.'
WHERE category = 'impuestos' AND title = 'Impuesto de Transaccion';

-- Actualizar regla de fondo comunitario
UPDATE governance_rules SET description =
'El Fondo Comunitario es una cuenta especial que recibe los impuestos y se usa para proyectos comunales aprobados por la asamblea: infraestructura, equipos, emergencias.'
WHERE category = 'impuestos' AND title = 'Fondo Comunitario';

-- Actualizar regla de aprobacion de gastos (quorum dinamico)
UPDATE governance_rules SET description =
'Los gastos del Fondo Comunitario deben ser aprobados por la asamblea (quorum de {quorum_ordinaria_first}% primera convocatoria, {quorum_ordinaria_second}% segunda). Los cambios a la tasa de impuesto requieren {quorum_extraordinaria}% de la asamblea.'
WHERE category = 'impuestos' AND title = 'Aprobacion de Gastos';

-- Actualizar regla de admision fase 3 (limites dinamicos)
UPDATE governance_rules SET description =
'Aprobado por consentimiento en el Circulo de Convivencia y refrendado en Asamblea General. Se firma el Acuerdo de Vida Conuquera, se le asigna parcela y conuco, y se abren los limites completos de TQ ({limit_new_negative}/+{limit_new_positive} simetricos).'
WHERE category = 'admision' AND title = 'Fase 3: Miembro Pleno (Conuquero Federado)';
