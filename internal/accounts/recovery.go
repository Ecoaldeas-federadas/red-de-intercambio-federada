package accounts

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Recovery struct {
	Pool *pgxpool.Pool
}

func NewRecovery(pool *pgxpool.Pool) *Recovery {
	return &Recovery{Pool: pool}
}

type RecoveryConfig struct {
	ID                          int       `json:"id"`
	NodeDomain                  string    `json:"node_domain"`
	ApprovalMode                string    `json:"approval_mode"`
	RequiredApprovals           int       `json:"required_approvals"`
	CouncilGroupID              *uuid.UUID `json:"council_group_id"`
	AutoExpireHours             int       `json:"auto_expire_hours"`
	RequiresIdentityVerification bool      `json:"requires_identity_verification"`
	UpdatedAt                   time.Time `json:"updated_at"`
}

type RecoveryRequest struct {
	ID                uuid.UUID  `json:"id"`
	NodeDomain        string     `json:"node_domain"`
	TargetUserID      *uuid.UUID `json:"target_user_id"`
	TargetUsername    string     `json:"target_username"`
	RequesterID       *uuid.UUID `json:"requester_id"`
	Reason            string     `json:"reason"`
	IdentityVerification map[string]interface{} `json:"identity_verification"`
	Status            string     `json:"status"`
	ApprovalMode      string     `json:"approval_mode"`
	RequiredApprovals int        `json:"required_approvals"`
	CouncilGroupID    *uuid.UUID `json:"council_group_id"`
	ApprovedBy        []uuid.UUID `json:"approved_by"`
	RejectedBy        []uuid.UUID `json:"rejected_by"`
	RejectionReason   string     `json:"rejection_reason"`
	ExpiresAt         time.Time  `json:"expires_at"`
	ApprovedAt        *time.Time `json:"approved_at"`
	RejectedAt        *time.Time `json:"rejected_at"`
	CompletedAt       *time.Time `json:"completed_at"`
	NewPublicKey      *string    `json:"new_public_key"`
	CreatedAt         time.Time  `json:"created_at"`
}

type RecoveryApproval struct {
	ID                uuid.UUID  `json:"id"`
	RecoveryRequestID uuid.UUID  `json:"recovery_request_id"`
	ApproverID        uuid.UUID  `json:"approver_id"`
	ApprovalType      string     `json:"approval_type"`
	Signature         *string    `json:"signature"`
	GroupID           *uuid.UUID `json:"group_id"`
	Notes             string     `json:"notes"`
	CreatedAt         time.Time  `json:"created_at"`
}

type InvitationCode struct {
	ID           uuid.UUID  `json:"id"`
	NodeDomain   string     `json:"node_domain"`
	CodeHash     string     `json:"code_hash"`
	CreatedBy    *uuid.UUID `json:"created_by"`
	UsedBy       *uuid.UUID `json:"used_by"`
	MaxUses      int        `json:"max_uses"`
	UseCount     int        `json:"use_count"`
	ProposedLevel string    `json:"proposed_level"`
	ExpiresAt    *time.Time `json:"expires_at"`
	IsActive     bool       `json:"is_active"`
	CreatedAt    time.Time  `json:"created_at"`
	UsedAt       *time.Time `json:"used_at"`
}

func (r *Recovery) GetConfig(ctx context.Context, nodeDomain string) (*RecoveryConfig, error) {
	var cfg RecoveryConfig
	err := r.Pool.QueryRow(ctx, `
		SELECT id, node_domain, approval_mode, required_approvals, council_group_id,
			   auto_expire_hours, requires_identity_verification, updated_at
		FROM recovery_config WHERE node_domain = $1`,
		nodeDomain,
	).Scan(&cfg.ID, &cfg.NodeDomain, &cfg.ApprovalMode, &cfg.RequiredApprovals,
		&cfg.CouncilGroupID, &cfg.AutoExpireHours, &cfg.RequiresIdentityVerification, &cfg.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("getting recovery config: %w", err)
	}
	return &cfg, nil
}

func (r *Recovery) UpdateConfig(ctx context.Context, nodeDomain, approvalMode string, requiredApprovals int, councilGroupID *uuid.UUID, autoExpireHours int, requiresIdentityVerification bool, updatedBy uuid.UUID) error {
	_, err := r.Pool.Exec(ctx, `
		UPDATE recovery_config
		SET approval_mode = $2, required_approvals = $3, council_group_id = $4,
			auto_expire_hours = $5, requires_identity_verification = $6,
			updated_by_assembly = $7, updated_at = NOW()
		WHERE node_domain = $1`,
		nodeDomain, approvalMode, requiredApprovals, councilGroupID,
		autoExpireHours, requiresIdentityVerification, updatedBy)
	if err != nil {
		return fmt.Errorf("updating recovery config: %w", err)
	}
	return nil
}

func (r *Recovery) CreateRequest(ctx context.Context, nodeDomain, targetUsername string, requesterID *uuid.UUID, reason string, identityVerification map[string]interface{}) (*RecoveryRequest, error) {
	cfg, err := r.GetConfig(ctx, nodeDomain)
	if err != nil {
		return nil, fmt.Errorf("loading recovery config: %w", err)
	}

	var targetUserID *uuid.UUID
	err = r.Pool.QueryRow(ctx, `SELECT id FROM users WHERE node_domain = $1 AND username = $2`, nodeDomain, targetUsername).Scan(&targetUserID)
	if err != nil {
		targetUserID = nil
	}

	expiresAt := time.Now().Add(time.Duration(cfg.AutoExpireHours) * time.Hour)

	var req RecoveryRequest
	err = r.Pool.QueryRow(ctx, `
		INSERT INTO recovery_requests (node_domain, target_user_id, target_username, requester_id,
			reason, identity_verification, status, approval_mode, required_approvals,
			council_group_id, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10)
		RETURNING id, node_domain, target_user_id, target_username, requester_id, reason,
			identity_verification, status, approval_mode, required_approvals, council_group_id,
			approved_by, rejected_by, rejection_reason, expires_at, approved_at, rejected_at,
			completed_at, new_public_key, created_at`,
		nodeDomain, targetUserID, targetUsername, requesterID, reason, identityVerification,
		cfg.ApprovalMode, cfg.RequiredApprovals, cfg.CouncilGroupID, expiresAt,
	).Scan(&req.ID, &req.NodeDomain, &req.TargetUserID, &req.TargetUsername, &req.RequesterID,
		&req.Reason, &req.IdentityVerification, &req.Status, &req.ApprovalMode,
		&req.RequiredApprovals, &req.CouncilGroupID, &req.ApprovedBy, &req.RejectedBy,
		&req.RejectionReason, &req.ExpiresAt, &req.ApprovedAt, &req.RejectedAt,
		&req.CompletedAt, &req.NewPublicKey, &req.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating recovery request: %w", err)
	}
	return &req, nil
}

func (r *Recovery) ListRequests(ctx context.Context, nodeDomain, status string) ([]RecoveryRequest, error) {
	query := `SELECT id, node_domain, target_user_id, target_username, requester_id, reason,
		identity_verification, status, approval_mode, required_approvals, council_group_id,
		approved_by, rejected_by, rejection_reason, expires_at, approved_at, rejected_at,
		completed_at, new_public_key, created_at
		FROM recovery_requests WHERE node_domain = $1`
	args := []interface{}{nodeDomain}
	if status != "" {
		query += ` AND status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing recovery requests: %w", err)
	}
	defer rows.Close()

	var reqs []RecoveryRequest
	for rows.Next() {
		var req RecoveryRequest
		err := rows.Scan(&req.ID, &req.NodeDomain, &req.TargetUserID, &req.TargetUsername,
			&req.RequesterID, &req.Reason, &req.IdentityVerification, &req.Status,
			&req.ApprovalMode, &req.RequiredApprovals, &req.CouncilGroupID,
			&req.ApprovedBy, &req.RejectedBy, &req.RejectionReason, &req.ExpiresAt,
			&req.ApprovedAt, &req.RejectedAt, &req.CompletedAt, &req.NewPublicKey, &req.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning recovery request: %w", err)
		}
		reqs = append(reqs, req)
	}
	return reqs, nil
}

func (r *Recovery) GetRequest(ctx context.Context, reqID uuid.UUID) (*RecoveryRequest, error) {
	var req RecoveryRequest
	err := r.Pool.QueryRow(ctx, `
		SELECT id, node_domain, target_user_id, target_username, requester_id, reason,
			identity_verification, status, approval_mode, required_approvals, council_group_id,
			approved_by, rejected_by, rejection_reason, expires_at, approved_at, rejected_at,
			completed_at, new_public_key, created_at
		FROM recovery_requests WHERE id = $1`,
		reqID,
	).Scan(&req.ID, &req.NodeDomain, &req.TargetUserID, &req.TargetUsername,
		&req.RequesterID, &req.Reason, &req.IdentityVerification, &req.Status,
		&req.ApprovalMode, &req.RequiredApprovals, &req.CouncilGroupID,
		&req.ApprovedBy, &req.RejectedBy, &req.RejectionReason, &req.ExpiresAt,
		&req.ApprovedAt, &req.RejectedAt, &req.CompletedAt, &req.NewPublicKey, &req.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("getting recovery request: %w", err)
	}
	return &req, nil
}

func (r *Recovery) ApproveRequest(ctx context.Context, reqID, approverID uuid.UUID, approvalType string, signature *string, groupID *uuid.UUID, notes string) (*RecoveryRequest, error) {
	req, err := r.GetRequest(ctx, reqID)
	if err != nil {
		return nil, err
	}
	if req.Status != "pending" {
		return nil, fmt.Errorf("request is not pending (status: %s)", req.Status)
	}
	if time.Now().After(req.ExpiresAt) {
		_, _ = r.Pool.Exec(ctx, `UPDATE recovery_requests SET status = 'expired' WHERE id = $1`, reqID)
		return nil, fmt.Errorf("request has expired")
	}

	for _, a := range req.ApprovedBy {
		if a == approverID {
			return nil, fmt.Errorf("approver has already approved this request")
		}
	}

	if req.ApprovalMode == "council" && req.CouncilGroupID != nil {
		var isMember bool
		err = r.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM member_group_members WHERE group_id = $1 AND user_id = $2)`, *req.CouncilGroupID, approverID).Scan(&isMember)
		if err != nil || !isMember {
			return nil, fmt.Errorf("approver is not a member of the designated council")
		}
	}

	_, err = r.Pool.Exec(ctx, `
		INSERT INTO recovery_approvals (recovery_request_id, approver_id, approval_type, signature, group_id, notes)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		reqID, approverID, approvalType, signature, groupID, notes)
	if err != nil {
		return nil, fmt.Errorf("recording approval: %w", err)
	}

	_, err = r.Pool.Exec(ctx, `
		UPDATE recovery_requests SET approved_by = array_append(approved_by, $2) WHERE id = $1`,
		reqID, approverID)
	if err != nil {
		return nil, fmt.Errorf("appending approver: %w", err)
	}

	req, err = r.GetRequest(ctx, reqID)
	if err != nil {
		return nil, err
	}

	if len(req.ApprovedBy) >= req.RequiredApprovals {
		_, err = r.Pool.Exec(ctx, `
			UPDATE recovery_requests SET status = 'approved', approved_at = NOW() WHERE id = $1`,
			reqID)
		if err != nil {
			return nil, fmt.Errorf("marking as approved: %w", err)
		}
		req.Status = "approved"
	}

	return req, nil
}

func (r *Recovery) RejectRequest(ctx context.Context, reqID, rejecterID uuid.UUID, reason string) error {
	_, err := r.Pool.Exec(ctx, `
		UPDATE recovery_requests
		SET status = 'rejected', rejected_at = NOW(), rejection_reason = $3,
			rejected_by = array_append(rejected_by, $2)
		WHERE id = $1 AND status = 'pending'`,
		reqID, rejecterID, reason)
	if err != nil {
		return fmt.Errorf("rejecting recovery request: %w", err)
	}
	return nil
}

func (r *Recovery) CompleteRecovery(ctx context.Context, reqID uuid.UUID, newPublicKey string, newCredentialID []byte) error {
	_, err := r.Pool.Exec(ctx, `
		UPDATE recovery_requests
		SET status = 'completed', completed_at = NOW(), new_public_key = $2, new_passkey_credential_id = $3
		WHERE id = $1 AND status = 'approved'`,
		reqID, newPublicKey, newCredentialID)
	if err != nil {
		return fmt.Errorf("completing recovery: %w", err)
	}

	var targetUserID *uuid.UUID
	err = r.Pool.QueryRow(ctx, `SELECT target_user_id FROM recovery_requests WHERE id = $1`, reqID).Scan(&targetUserID)
	if err != nil || targetUserID == nil {
		return nil
	}

	_, err = r.Pool.Exec(ctx, `UPDATE users SET public_key = $2 WHERE id = $1`, *targetUserID, newPublicKey)
	if err != nil {
		return fmt.Errorf("updating user public key: %w", err)
	}

	_, err = r.Pool.Exec(ctx, `DELETE FROM user_passkeys WHERE user_id = $1`, *targetUserID)
	if err != nil {
		return fmt.Errorf("clearing old passkeys: %w", err)
	}

	return nil
}

func (r *Recovery) ListApprovals(ctx context.Context, reqID uuid.UUID) ([]RecoveryApproval, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT id, recovery_request_id, approver_id, approval_type, signature, group_id, notes, created_at
		FROM recovery_approvals WHERE recovery_request_id = $1 ORDER BY created_at`,
		reqID)
	if err != nil {
		return nil, fmt.Errorf("listing approvals: %w", err)
	}
	defer rows.Close()

	var approvals []RecoveryApproval
	for rows.Next() {
		var a RecoveryApproval
		err := rows.Scan(&a.ID, &a.RecoveryRequestID, &a.ApproverID, &a.ApprovalType,
			&a.Signature, &a.GroupID, &a.Notes, &a.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning approval: %w", err)
		}
		approvals = append(approvals, a)
	}
	return approvals, nil
}

func (r *Recovery) CreateInvitationCode(ctx context.Context, nodeDomain string, createdBy uuid.UUID, maxUses int, proposedLevel string, expiresAt *time.Time) (string, error) {
	codeBytes := make([]byte, 32)
	for i := range codeBytes {
		codeBytes[i] = byte(time.Now().UnixNano() >> (i % 8))
	}
	hash := sha256.Sum256(codeBytes)
	codeHash := hex.EncodeToString(hash[:])
	plainCode := hex.EncodeToString(codeBytes)

	_, err := r.Pool.Exec(ctx, `
		INSERT INTO invitation_codes (node_domain, code_hash, created_by, max_uses, proposed_level, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		nodeDomain, codeHash, createdBy, maxUses, proposedLevel, expiresAt)
	if err != nil {
		return "", fmt.Errorf("creating invitation code: %w", err)
	}
	return plainCode, nil
}

func (r *Recovery) ValidateInvitationCode(ctx context.Context, nodeDomain, code string) (*InvitationCode, error) {
	hash := sha256.Sum256([]byte(code))
	codeHash := hex.EncodeToString(hash[:])

	var inv InvitationCode
	err := r.Pool.QueryRow(ctx, `
		SELECT id, node_domain, code_hash, created_by, used_by, max_uses, use_count,
			proposed_level, expires_at, is_active, created_at, used_at
		FROM invitation_codes
		WHERE code_hash = $1 AND node_domain = $2 AND is_active = true`,
		codeHash, nodeDomain,
	).Scan(&inv.ID, &inv.NodeDomain, &inv.CodeHash, &inv.CreatedBy, &inv.UsedBy,
		&inv.MaxUses, &inv.UseCount, &inv.ProposedLevel, &inv.ExpiresAt,
		&inv.IsActive, &inv.CreatedAt, &inv.UsedAt)
	if err != nil {
		return nil, fmt.Errorf("invalid invitation code")
	}
	if inv.UseCount >= inv.MaxUses {
		return nil, fmt.Errorf("invitation code has been fully used")
	}
	if inv.ExpiresAt != nil && time.Now().After(*inv.ExpiresAt) {
		return nil, fmt.Errorf("invitation code has expired")
	}
	return &inv, nil
}

func (r *Recovery) UseInvitationCode(ctx context.Context, code string, userID uuid.UUID) error {
	hash := sha256.Sum256([]byte(code))
	codeHash := hex.EncodeToString(hash[:])

	_, err := r.Pool.Exec(ctx, `
		UPDATE invitation_codes
		SET use_count = use_count + 1, used_by = $2, used_at = NOW(),
			is_active = (use_count + 1 < max_uses)
		WHERE code_hash = $1`,
		codeHash, userID)
	if err != nil {
		return fmt.Errorf("using invitation code: %w", err)
	}
	return nil
}

func (r *Recovery) LogDeviceRegistration(ctx context.Context, userID uuid.UUID, passkeyID *uuid.UUID, label, deviceType, regType string, registeredFrom *uuid.UUID, ipAddr string) error {
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO device_registrations (user_id, passkey_id, device_label, device_type, registration_type, registered_from_device, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		userID, passkeyID, label, deviceType, regType, registeredFrom, ipAddr)
	if err != nil {
		return fmt.Errorf("logging device registration: %w", err)
	}
	return nil
}

func (r *Recovery) CountUserDevices(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM user_passkeys WHERE user_id = $1`, userID).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}
