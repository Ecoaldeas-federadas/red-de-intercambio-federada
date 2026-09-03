-- Migracion 165: Permisos de traducciones
-- La asamblea delega estos permisos a quienes considere.

INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
VALUES
  ('translations.manage', 'Gestionar idiomas y subir/descargar archivos de traduccion', 'translations', false, 1),
  ('translations.edit', 'Editar traducciones desde la web', 'translations', false, 1),
  ('translations.delegate', 'Delegar permiso de traduccion a otros usuarios', 'translations', false, 1)
ON CONFLICT (name) DO NOTHING;
