-- Migracion 139: Sanitizar custom_fields de admission_requests
-- Elimina cualquier clave que contenga "password", "contrasena" o "clave"
-- de los registros existentes en custom_fields.
-- Esto previene que contrasenas en texto plano sean visibles para administradores.
-- Las contrasenas reales se guardan como hash bcrypt en user_credentials.password_hash
-- y en admission_requests.proposed_password (tambien hash).

-- Sanitizar custom_fields eliminando claves sensibles
-- Postgres no tiene una funcion nativa para eliminar claves por patron,
-- asi que eliminamos las claves conocidas explicitamente.
UPDATE admission_requests
SET custom_fields = (
    CASE
        WHEN custom_fields ? 'proposed_password' THEN custom_fields - 'proposed_password'
        ELSE custom_fields
    END
)
WHERE custom_fields ? 'proposed_password';

UPDATE admission_requests
SET custom_fields = (
    CASE
        WHEN custom_fields ? 'proposed_password_confirm' THEN custom_fields - 'proposed_password_confirm'
        ELSE custom_fields
    END
)
WHERE custom_fields ? 'proposed_password_confirm';

-- Tambien limpiar cualquier otra clave que contenga "password" (case-insensitive)
-- usando un enfoque mas amplio con jsonb
UPDATE admission_requests
SET custom_fields = (
    SELECT jsonb_object_agg(key, value)
    FROM jsonb_each(custom_fields)
    WHERE key NOT ILIKE '%password%'
      AND key NOT ILIKE '%contrasena%'
      AND key NOT ILIKE '%contraseña%'
      AND key NOT ILIKE '%clave%'
)
WHERE EXISTS (
    SELECT 1 FROM jsonb_each(custom_fields)
    WHERE key ILIKE '%password%'
       OR key ILIKE '%contrasena%'
       OR key ILIKE '%contraseña%'
       OR key ILIKE '%clave%'
);
