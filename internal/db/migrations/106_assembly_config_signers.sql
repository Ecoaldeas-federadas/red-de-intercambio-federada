-- Migracion 106: Signers autorizados para multisig + persona especifica + organizacion
--
-- Problemas que resuelve:
-- 1. Multisig solo guardaba NUMERO de firmas, no QUIENES pueden firmar
-- 2. No habia opcion de aprobar por una persona especifica
-- 3. No habia opcion de delegar a una organizacion
-- 4. "Consejo" no estaba claro que era un departamento/comision
--
-- Cambios:
-- 1. Nueva tabla assembly_config_signers: guarda quienes pueden firmar (multisig)
-- 2. Nuevas columnas en assembly_config:
--    - authorized_person_id: para metodo "person" (una persona especifica)
--    - organization_id: para metodo "organization" (delegar a organizacion)
-- 3. Nuevo metodo "person": una persona especifica aprueba
-- 4. Nuevo metodo "organization": una organizacion decide internamente

-- Agregar columnas a assembly_config
ALTER TABLE assembly_config ADD COLUMN IF NOT EXISTS authorized_person_id UUID REFERENCES users(id);
ALTER TABLE assembly_config ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Tabla de signers autorizados para multisig
-- Cada fila es una persona u organizacion autorizada para firmar
CREATE TABLE IF NOT EXISTS assembly_config_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES assembly_config(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  signer_type VARCHAR(20) NOT NULL DEFAULT 'person', -- 'person' o 'organization'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((signer_type = 'person' AND user_id IS NOT NULL) OR (signer_type = 'organization' AND organization_id IS NOT NULL))
);

-- Indice para busqueda rapida
CREATE INDEX IF NOT EXISTS idx_assembly_config_signers_config ON assembly_config_signers(config_id);
