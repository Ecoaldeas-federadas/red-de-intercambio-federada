-- Migracion 063: Agregar campo rule_type a governance_rules
--
-- El usuario reporto que al crear una regla no hay un campo claro
-- para decidir si es un permiso, prohibicion, deber, informativo, etc.
-- La "categoria" agrupa por secciones, la "severidad" indica gravedad,
-- pero faltaba un campo que diga QUE TIPO de regla es.

ALTER TABLE governance_rules ADD COLUMN IF NOT EXISTS rule_type TEXT NOT NULL DEFAULT 'informativo';

-- Tipos:
-- permiso      - Cosas que SE PUEDEN hacer
-- prohibicion  - Cosas que NO SE PUEDEN hacer
-- deber        - Obligaciones de los miembros
-- informativo  - Informacion general / estructura
-- falta        - Infracciones y sanciones
-- proceso      - Procesos (admision, salida, votacion)

-- Actualizar reglas existentes con el tipo correcto segun su categoria
UPDATE governance_rules SET rule_type = 'informativo' WHERE category = 'estructura';
UPDATE governance_rules SET rule_type = 'deber' WHERE category = 'deberes';
UPDATE governance_rules SET rule_type = 'permiso' WHERE category = 'permitido';
UPDATE governance_rules SET rule_type = 'prohibicion' WHERE category = 'prohibido';
UPDATE governance_rules SET rule_type = 'falta' WHERE category = 'faltas_leves';
UPDATE governance_rules SET rule_type = 'falta' WHERE category = 'faltas_graves';
UPDATE governance_rules SET rule_type = 'falta' WHERE category = 'faltas_muy_graves';
UPDATE governance_rules SET rule_type = 'proceso' WHERE category = 'admision';
UPDATE governance_rules SET rule_type = 'proceso' WHERE category = 'salida';
UPDATE governance_rules SET rule_type = 'informativo' WHERE category = 'impuestos';
UPDATE governance_rules SET rule_type = 'informativo' WHERE category = 'tierra';

-- Algunas reglas especificas que tienen tipo distinto al de su categoria
UPDATE governance_rules SET rule_type = 'prohibicion' WHERE category = 'tierra' AND title = 'Prohibicion de Venta Directa';
UPDATE governance_rules SET rule_type = 'prohibicion' WHERE category = 'salida' AND title = 'Expulsion';
UPDATE governance_rules SET rule_type = 'prohibicion' WHERE category = 'impuestos' AND title = 'Aprobacion de Gastos';
