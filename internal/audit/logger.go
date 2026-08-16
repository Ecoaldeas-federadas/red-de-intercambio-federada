package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Auditor struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Auditor {
	return &Auditor{Pool: pool}
}

type AuditEntry struct {
	ID        int64                  `json:"id"`
	ActorID   *uuid.UUID             `json:"actor_id"`
	Action    string                 `json:"action"`
	TargetID  *uuid.UUID             `json:"target_id"`
	Details   map[string]interface{} `json:"details"`
	IPAddress string                 `json:"ip_address"`
	UserAgent string                 `json:"user_agent"`
	CreatedAt time.Time              `json:"created_at"`
}

func (a *Auditor) Log(ctx context.Context, actorID *uuid.UUID, action string, targetID *uuid.UUID, details map[string]interface{}, ip net.IP, userAgent string) error {
	_, err := a.Pool.Exec(ctx, `
		INSERT INTO audit_log (actor_id, action, target_id, details, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		actorID, action, targetID, details, ip, userAgent,
	)
	if err != nil {
		return fmt.Errorf("logging audit entry: %w", err)
	}
	return nil
}

func (a *Auditor) List(ctx context.Context, limit, offset int, action string) ([]AuditEntry, error) {
	query := `SELECT id, actor_id, action, target_id, details, ip_address::text, user_agent, created_at FROM audit_log`
	args := []interface{}{}
	if action != "" {
		query += ` WHERE action = $1`
		args = append(args, action)
	}
	query += ` ORDER BY created_at DESC`
	if limit > 0 {
		if len(args) > 0 {
			query += fmt.Sprintf(` LIMIT $%d`, len(args)+1)
		} else {
			query += ` LIMIT $1`
		}
		args = append(args, limit)
	}
	if offset > 0 {
		if len(args) > 0 {
			query += fmt.Sprintf(` OFFSET $%d`, len(args)+1)
		} else {
			query += ` OFFSET $1`
		}
		args = append(args, offset)
	}

	rows, err := a.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing audit entries: %w", err)
	}
	defer rows.Close()

	var entries []AuditEntry
	for rows.Next() {
		var e AuditEntry
		var details []byte
		err := rows.Scan(&e.ID, &e.ActorID, &e.Action, &e.TargetID, &details, &e.IPAddress, &e.UserAgent, &e.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning audit entry: %w", err)
		}
		if details != nil {
			json.Unmarshal(details, &e.Details)
		}
		entries = append(entries, e)
	}
	return entries, nil
}
