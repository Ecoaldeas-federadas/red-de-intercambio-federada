-- Migracion 104: Agregar tipo de cuenta y pais a external_bank_accounts
--
-- El usuario necesita poder distinguir entre cuenta corriente y de ahorro,
-- y registrar el pais del banco.

ALTER TABLE external_bank_accounts ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'corriente';
-- Valores: 'corriente', 'ahorro', '' (vacio para efectivo)

ALTER TABLE external_bank_accounts ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '';
-- Codigo ISO del pais del banco (ej: VE, CO, US). Vacio para efectivo.
