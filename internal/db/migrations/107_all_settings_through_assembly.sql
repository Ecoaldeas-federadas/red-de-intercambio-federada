-- Migracion 107: Todos los cambios del nodo pasan por configuracion de Asamblea
--
-- Principio: TODO cambio de ajustes del nodo debe tener una entrada en
-- assembly_config que defina COMO se decide ese cambio:
--   - assembly: votacion de asamblea
--   - board: junta directiva
--   - council: comision/departamento
--   - person: una persona especifica
--   - organization: una organizacion
--   - multisig: N firmas simultaneas requeridas
--   - authorized_any: cualquiera de las personas autorizadas puede aprobar
--
-- Por defecto, los cambios administrativos se delegan a una persona
-- (config.manage = super admin) para que el nodo funcione desde el inicio.
-- La Asamblea puede cambiar esto despues.

-- Config del nodo (nombre, moneda, dominio)
INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
VALUES ('localhost', 'node_config', 'person', 50.00, 0, 1, 'Cambiar nombre, moneda o dominio del nodo - por defecto persona autorizada (admin)', true)
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

-- Config de backups (frecuencia, retencion)
INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
VALUES ('localhost', 'backup_config', 'person', 50.00, 0, 1, 'Configurar backups automaticos - por defecto persona autorizada (admin)', true)
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

-- Config de cluster DB (modo, nodos, limites)
INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
VALUES ('localhost', 'cluster_config', 'person', 50.00, 0, 1, 'Configurar cluster de base de datos - por defecto persona autorizada (admin)', true)
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

-- Asignacion de permisos a personas
INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
VALUES ('localhost', 'permission_assignment', 'assembly', 66.67, 0, 1, 'Asignar permisos y roles a personas - requiere 2/3 de la Asamblea', true)
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

-- Config de federacion con otros nodos
INSERT INTO assembly_config (node_domain, proposal_type, approval_method, required_percentage, required_quorum, required_signatures, description, is_active)
VALUES ('localhost', 'federation_treaty', 'assembly', 66.67, 0, 1, 'Firmar tratados de federacion con otros nodos - requiere 2/3 de la Asamblea', true)
ON CONFLICT (node_domain, proposal_type) DO NOTHING;

-- Agregar tipos de propuesta a assembly_proposal_types
INSERT INTO assembly_proposal_types (scope, proposal_type, label, description, sort_order)
VALUES
  ('node', 'node_config', 'Configuracion del nodo', 'Cambiar nombre, moneda o dominio del nodo', 21),
  ('node', 'backup_config', 'Configuracion de backups', 'Cambiar frecuencia o retencion de backups automaticos', 22),
  ('node', 'cluster_config', 'Configuracion de base de datos', 'Cambiar configuracion del cluster de base de datos', 23),
  ('node', 'permission_assignment', 'Asignacion de permisos', 'Asignar o revocar permisos y roles a personas', 24),
  ('node', 'federation_treaty', 'Tratado de federacion', 'Firmar o revocar tratados de federacion con otros nodos', 25)
ON CONFLICT (scope, proposal_type) DO NOTHING;
