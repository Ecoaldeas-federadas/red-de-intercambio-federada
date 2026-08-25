-- Migracion 105: Configuracion de gobernanza para aprobacion de productos
--
-- Agrega tipos de propuesta a assembly_config para que la Asamblea pueda
-- configurar QUIEN aprueba/desaprueba/elimina productos:
--   - assembly: votacion de asamblea (con porcentaje)
--   - board: junta directiva del nodo
--   - council: consejo/comision especifico
--   - multisig: firmas de personas especificas
--
-- Por defecto:
--   product_approval: board (junta directiva, 50%) - aprobacion rapida
--   product_disapproval: board (junta directiva, 50%) - desaprobar rapido
--   product_remove: assembly (asamblea, 66.67%) - eliminar requiere 2/3
--   product_import: assembly (asamblea, 50%) - importar de otro nodo

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
VALUES ('localhost', 'product_approval', 'board', 50.00, 0, 1, 'Aprobar producto en el catalogo - Junta Directiva por defecto', true)
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
VALUES ('localhost', 'product_disapproval', 'board', 50.00, 0, 1, 'Desaprobar producto del catalogo - Junta Directiva por defecto', true)
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
VALUES ('localhost', 'product_remove', 'assembly', 66.67, 0, 1, 'Eliminar producto del catalogo - requiere 2/3 de la Asamblea', true)
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
VALUES ('localhost', 'product_import', 'assembly', 50.00, 0, 1, 'Importar producto de otro nodo federado - mayoria simple', true)
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

-- Tambien agregar los tipos de propuesta a assembly_proposal_types si no existen
INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, sort_order)
VALUES ('node', 'product_approval', 'Aprobar producto', 'Proponer aprobar un producto en el catalogo del nodo', 19)
ON CONFLICT (scope, proposal_type) DO NOTHING;

INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, sort_order)
VALUES ('node', 'product_disapproval', 'Desaprobar producto', 'Proponer desaprobar un producto del catalogo (no lo elimina)', 20)
ON CONFLICT (scope, proposal_type) DO NOTHING;
