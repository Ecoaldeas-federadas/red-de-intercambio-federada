-- Migracion 096: Corregir limites simetricos (credit_limit = debit_limit)
-- y marcar la organizacion asamblea como is_assembly_owned
--
-- Problema: las cuentas de fondo_comunitario, impuestos y asamblea se crearon
-- con credit_limit=0 y debit_limit=999999999, lo que es asimetrico.
-- Los limites deben ser iguales (simetricos) en positivo y negativo.
-- Ademas, la organizacion asamblea debe marcarse como is_assembly_owned.

-- Corregir fondo_comunitario: limites simetricos
UPDATE users
SET credit_limit = 999999999, debit_limit = 999999999
WHERE username = 'fondo_comunitario' AND account_type = 'fund';

-- Corregir impuestos: limites simetricos
UPDATE users
SET credit_limit = 999999999, debit_limit = 999999999
WHERE username = 'impuestos' AND account_type = 'fund';

-- Corregir asamblea: limites simetricos y marcar como assembly_owned
UPDATE users
SET credit_limit = 999999999, debit_limit = 999999999, is_assembly_owned = true
WHERE username = 'asamblea' AND account_type = 'organization';
