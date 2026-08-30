-- Migracion 142: Indices para busqueda de turnos y transacciones por fecha
-- Permite buscar turnos y transacciones por rango de fechas sin limite artificial (LIMIT 100).
-- Retencion: 1 ano de datos (~1095 turnos maximo con 3/dia, ~36500 transacciones con 100/dia).

CREATE INDEX IF NOT EXISTS idx_pos_shifts_opened_at ON pos_shifts(opened_at);
CREATE INDEX IF NOT EXISTS idx_nfc_transactions_created_at ON nfc_transactions(created_at);

-- Indice para buscar transacciones de un turno especifico
-- nfc_transactions no tiene shift_id directamente, pero pos_charges si.
-- Para NFC transactions, filtramos por terminal_id + rango de created_at.
CREATE INDEX IF NOT EXISTS idx_nfc_transactions_terminal_created ON nfc_transactions(terminal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_terminal_opened ON pos_shifts(terminal_id, opened_at);
