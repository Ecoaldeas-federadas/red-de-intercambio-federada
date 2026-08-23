package api

import (
	"context"
	"fmt"
	"log"
	"time"

	"federated-credit-node/internal/ledger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SubscriptionScheduler cobra mensualidades de servicios activos
type SubscriptionScheduler struct {
	Pool       *pgxpool.Pool
	nodeDomain string
	ledger     *ledger.Ledger
	stopCh     chan struct{}
}

func NewSubscriptionScheduler(pool *pgxpool.Pool, nodeDomain string) *SubscriptionScheduler {
	return &SubscriptionScheduler{
		Pool:       pool,
		nodeDomain: nodeDomain,
		ledger:     ledger.New(pool),
		stopCh:     make(chan struct{}),
	}
}

func (s *SubscriptionScheduler) Start() {
	go s.run()
}

func (s *SubscriptionScheduler) Stop() {
	close(s.stopCh)
}

func (s *SubscriptionScheduler) run() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	// Ejecutar al iniciar
	s.processPendingCharges()

	for {
		select {
		case <-ticker.C:
			s.processPendingCharges()
		case <-s.stopCh:
			return
		}
	}
}

// processPendingCharges procesa todos los cobros pendientes
func (s *SubscriptionScheduler) processPendingCharges() {
	ctx := context.Background()

	// Buscar suscripciones activas con next_charge_at <= NOW()
	rows, err := s.Pool.Query(ctx, `
		SELECT sub.id, sub.service_id, sub.user_id, s.amount, s.service_type,
		       s.frequency, s.name, s.organization_id, s.node_domain
		FROM organization_subscriptions sub
		JOIN organization_services s ON s.id = sub.service_id
		WHERE sub.status IN ('active', 'auto')
		  AND sub.next_charge_at IS NOT NULL
		  AND sub.next_charge_at <= NOW()
		  AND s.is_active = true
		  AND s.service_type IN ('subscription', 'benefit')`)
	if err != nil {
		log.Printf("SubscriptionScheduler: error querying pending charges: %v", err)
		return
	}
	defer rows.Close()

	type pendingCharge struct {
		SubID       uuid.UUID
		ServiceID   uuid.UUID
		UserID      uuid.UUID
		Amount      int64
		ServiceType string
		Frequency   string
		Name        string
		OrgID       uuid.UUID
		NodeDomain  string
	}

	var charges []pendingCharge
	for rows.Next() {
		var c pendingCharge
		if err := rows.Scan(&c.SubID, &c.ServiceID, &c.UserID, &c.Amount, &c.ServiceType,
			&c.Frequency, &c.Name, &c.OrgID, &c.NodeDomain); err != nil {
			log.Printf("SubscriptionScheduler: error scanning charge: %v", err)
			continue
		}
		charges = append(charges, c)
	}

	if len(charges) == 0 {
		return
	}

	log.Printf("SubscriptionScheduler: processing %d pending charges", len(charges))

	for _, c := range charges {
		s.processCharge(ctx, c.SubID, c.UserID, c.OrgID, c.Amount, c.ServiceType, c.Frequency, c.Name, c.NodeDomain)
	}
}

// processCharge procesa un cobro individual
func (s *SubscriptionScheduler) processCharge(
	ctx context.Context,
	subID uuid.UUID,
	userID uuid.UUID,
	orgID uuid.UUID,
	amount int64,
	serviceType string,
	frequency string,
	serviceName string,
	nodeDomain string,
) {
	if amount <= 0 {
		// Monto 0, solo actualizar fechas
		s.updateNextCharge(ctx, subID, frequency)
		return
	}

	var txID uuid.UUID
	var err error

	if serviceType == "benefit" {
		// La organizacion PAGA al miembro
		txID, err = s.createChargeTransaction(ctx, orgID, userID, amount, serviceName, nodeDomain)
	} else {
		// El miembro PAGA a la organizacion
		txID, err = s.createChargeTransaction(ctx, userID, orgID, amount, serviceName, nodeDomain)
	}

	if err != nil {
		log.Printf("SubscriptionScheduler: charge failed for sub %s: %v", subID, err)
		// Registrar fallo
		s.recordFailure(ctx, subID, userID, orgID, amount, serviceName, err.Error(), nodeDomain)
		// Reintentar en 1 dia
		s.updateNextChargeCustom(ctx, subID, time.Now().Add(24*time.Hour))
		return
	}

	// Actualizar fechas de cobro
	s.updateNextCharge(ctx, subID, frequency)

	// Notificar
	notify := NewNotifyService(s.Pool)
	if serviceType == "benefit" {
		notify.Notify(ctx, nodeDomain, userID, "payment_received",
			"Pago de servicio recibido",
			"Recibiste "+intToStr(amount)+" TQ de "+serviceName,
			"/app/history", nil)
	} else {
		notify.Notify(ctx, nodeDomain, userID, "subscription_charge",
			"Cobro de servicio",
			"Se desconto "+intToStr(amount)+" TQ por "+serviceName,
			"/app/history", nil)
	}

	log.Printf("SubscriptionScheduler: charged %d TQ from user %s for service %s (tx: %s)", amount, userID, serviceName, txID)
}

// createChargeTransaction crea una transaccion de cobro
func (s *SubscriptionScheduler) createChargeTransaction(
	ctx context.Context,
	fromID uuid.UUID,
	toID uuid.UUID,
	amount int64,
	description string,
	_ string,
) (uuid.UUID, error) {
	tx, err := s.ledger.InternalTransfer(ctx, ledger.InternalTransferParams{
		SenderID:      fromID,
		ReceiverID:    toID,
		Amount:        amount,
		UserSignature: "",
		NodeSignature: "",
	})
	if err != nil {
		return uuid.Nil, err
	}

	// Actualizar metadata con descripcion del servicio
	_, _ = s.Pool.Exec(ctx, `
		UPDATE transactions SET metadata = $2, tx_type = 'subscription_charge' WHERE id = $1`,
		tx.ID, `{"description": "`+description+`", "type": "subscription"}`)

	return tx.ID, nil
}

// updateNextCharge calcula y actualiza la fecha del proximo cobro
func (s *SubscriptionScheduler) updateNextCharge(ctx context.Context, subID uuid.UUID, frequency string) {
	var nextCharge time.Time
	now := time.Now()
	switch frequency {
	case "monthly":
		nextCharge = now.AddDate(0, 1, 0)
	case "quarterly":
		nextCharge = now.AddDate(0, 3, 0)
	case "annual":
		nextCharge = now.AddDate(1, 0, 0)
	default:
		nextCharge = now.AddDate(0, 1, 0) // default monthly
	}
	s.updateNextChargeCustom(ctx, subID, nextCharge)
}

func (s *SubscriptionScheduler) updateNextChargeCustom(ctx context.Context, subID uuid.UUID, nextCharge time.Time) {
	_, _ = s.Pool.Exec(ctx, `
		UPDATE organization_subscriptions SET last_charged_at = NOW(), next_charge_at = $2
		WHERE id = $1`, subID, nextCharge)
}

// recordFailure registra un cobro fallido
func (s *SubscriptionScheduler) recordFailure(
	ctx context.Context,
	subID uuid.UUID,
	userID uuid.UUID,
	orgID uuid.UUID,
	amount int64,
	serviceName string,
	reason string,
	nodeDomain string,
) {
	_, _ = s.Pool.Exec(ctx, `
		INSERT INTO subscription_charge_failures (node_domain, subscription_id, user_id, organization_id, service_name, amount, failure_reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		nodeDomain, subID, userID, orgID, serviceName, amount, reason)
}

func intToStr(n int64) string {
	return fmt.Sprintf("%d", n)
}
