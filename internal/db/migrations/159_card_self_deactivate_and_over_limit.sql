-- Migracion 159: Auto-bloqueo de tarjeta propia + flag is_over_limit
--
-- 1. deactivated_by_admin: permite distinguir si una tarjeta fue desactivada
--    por el admin (el usuario no puede reactivarla) o por el usuario mismo
--    (el usuario puede reactivarla).
--
-- 2. is_over_limit: marca a un usuario que quedo por debajo de su limite de
--    credito, tipicamente por doble gasto concurrente en un nodo satelite
--    offline. Cuando is_over_limit = true, el usuario no puede enviar/comprar
--    hasta que reciba suficientes TQ para volver dentro de su limite.

ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS deactivated_by_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_over_limit BOOLEAN NOT NULL DEFAULT false;
