-- Migracion 134: Hacer proposed_username nullable en admission_requests
--
-- Problema: La migracion 001 crea admission_requests con proposed_username TEXT NOT NULL.
-- El formulario publico nuevo (internal/api/system.go) no envia proposed_username,
-- solo envia full_name, email, phone, location, reason, skills, how_heard, custom_fields.
-- Esto causa error: null value in column "proposed_username" violates not-null constraint.
--
-- Solucion: Hacer proposed_username nullable y asignar un valor por defecto
-- a las filas existentes que no tengan valor.

-- Asignar placeholder a filas existentes sin proposed_username
UPDATE admission_requests
SET proposed_username = 'pending_' || id::text
WHERE proposed_username IS NULL OR proposed_username = '';

-- Hacer proposed_username nullable (el formulario publico no lo envia)
ALTER TABLE admission_requests ALTER COLUMN proposed_username DROP NOT NULL;

-- Tambien hacer nullable display_name (el formulario nuevo usa full_name)
ALTER TABLE admission_requests ALTER COLUMN display_name DROP NOT NULL;
