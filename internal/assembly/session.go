package assembly

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Assembly struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Assembly {
	return &Assembly{Pool: pool}
}

type Session struct {
	ID          uuid.UUID  `json:"id"`
	NodeDomain  string     `json:"node_domain"`
	SessionType string     `json:"session_type"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
}

type Decision struct {
	ID                uuid.UUID  `json:"id"`
	AssemblyID        uuid.UUID  `json:"assembly_id"`
	DecisionType      string     `json:"decision_type"`
	TargetAccount     *uuid.UUID `json:"target_account"`
	Description       string     `json:"description"`
	OldValue          map[string]interface{} `json:"old_value"`
	NewValue          map[string]interface{} `json:"new_value"`
	RequiredSignatures int       `json:"required_signatures"`
	Status            string     `json:"status"`
	CreatedAt         time.Time  `json:"created_at"`
}

func (a *Assembly) CreateSession(ctx context.Context, nodeDomain, sessionType, title, description string, startTime time.Time) (*Session, error) {
	var s Session
	err := a.Pool.QueryRow(ctx, `
		INSERT INTO assembly_sessions (node_domain, session_type, title, description, start_time, status)
		VALUES ($1, $2, $3, $4, $5, 'scheduled')
		RETURNING id, node_domain, session_type, title, description, start_time, end_time, status, created_at`,
		nodeDomain, sessionType, title, description, startTime,
	).Scan(&s.ID, &s.NodeDomain, &s.SessionType, &s.Title, &s.Description, &s.StartTime, &s.EndTime, &s.Status, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating assembly session: %w", err)
	}
	return &s, nil
}

func (a *Assembly) ListSessions(ctx context.Context, nodeDomain string) ([]Session, error) {
	rows, err := a.Pool.Query(ctx, `
		SELECT id, node_domain, session_type, title, description, start_time, end_time, status, created_at
		FROM assembly_sessions WHERE node_domain = $1 ORDER BY start_time DESC`,
		nodeDomain,
	)
	if err != nil {
		return nil, fmt.Errorf("listing assembly sessions: %w", err)
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		err := rows.Scan(&s.ID, &s.NodeDomain, &s.SessionType, &s.Title, &s.Description, &s.StartTime, &s.EndTime, &s.Status, &s.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning session: %w", err)
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (a *Assembly) CloseSession(ctx context.Context, sessionID uuid.UUID) error {
	_, err := a.Pool.Exec(ctx, `
		UPDATE assembly_sessions SET status = 'closed', end_time = NOW() WHERE id = $1`,
		sessionID,
	)
	if err != nil {
		return fmt.Errorf("closing session: %w", err)
	}
	return nil
}

func (a *Assembly) CreateDecision(ctx context.Context, assemblyID uuid.UUID, decisionType, description string, targetAccount *uuid.UUID, oldValue, newValue map[string]interface{}, requiredSignatures int) (*Decision, error) {
	var d Decision
	err := a.Pool.QueryRow(ctx, `
		INSERT INTO assembly_decisions (assembly_id, decision_type, target_account, description, old_value, new_value, required_signatures, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
		RETURNING id, assembly_id, decision_type, target_account, description, old_value, new_value, required_signatures, status, created_at`,
		assemblyID, decisionType, targetAccount, description, oldValue, newValue, requiredSignatures,
	).Scan(&d.ID, &d.AssemblyID, &d.DecisionType, &d.TargetAccount, &d.Description, &d.OldValue, &d.NewValue, &d.RequiredSignatures, &d.Status, &d.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating decision: %w", err)
	}
	return &d, nil
}

func (a *Assembly) SignDecision(ctx context.Context, decisionID, signerID uuid.UUID, signature string) error {
	_, err := a.Pool.Exec(ctx, `
		INSERT INTO approval_signatures (assembly_decision_id, signer_id, signature, condition_type)
		VALUES ($1, $2, $3, 'specific_signers')`,
		decisionID, signerID, signature,
	)
	if err != nil {
		return fmt.Errorf("signing decision: %w", err)
	}
	return nil
}

func (a *Assembly) ListDecisions(ctx context.Context, assemblyID uuid.UUID) ([]Decision, error) {
	rows, err := a.Pool.Query(ctx, `
		SELECT id, assembly_id, decision_type, target_account, description, old_value, new_value, required_signatures, status, created_at
		FROM assembly_decisions WHERE assembly_id = $1 ORDER BY created_at DESC`,
		assemblyID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing decisions: %w", err)
	}
	defer rows.Close()

	var decisions []Decision
	for rows.Next() {
		var d Decision
		err := rows.Scan(&d.ID, &d.AssemblyID, &d.DecisionType, &d.TargetAccount, &d.Description, &d.OldValue, &d.NewValue, &d.RequiredSignatures, &d.Status, &d.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning decision: %w", err)
		}
		decisions = append(decisions, d)
	}
	return decisions, nil
}
