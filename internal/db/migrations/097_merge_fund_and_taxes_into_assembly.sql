-- Migracion 097: Fusionar fondo_comunitario e impuestos EN asamblea
--
-- ANTES: Habia 3 cuentas separadas:
--   - asamblea (organizacion) -> cuenta de la Asamblea General
--   - fondo_comunitario (fund) -> Fondo Comunitario
--   - impuestos (fund) -> cuenta de Impuestos
--
-- DESPUES: Hay UNA sola cuenta: asamblea
--   - asamblea es la cuenta de la Asamblea General
--   - asamblea es el Fondo Comunitario
--   - asamblea es la cuenta de Impuestos
--   - Se le puede transferir usando: asamblea, impuestos, fondo_comunitario
--   - Los 3 nombres son aliases de la misma cuenta
--
-- Pasos:
-- 1. Obtener el ID de la cuenta asamblea
-- 2. Mover el saldo de fondo_comunitario a asamblea
-- 3. Mover el saldo de impuestos a asamblea
-- 4. Reasignar transacciones de fondo_comunitario a asamblea
-- 5. Reasignar transacciones de impuestos a asamblea
-- 6. Actualizar tax_config para apuntar a asamblea
-- 7. Eliminar las cuentas duplicadas

-- Paso 1: Obtener ID de asamblea (crearla si no existe)
-- (Ya deberia existir por migracion 096 o setup, pero por seguridad)
INSERT INTO users (id, node_domain, username, display_name, account_type, membership_status, balance, credit_limit, debit_limit, is_assembly_owned, is_approved)
SELECT gen_random_uuid(), node_domain, 'asamblea', 'Asamblea General', 'organization', 'active', 0, 999999999, 999999999, true, true
FROM (SELECT DISTINCT node_domain FROM users) sub
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'asamblea' AND node_domain = sub.node_domain);

-- Paso 2 y 3: Mover saldos de fondo_comunitario e impuestos a asamblea
UPDATE users SET balance = balance + (
  SELECT COALESCE(SUM(balance), 0) FROM users
  WHERE username IN ('fondo_comunitario', 'impuestos')
  AND account_type = 'fund'
  AND node_domain = users.node_domain
)
WHERE username = 'asamblea'
AND node_domain IN (SELECT DISTINCT node_domain FROM users WHERE username IN ('fondo_comunitario', 'impuestos'));

-- Paso 4 y 5: Reasignar transacciones
-- Reasignar sender_id
UPDATE transactions SET sender_id = a.id
FROM users a
WHERE a.username = 'asamblea'
AND transactions.sender_id IN (
  SELECT id FROM users WHERE username IN ('fondo_comunitario', 'impuestos') AND account_type = 'fund'
)
AND transactions.sender_id IS NOT NULL;

-- Reasignar receiver_id
UPDATE transactions SET receiver_id = a.id
FROM users a
WHERE a.username = 'asamblea'
AND transactions.receiver_id IN (
  SELECT id FROM users WHERE username IN ('fondo_comunitario', 'impuestos') AND account_type = 'fund'
)
AND transactions.receiver_id IS NOT NULL;

-- Reasignar tax_target_account en transactions
UPDATE transactions SET tax_target_account = a.id
FROM users a
WHERE a.username = 'asamblea'
AND transactions.tax_target_account IN (
  SELECT id FROM users WHERE username IN ('fondo_comunitario', 'impuestos') AND account_type = 'fund'
)
AND transactions.tax_target_account IS NOT NULL;

-- Reasignar ledger_entries
UPDATE ledger_entries SET account_id = a.id
FROM users a
WHERE a.username = 'asamblea'
AND ledger_entries.account_id IN (
  SELECT id FROM users WHERE username IN ('fondo_comunitario', 'impuestos') AND account_type = 'fund'
);

-- Paso 6: Actualizar tax_config para apuntar a asamblea
UPDATE tax_config SET tax_account_id = a.id
FROM users a
WHERE a.username = 'asamblea'
AND tax_config.tax_account_id IN (
  SELECT id FROM users WHERE username IN ('fondo_comunitario', 'impuestos') AND account_type = 'fund'
);

-- Asegurar que todo tax_config apunta a asamblea si no tiene cuenta asignada
UPDATE tax_config tc
SET tax_account_id = a.id
FROM users a
WHERE a.username = 'asamblea' AND a.node_domain = tc.node_domain
AND tc.tax_account_id IS NULL;

-- Reasignar tax_distributions
UPDATE tax_distributions SET from_account = a.id
FROM users a
WHERE a.username = 'asamblea'
AND tax_distributions.from_account IN (
  SELECT id FROM users WHERE username IN ('fondo_comunitario', 'impuestos') AND account_type = 'fund'
);

UPDATE tax_distributions SET to_account = a.id
FROM users a
WHERE a.username = 'asamblea'
AND tax_distributions.to_account IN (
  SELECT id FROM users WHERE username IN ('fondo_comunitario', 'impuestos') AND account_type = 'fund'
);

-- Reasignar from_account en transactions (campo legacy si existe)
-- (algunas tab pueden tener from_account en vez de sender_id)

-- Paso 7: Eliminar las cuentas duplicadas
DELETE FROM users WHERE username IN ('fondo_comunitario', 'impuestos') AND account_type = 'fund';

-- Asegurar que asamblea tiene limites simetricos y is_assembly_owned
UPDATE users
SET credit_limit = 999999999, debit_limit = 999999999, is_assembly_owned = true, is_approved = true
WHERE username = 'asamblea';
