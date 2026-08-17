-- Migracion 009: Super admin - usuario con todos los permisos

-- Agregar columna is_super_admin a users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Agregar columna is_super_admin_enabled para poder deshabilitar
ALTER TABLE users ADD COLUMN IF NOT EXISTS super_admin_enabled BOOLEAN NOT NULL DEFAULT true;

-- El primer usuario individual activo de cada nodo es super admin por defecto
-- (se asigna durante el setup, no aqui)

-- Permiso para habilitar/deshabilitar super admin (requerido por junta/asamblea)
INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
VALUES ('admin.toggle_super_admin', 'Habilitar o deshabilitar super admin', 'admin', true, 2)
ON CONFLICT (name) DO NOTHING;
