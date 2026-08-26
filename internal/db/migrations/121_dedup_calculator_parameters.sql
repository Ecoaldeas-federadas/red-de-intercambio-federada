-- Migracion 121: Deduplicar parametros de calculadora + constraint UNIQUE
--
-- PROBLEMA: La tabla calculator_parameters NO tenia restriccion UNIQUE,
-- por lo que el demo_seed (que corre cada 24h en nodos demo) insertaba
-- duplicados cada vez. El "ON CONFLICT DO NOTHING" no funcionaba porque
-- no habia conflicto que detectar.
--
-- SOLUCION:
-- 1. Eliminar filas duplicadas (conservar la mas antigua por created_at)
-- 2. Anadir UNIQUE constraint en (node_domain, parameter_type, category, name)
--    para que ON CONFLICT DO NOTHING funcione en el futuro

-- Paso 1: Eliminar duplicados de calculator_parameters
-- Conservar la fila con el created_at mas antiguo (la primera insertada)
DELETE FROM calculator_parameters
WHERE id NOT IN (
    SELECT MIN(id) FROM (
        SELECT id, node_domain, parameter_type, category, name,
               ROW_NUMBER() OVER (
                   PARTITION BY node_domain, parameter_type, category, name
                   ORDER BY created_at ASC, id ASC
               ) AS rn
        FROM calculator_parameters
    ) AS ranked
    WHERE ranked.rn = 1
    GROUP BY node_domain, parameter_type, category, name
)
AND id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY node_domain, parameter_type, category, name
                   ORDER BY created_at ASC, id ASC
               ) AS rn
        FROM calculator_parameters
    ) AS ranked
    WHERE ranked.rn > 1
);

-- Paso 2: Eliminar duplicados de calculator_categories
-- (esta tabla ya tiene UNIQUE, pero por si acaso)
DELETE FROM calculator_categories a
USING calculator_categories b
WHERE a.id > b.id
  AND a.node_domain = b.node_domain
  AND a.parameter_type = b.parameter_type
  AND a.name = b.name;

-- Paso 3: Anadir UNIQUE constraint a calculator_parameters
-- Esto hace que ON CONFLICT DO NOTHING funcione correctamente
ALTER TABLE calculator_parameters
    ADD CONSTRAINT uq_calc_params_node_type_cat_name
    UNIQUE (node_domain, parameter_type, category, name);

-- Nota: calculator_categories ya tiene UNIQUE(node_domain, parameter_type, name)
-- desde la migracion 010, asi que no necesita cambios.
