-- Migracion 057: Departamentos con organizacion padre
--
-- JERARQUIA:
--   Nodo/Asamblea (top)
--     -> Organizaciones (pertenecen al nodo)
--       -> Departamentos (pertenecen a una organizacion o al nodo)
--
-- Un departamento NO puede existir aislado.
-- Debe pertenecer a:
--   - Una organizacion (parent_organization_id = id de la org)
--   - O al nodo/asamblea directamente (parent_organization_id = NULL
--     y parent_is_node = true)
--
-- No puede pertenecer a una persona.

-- Anadir columna parent_organization_id
-- Si es NULL, el departamento pertenece al nodo/asamblea directamente
ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_organization_id UUID REFERENCES users(id);

-- Indice para buscar departamentos por organizacion padre
CREATE INDEX IF NOT EXISTS idx_departments_parent_org ON departments(parent_organization_id);

-- Los departamentos existentes sin parent se asignan al nodo (parent_organization_id = NULL)
-- Esto significa que pertenecen al nodo/asamblea directamente
-- No se fuerza migracion de datos existentes, se mantienen como estan
