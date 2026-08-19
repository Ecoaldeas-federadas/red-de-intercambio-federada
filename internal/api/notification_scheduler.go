package api

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NotificationScheduler ejecuta tareas periodicas para generar notificaciones
// automaticas: avisos de votaciones por cerrar, asambleas proximas, etc.
type NotificationScheduler struct {
	Pool       *pgxpool.Pool
	nodeDomain string
	notify     *NotifyService
	stopCh     chan struct{}
}

// NewNotificationScheduler crea un nuevo scheduler
func NewNotificationScheduler(pool *pgxpool.Pool, nodeDomain string) *NotificationScheduler {
	return &NotificationScheduler{
		Pool:       pool,
		nodeDomain: nodeDomain,
		notify:     NewNotifyService(pool),
		stopCh:     make(chan struct{}),
	}
}

// Start inicia el scheduler en background. Ejecuta cada hora.
func (s *NotificationScheduler) Start() {
	go s.run()
}

// Stop detiene el scheduler
func (s *NotificationScheduler) Stop() {
	close(s.stopCh)
}

func (s *NotificationScheduler) run() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	// Ejecutar inmediatamente al iniciar
	s.checkAll()

	for {
		select {
		case <-ticker.C:
			s.checkAll()
		case <-s.stopCh:
			return
		}
	}
}

func (s *NotificationScheduler) checkAll() {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	s.checkVotingDeadlines(ctx)
	s.checkUpcomingAssemblies(ctx)
}

// checkVotingDeadlines busca propuestas con votacion activa que vencen en menos de 6 horas
// y notifica a los miembros que aun no han votado
func (s *NotificationScheduler) checkVotingDeadlines(ctx context.Context) {
	// Buscar propuestas pending con deadline en menos de 6 horas que no hayan sido notificadas
	rows, err := s.Pool.Query(ctx, `
		SELECT d.id, d.description, d.voting_deadline, d.assembly_id, s.node_domain
		FROM assembly_decisions d
		JOIN assembly_sessions s ON s.id = d.assembly_id
		WHERE d.status = 'pending'
		  AND d.voting_deadline IS NOT NULL
		  AND d.voting_deadline > NOW()
		  AND d.voting_deadline < NOW() + INTERVAL '6 hours'
		  AND (d.metadata->>'deadline_notified' IS NULL OR d.metadata->>'deadline_notified' = 'false')`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var decisionID, assemblyID interface{}
		var description string
		var deadline time.Time
		var nodeDomain string
		rows.Scan(&decisionID, &description, &deadline, &assemblyID, &nodeDomain)

		// Notificar a miembros con voto que no han votado
		s.notifyNonVoters(ctx, nodeDomain, decisionID, description, deadline)
	}
}

func (s *NotificationScheduler) notifyNonVoters(ctx context.Context, nodeDomain string, decisionID interface{}, description string, deadline time.Time) {
	// Obtener miembros con voto que no han votado en esta propuesta
	rows, err := s.Pool.Query(ctx, `
		SELECT u.id FROM users u
		JOIN member_levels ml ON ml.id = u.member_level_id
		WHERE u.node_domain = $1 AND u.membership_status = 'active'
		  AND ml.has_vote = true
		  AND u.id NOT IN (SELECT voter_id FROM assembly_votes WHERE decision_id = $2)`,
		nodeDomain, decisionID)
	if err != nil {
		return
	}
	defer rows.Close()

	timeLeft := time.Until(deadline)
	timeLeftStr := fmt.Sprintf("%d horas", int(timeLeft.Hours()))
	if timeLeft.Hours() < 1 {
		timeLeftStr = fmt.Sprintf("%d minutos", int(timeLeft.Minutes()))
	}

	for rows.Next() {
		var userID uuid.UUID
		rows.Scan(&userID)
		s.notify.Notify(ctx, nodeDomain, userID, "proposal_closing",
			"Votacion por cerrar",
			fmt.Sprintf("Quedan %s para votar: %s", timeLeftStr, description),
			"/app/assembly",
			map[string]interface{}{"decision_id": decisionID, "time_left": timeLeftStr})
	}

	// Marcar como notificado
	s.Pool.Exec(ctx, `
		UPDATE assembly_decisions SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"deadline_notified": true}'::jsonb
		WHERE id = $1`, decisionID)
}

// checkUpcomingAssemblies busca asambleas programadas en las proximas 24-48 horas
// y notifica a los miembros
func (s *NotificationScheduler) checkUpcomingAssemblies(ctx context.Context) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, node_domain, title, session_type, start_time
		FROM assembly_sessions
		WHERE status = 'scheduled'
		  AND start_time > NOW() + INTERVAL '24 hours'
		  AND start_time < NOW() + INTERVAL '48 hours'
		  AND (metadata->>'reminder_sent' IS NULL OR metadata->>'reminder_sent' = 'false')`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var sessionID interface{}
		var nodeDomain, title, sessionType string
		var startTime time.Time
		rows.Scan(&sessionID, &nodeDomain, &title, &sessionType, &startTime)

		// Notificar a miembros con voto
		s.notify.NotifyVotingMembers(ctx, nodeDomain, "assembly_reminder",
			"Asamblea proxima",
			fmt.Sprintf("La asamblea \"%s\" es manana a las %s.", title, startTime.Format("02/01/2006 15:04")),
			"/app/assembly",
			map[string]interface{}{"session_id": sessionID, "start_time": startTime.Format(time.RFC3339)})

		// Marcar recordatorio enviado
		s.Pool.Exec(ctx, `
			UPDATE assembly_sessions SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"reminder_sent": true}'::jsonb
			WHERE id = $1`, sessionID)
	}
}
