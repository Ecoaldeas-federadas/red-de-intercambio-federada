-- Migracion 103: Tipos de propuesta para Comercio Exterior
-- fund_external_commerce: Transferir TQ a la cuenta de Comercio Exterior
-- external_bank_account: Agregar/modificar cuenta bancaria externa
-- external_commerce_config: Cambiar configuracion del DEX (multi-firma, etc.)

INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, sort_order) VALUES
  ('node', 'fund_external_commerce', 'Fondear Comercio Exterior', 'Transferir TQ a la cuenta de Comercio Exterior para compras externas', 19),
  ('node', 'external_bank_account', 'Cuenta bancaria externa', 'Agregar o modificar cuenta bancaria del Comercio Exterior', 20),
  ('node', 'external_commerce_config', 'Config DEX', 'Cambiar configuracion del Comercio Exterior (multi-firma, firmantes)', 21)
ON CONFLICT (scope, proposal_type) DO NOTHING;

-- Configuracion de aprobacion por defecto
INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
SELECT 'localhost', 'fund_external_commerce', 'assembly', 66.67, 15, 0, 'Fondear Comercio Exterior - 2/3 de la asamblea', true
WHERE NOT EXISTS (SELECT 1 FROM assembly_config WHERE proposal_type = 'fund_external_commerce');

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
SELECT 'localhost', 'external_bank_account', 'assembly', 66.67, 15, 0, 'Cuenta bancaria externa - 2/3 de la asamblea', true
WHERE NOT EXISTS (SELECT 1 FROM assembly_config WHERE proposal_type = 'external_bank_account');

INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
SELECT 'localhost', 'external_commerce_config', 'assembly', 50.0, 10, 0, 'Config DEX - mayoria simple', true
WHERE NOT EXISTS (SELECT 1 FROM assembly_config WHERE proposal_type = 'external_commerce_config');
