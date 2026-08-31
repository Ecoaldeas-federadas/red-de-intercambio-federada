-- Migracion 147: Agregar initialized_at a nfc_cards
-- Permite saber si una tarjeta registrada en el servidor ya fue
-- inicializada (grabada) fisicamente en el POS Android.

ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS initialized_at TIMESTAMPTZ;
-- Fecha cuando el POS Android confirmo que la tarjeta fue grabada fisicamente.

ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS initialized_by UUID REFERENCES users(id);
-- Usuario admin que confirmo la inicializacion desde el POS.
