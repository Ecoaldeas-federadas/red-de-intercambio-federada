package accounts

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Service representa un servicio que ofrece una organizacion
type Service struct {
	ID                 uuid.UUID  `json:"id"`
	NodeDomain         string     `json:"node_domain"`
	OrganizationID     uuid.UUID  `json:"organization_id"`
	Name               string     `json:"name"`
	Description        string     `json:"description"`
	ServiceType        string     `json:"service_type"`
	Amount             int64      `json:"amount"`
	Frequency          string     `json:"frequency"`
	IsMandatory        bool       `json:"is_mandatory"`
	Obligations        string     `json:"obligations"`
	Rights             string     `json:"rights"`
	Duties             string     `json:"duties"`
	IsActive           bool       `json:"is_active"`
	CreatedByProposal  *uuid.UUID `json:"created_by_proposal"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	OrganizationName   string     `json:"organization_name,omitempty"`
	SubscribersCount   int        `json:"subscribers_count,omitempty"`
}

// Subscription representa la suscripcion de un usuario a un servicio
type Subscription struct {
	ID            uuid.UUID  `json:"id"`
	ServiceID     uuid.UUID  `json:"service_id"`
	UserID        uuid.UUID  `json:"user_id"`
	Status        string     `json:"status"`
	JoinedAt      time.Time  `json:"joined_at"`
	LeftAt        *time.Time `json:"left_at"`
	LastChargedAt *time.Time `json:"last_charged_at"`
	NextChargeAt  *time.Time `json:"next_charge_at"`
	CreatedAt     time.Time  `json:"created_at"`
	// Campos joined para conveniencia
	ServiceName    string `json:"service_name,omitempty"`
	OrgName        string `json:"org_name,omitempty"`
	Amount         int64  `json:"amount,omitempty"`
	Frequency      string `json:"frequency,omitempty"`
	IsMandatory    bool   `json:"is_mandatory,omitempty"`
}

type Services struct {
	Pool *pgxpool.Pool
}

func NewServices(pool *pgxpool.Pool) *Services {
	return &Services{Pool: pool}
}

// CreateService crea un nuevo servicio de organizacion
func (s *Services) CreateService(ctx context.Context, svc *Service) (*Service, error) {
	var id uuid.UUID
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO organization_services (node_domain, organization_id, name, description, service_type, amount, frequency, is_mandatory, obligations, rights, duties, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
		RETURNING id, created_at, updated_at`,
		svc.NodeDomain, svc.OrganizationID, svc.Name, svc.Description, svc.ServiceType,
		svc.Amount, svc.Frequency, svc.IsMandatory, svc.Obligations, svc.Rights, svc.Duties,
	).Scan(&id, &svc.CreatedAt, &svc.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating service: %w", err)
	}
	svc.ID = id
	svc.IsActive = true
	return svc, nil
}

// ListServices lista los servicios de una organizacion
func (s *Services) ListServices(ctx context.Context, orgID uuid.UUID) ([]Service, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT s.id, s.node_domain, s.organization_id, s.name, COALESCE(s.description, ''),
			   s.service_type, s.amount, s.frequency, s.is_mandatory,
			   COALESCE(s.obligations, ''), COALESCE(s.rights, ''), COALESCE(s.duties, ''),
			   s.is_active, s.created_by_proposal, s.created_at, s.updated_at,
			   COALESCE(o.display_name, o.username, ''),
			   (SELECT COUNT(*) FROM organization_subscriptions sub WHERE sub.service_id = s.id AND sub.status IN ('active', 'auto'))
		FROM organization_services s
		LEFT JOIN users o ON o.id = s.organization_id
		WHERE s.organization_id = $1
		ORDER BY s.is_active DESC, s.created_at DESC`, orgID)
	if err != nil {
		return nil, fmt.Errorf("listing services: %w", err)
	}
	defer rows.Close()

	var services []Service
	for rows.Next() {
		var svc Service
		var proposalID *uuid.UUID
		if err := rows.Scan(&svc.ID, &svc.NodeDomain, &svc.OrganizationID, &svc.Name, &svc.Description,
			&svc.ServiceType, &svc.Amount, &svc.Frequency, &svc.IsMandatory,
			&svc.Obligations, &svc.Rights, &svc.Duties,
			&svc.IsActive, &proposalID, &svc.CreatedAt, &svc.UpdatedAt,
			&svc.OrganizationName, &svc.SubscribersCount); err != nil {
			return nil, fmt.Errorf("scanning service: %w", err)
		}
		svc.CreatedByProposal = proposalID
		services = append(services, svc)
	}
	return services, nil
}

// ListAssemblyServices lista los servicios obligatorios de organizaciones de la Asamblea
func (s *Services) ListAssemblyServices(ctx context.Context, nodeDomain string) ([]Service, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT s.id, s.node_domain, s.organization_id, s.name, COALESCE(s.description, ''),
			   s.service_type, s.amount, s.frequency, s.is_mandatory,
			   COALESCE(s.obligations, ''), COALESCE(s.rights, ''), COALESCE(s.duties, ''),
			   s.is_active, s.created_by_proposal, s.created_at, s.updated_at,
			   COALESCE(o.display_name, o.username, ''),
			   (SELECT COUNT(*) FROM organization_subscriptions sub WHERE sub.service_id = s.id AND sub.status IN ('active', 'auto'))
		FROM organization_services s
		JOIN users o ON o.id = s.organization_id
		WHERE s.node_domain = $1 AND o.is_assembly_owned = true AND s.is_active = true
		ORDER BY s.name`, nodeDomain)
	if err != nil {
		return nil, fmt.Errorf("listing assembly services: %w", err)
	}
	defer rows.Close()

	var services []Service
	for rows.Next() {
		var svc Service
		var proposalID *uuid.UUID
		if err := rows.Scan(&svc.ID, &svc.NodeDomain, &svc.OrganizationID, &svc.Name, &svc.Description,
			&svc.ServiceType, &svc.Amount, &svc.Frequency, &svc.IsMandatory,
			&svc.Obligations, &svc.Rights, &svc.Duties,
			&svc.IsActive, &proposalID, &svc.CreatedAt, &svc.UpdatedAt,
			&svc.OrganizationName, &svc.SubscribersCount); err != nil {
			return nil, fmt.Errorf("scanning assembly service: %w", err)
		}
		svc.CreatedByProposal = proposalID
		services = append(services, svc)
	}
	return services, nil
}

// UpdateService actualiza un servicio existente
func (s *Services) UpdateService(ctx context.Context, serviceID uuid.UUID, svc *Service) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE organization_services SET name = $2, description = $3, amount = $4, frequency = $5,
			obligations = $6, rights = $7, duties = $8, updated_at = NOW()
		WHERE id = $1`,
		serviceID, svc.Name, svc.Description, svc.Amount, svc.Frequency,
		svc.Obligations, svc.Rights, svc.Duties)
	if err != nil {
		return fmt.Errorf("updating service: %w", err)
	}
	return nil
}

// DeactivateService desactiva un servicio (no borra)
func (s *Services) DeactivateService(ctx context.Context, serviceID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `UPDATE organization_services SET is_active = false, updated_at = NOW() WHERE id = $1`, serviceID)
	if err != nil {
		return fmt.Errorf("deactivating service: %w", err)
	}
	return nil
}

// Subscribe suscribe un usuario a un servicio
func (s *Services) Subscribe(ctx context.Context, serviceID, userID uuid.UUID, isAuto bool) error {
	status := "active"
	if isAuto {
		status = "auto"
	}
	// Calcular proximo cobro (fin del mes actual)
	nextCharge := time.Now().AddDate(0, 1, 0)
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO organization_subscriptions (service_id, user_id, status, next_charge_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (service_id, user_id) DO UPDATE SET status = $3, left_at = NULL, next_charge_at = $4`,
		serviceID, userID, status, nextCharge)
	if err != nil {
		return fmt.Errorf("subscribing: %w", err)
	}
	return nil
}

// Unsubscribe desuscribe un usuario de un servicio voluntario
func (s *Services) Unsubscribe(ctx context.Context, serviceID, userID uuid.UUID) error {
	// No permitir desuscribirse de servicios auto (Asamblea)
	var status string
	_ = s.Pool.QueryRow(ctx, `SELECT status FROM organization_subscriptions WHERE service_id = $1 AND user_id = $2`, serviceID, userID).Scan(&status)
	if status == "auto" {
		return fmt.Errorf("no se puede cancelar un servicio obligatorio de la Asamblea")
	}
	_, err := s.Pool.Exec(ctx, `
		UPDATE organization_subscriptions SET status = 'cancelled', left_at = NOW(), next_charge_at = NULL
		WHERE service_id = $1 AND user_id = $2 AND status != 'auto'`,
		serviceID, userID)
	if err != nil {
		return fmt.Errorf("unsubscribing: %w", err)
	}
	return nil
}

// ListUserSubscriptions lista las suscripciones activas de un usuario
func (s *Services) ListUserSubscriptions(ctx context.Context, userID uuid.UUID) ([]Subscription, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT sub.id, sub.service_id, sub.user_id, sub.status, sub.joined_at, sub.left_at,
			   sub.last_charged_at, sub.next_charge_at, sub.created_at,
			   COALESCE(s.name, ''), COALESCE(o.display_name, o.username, ''),
			   s.amount, s.frequency, s.is_mandatory
		FROM organization_subscriptions sub
		JOIN organization_services s ON s.id = sub.service_id
		LEFT JOIN users o ON o.id = s.organization_id
		WHERE sub.user_id = $1 AND sub.status IN ('active', 'auto')
		ORDER BY sub.next_charge_at ASC NULLS LAST`, userID)
	if err != nil {
		return nil, fmt.Errorf("listing user subscriptions: %w", err)
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var sub Subscription
		if err := rows.Scan(&sub.ID, &sub.ServiceID, &sub.UserID, &sub.Status, &sub.JoinedAt, &sub.LeftAt,
			&sub.LastChargedAt, &sub.NextChargeAt, &sub.CreatedAt,
			&sub.ServiceName, &sub.OrgName, &sub.Amount, &sub.Frequency, &sub.IsMandatory); err != nil {
			return nil, fmt.Errorf("scanning subscription: %w", err)
		}
		subs = append(subs, sub)
	}
	return subs, nil
}

// ListServiceSubscriptions lista los suscriptores de un servicio
func (s *Services) ListServiceSubscriptions(ctx context.Context, serviceID uuid.UUID) ([]Subscription, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT sub.id, sub.service_id, sub.user_id, sub.status, sub.joined_at, sub.left_at,
			   sub.last_charged_at, sub.next_charge_at, sub.created_at,
			   COALESCE(u.display_name, u.username, '')
		FROM organization_subscriptions sub
		LEFT JOIN users u ON u.id = sub.user_id
		WHERE sub.service_id = $1
		ORDER BY sub.joined_at DESC`, serviceID)
	if err != nil {
		return nil, fmt.Errorf("listing service subscriptions: %w", err)
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var sub Subscription
		if err := rows.Scan(&sub.ID, &sub.ServiceID, &sub.UserID, &sub.Status, &sub.JoinedAt, &sub.LeftAt,
			&sub.LastChargedAt, &sub.NextChargeAt, &sub.CreatedAt,
			&sub.OrgName); err != nil {
			return nil, fmt.Errorf("scanning service subscription: %w", err)
		}
		subs = append(subs, sub)
	}
	return subs, nil
}

// AutoSubscribeAllMembers suscribe a todos los miembros activos del nodo a un servicio
func (s *Services) AutoSubscribeAllMembers(ctx context.Context, serviceID uuid.UUID, nodeDomain string) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO organization_subscriptions (service_id, user_id, status, next_charge_at)
		SELECT $1, u.id, 'auto', NOW() + interval '1 month'
		FROM users u
		WHERE u.node_domain = $2 AND u.account_type = 'individual' AND u.membership_status = 'active'
		ON CONFLICT (service_id, user_id) DO UPDATE SET status = 'auto', left_at = NULL, next_charge_at = NOW() + interval '1 month'`,
		serviceID, nodeDomain)
	if err != nil {
		return fmt.Errorf("auto-subscribing all members: %w", err)
	}
	return nil
}

// AutoSubscribeNewMember suscribe un nuevo miembro a todos los servicios obligatorios de la Asamblea
func (s *Services) AutoSubscribeNewMember(ctx context.Context, userID uuid.UUID, nodeDomain string) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO organization_subscriptions (service_id, user_id, status, next_charge_at)
		SELECT s.id, $1, 'auto', NOW() + interval '1 month'
		FROM organization_services s
		JOIN users o ON o.id = s.organization_id
		WHERE s.node_domain = $2 AND o.is_assembly_owned = true AND s.is_active = true AND s.is_mandatory = true
		ON CONFLICT (service_id, user_id) DO UPDATE SET status = 'auto', left_at = NULL, next_charge_at = NOW() + interval '1 month'`,
		userID, nodeDomain)
	if err != nil {
		return fmt.Errorf("auto-subscribing new member: %w", err)
	}
	return nil
}
