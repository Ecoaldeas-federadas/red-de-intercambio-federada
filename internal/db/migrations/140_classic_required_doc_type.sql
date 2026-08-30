-- Migracion 140: Tarjeta Classic asociada a un tipo de documento especifico
-- El dueño de la tarjeta elige que tipo de documento la tarjeta va a reconocer.
-- Esto da mas seguridad: el ladron necesita saber username + documento especifico + PIN.
-- Si es NULL, acepta cualquier documento del usuario (compatibilidad retroactiva).

ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS required_doc_type TEXT;

-- Comentario informativo
COMMENT ON COLUMN nfc_cards.required_doc_type IS
  'Tipo de documento que la tarjeta Classic reconoce. NULL = cualquier documento del usuario. Ej: cedula, dni, pasaporte.';
