package payments

import (
	"context"
	"log"
	"time"

	"federated-credit-node/internal/db"
)

// StartRetentionPurger inicia una goroutine que purga transacciones
// y turnos mayores a retention_days cada 24 horas.
// Se ejecuta inmediatamente al iniciar y luego cada 24h.
func (nt *NFCTerminals) StartRetentionPurger(ctx context.Context) {
	go func() {
		// Ejecutar al iniciar
		nt.PurgeOldTransactions(ctx)

		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				nt.PurgeOldTransactions(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

// PurgeOldTransactions borra transacciones y turnos mayores a retention_days.
// Lee la configuracion de pos_retention_config. Si no hay configuracion,
// usa 365 dias por defecto.
func (nt *NFCTerminals) PurgeOldTransactions(ctx context.Context) {
	var retentionDays int = 365
	var enabled bool = true

	err := nt.Pool.QueryRow(ctx,
		`SELECT retention_days, enabled FROM pos_retention_config WHERE node_domain = $1`,
		db.LOCAL_NODE_DOMAIN,
	).Scan(&retentionDays, &enabled)
	if err != nil {
		// Si no hay configuracion, usar defaults (365 dias, enabled)
		retentionDays = 365
		enabled = true
	}

	if !enabled {
		log.Printf("Retention purger: disabled, skipping purge")
		return
	}

	cutoff := time.Now().AddDate(0, 0, -retentionDays)

	txResult, err := nt.Pool.Exec(ctx,
		`DELETE FROM nfc_transactions WHERE created_at < $1`, cutoff)
	if err != nil {
		log.Printf("Retention purger: error deleting transactions: %v", err)
	} else {
		log.Printf("Retention purger: deleted %d transactions older than %d days (cutoff: %s)",
			txResult.RowsAffected(), retentionDays, cutoff.Format("2006-01-02"))
	}

	shiftResult, err := nt.Pool.Exec(ctx,
		`DELETE FROM pos_shifts WHERE opened_at < $1 AND status = 'closed'`, cutoff)
	if err != nil {
		log.Printf("Retention purger: error deleting shifts: %v", err)
	} else {
		log.Printf("Retention purger: deleted %d closed shifts older than %d days (cutoff: %s)",
			shiftResult.RowsAffected(), retentionDays, cutoff.Format("2006-01-02"))
	}

	// Actualizar last_purge_at
	_, err = nt.Pool.Exec(ctx,
		`UPDATE pos_retention_config SET last_purge_at = NOW() WHERE node_domain = $1`,
		db.LOCAL_NODE_DOMAIN)
	if err != nil {
		// Insertar si no existe
		nt.Pool.Exec(ctx,
			`INSERT INTO pos_retention_config (node_domain, retention_days, enabled, last_purge_at)
			 VALUES ($1, $2, true, NOW()) ON CONFLICT DO NOTHING`,
			db.LOCAL_NODE_DOMAIN, retentionDays)
	}
}
