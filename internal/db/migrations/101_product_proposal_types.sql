-- Migracion 101: Tipos de propuesta para importar/remover productos
-- product_import: Proponer importar un producto de otro nodo federado
-- product_remove: Proponer desaprobar/remover un producto del nodo
-- product_to_base: Proponer convertir un producto compuesto a producto base

INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, sort_order) VALUES
  ('node', 'product_import', 'Importar producto federado', 'Proponer importar un producto de otro nodo federado al catalogo local', 16),
  ('node', 'product_remove', 'Remover producto', 'Proponer desaprobar/remover un producto del catalogo local', 17),
  ('node', 'product_to_base', 'Convertir a producto base', 'Proponer convertir un producto compuesto en producto base/materia prima', 18)
ON CONFLICT (scope, proposal_type) DO NOTHING;
