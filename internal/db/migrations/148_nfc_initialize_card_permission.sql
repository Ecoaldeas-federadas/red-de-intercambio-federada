-- Migracion 148: Permiso para grabar (inicializar) tarjetas NFC fisicamente
--
-- Hay dos permisos diferentes para tarjetas NFC:
-- 1. nfc.issue_card — Provisionar/registrar tarjeta en el sistema (mas restrictivo)
--    Solo personas muy especificas pueden registrar tarjetas.
-- 2. nfc.initialize_card — Grabar/inicializar tarjeta fisicamente (menos restrictivo)
--    Cualquiera con este permiso puede grabar la tarjeta fisica desde el POS Android.
--    Esto permite que se le entregue la tarjeta a alguien y que cualquiera con
--    el permiso pueda grabarla colocandola en el celular.

INSERT INTO permissions (name, description, category, requires_multisig, required_approvals)
SELECT 'nfc.initialize_card', 'Grabar (inicializar) tarjeta NFC fisicamente desde el POS', 'nfc', false, 1
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'nfc.initialize_card');
