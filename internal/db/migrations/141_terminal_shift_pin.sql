-- Migracion 141: PIN del turno (caja) configurado por el dueño del terminal
-- El dueño del terminal configura el PIN desde su panel web.
-- El POS sincroniza este PIN localmente para funcionar sin internet.
-- El empleado no puede abrir/cerrar caja — solo el dueño.

ALTER TABLE nfc_terminals ADD COLUMN IF NOT EXISTS shift_pin_hash TEXT;

COMMENT ON COLUMN nfc_terminals.shift_pin_hash IS
  'Hash bcrypt del PIN del turno. Configurado por el dueño del terminal. NULL = no configurado (el POS no puede abrir caja).';
