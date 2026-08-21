package accounts

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Organizations struct {
	Pool *pgxpool.Pool
}

func NewOrganizations(pool *pgxpool.Pool) *Organizations {
	return &Organizations{Pool: pool}
}

type Organization struct {
	ID                  uuid.UUID   `json:"id"`
	NodeDomain          string      `json:"node_domain"`
	Username            string      `json:"username"`
	DisplayName         string      `json:"display_name"`
	AccountType         string      `json:"account_type"`
	OrganizationSubtype string      `json:"organization_subtype"`
	MembershipStatus    string      `json:"membership_status"`
	IsApproved          bool        `json:"is_approved"`
	ApprovedBy          []uuid.UUID `json:"approved_by"`
	Balance             int64       `json:"balance"`
	CreditLimit         int64       `json:"credit_limit"`
	DebitLimit          int64       `json:"debit_limit"`
	AnnualBudgetLimit   *int64      `json:"annual_budget_limit"`
	TaxRate             float64     `json:"tax_rate"`
	RequiredSignatures  int         `json:"required_signatures"`
	AuthorizedSigners   []uuid.UUID `json:"authorized_signers"`
	PublicKey           string      `json:"public_key"`
	CreatedAt           time.Time   `json:"created_at"`
}

type CreateOrganizationParams struct {
	NodeDomain          string
	Username            string
	DisplayName         string
	OrganizationSubtype string
	CreditLimit         int64
	DebitLimit          int64
	AnnualBudgetLimit   *int64
	TaxRate             float64
	PublicKey           string
	EncryptedPrivKey    []byte
	KeySalt             []byte
	CreatedBy           uuid.UUID
}

func (o *Organizations) Create(ctx context.Context, p CreateOrganizationParams) (*Organization, error) {
	var org Organization
	err := o.Pool.QueryRow(ctx, `
		INSERT INTO users (node_domain, username, display_name, account_type, organization_subtype,
						  membership_status, is_approved, credit_limit, debit_limit, annual_budget_limit,
						  tax_rate, public_key, encrypted_private_key, encryption_key_salt, required_signatures)
		VALUES ($1, $2, $3, 'organization', $4, 'pending', false, $5, $6, $7, $8, $9, $10, $11, 1)
		RETURNING id, node_domain, username, display_name, account_type, organization_subtype,
				  membership_status, is_approved, approved_by, credit_limit, debit_limit, annual_budget_limit,
				  tax_rate, required_signatures, authorized_signers, public_key, created_at`,
		p.NodeDomain, p.Username, p.DisplayName, p.OrganizationSubtype,
		p.CreditLimit, p.DebitLimit, p.AnnualBudgetLimit, p.TaxRate,
		p.PublicKey, p.EncryptedPrivKey, p.KeySalt,
	).Scan(&org.ID, &org.NodeDomain, &org.Username, &org.DisplayName, &org.AccountType,
		&org.OrganizationSubtype, &org.MembershipStatus, &org.IsApproved, &org.ApprovedBy,
		&org.CreditLimit, &org.DebitLimit, &org.AnnualBudgetLimit, &org.TaxRate,
		&org.RequiredSignatures, &org.AuthorizedSigners, &org.PublicKey, &org.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating organization: %w", err)
	}
	return &org, nil
}

func (o *Organizations) Approve(ctx context.Context, orgID, approverID uuid.UUID) error {
	_, err := o.Pool.Exec(ctx, `
		UPDATE users 
		SET is_approved = true, 
			membership_status = 'active',
			approved_by = array_append(COALESCE(approved_by, ARRAY[]::uuid[]), $2),
			admitted_at = NOW()
		WHERE id = $1 AND account_type = 'organization'`,
		orgID, approverID,
	)
	if err != nil {
		return fmt.Errorf("approving organization: %w", err)
	}

	_, err = o.Pool.Exec(ctx, `
		INSERT INTO membership_history (user_id, new_level, new_status, reason, approved_by)
		VALUES ($1, NULL, 'active', 'Organization approved', ARRAY[$2]::uuid[])`,
		orgID, approverID)
	if err != nil {
		return fmt.Errorf("recording org approval: %w", err)
	}

	return nil
}

func (o *Organizations) List(ctx context.Context, nodeDomain, subtype string) ([]Organization, error) {
	query := `SELECT id, node_domain, username, display_name, account_type, COALESCE(organization_subtype, ''),
			  membership_status, is_approved, COALESCE(approved_by, ARRAY[]::uuid[]),
			  credit_limit, debit_limit, annual_budget_limit, COALESCE(tax_rate, 0)::float8,
			  required_signatures, COALESCE(authorized_signers, ARRAY[]::uuid[]), COALESCE(public_key, ''), created_at
			  FROM users WHERE node_domain = $1 AND account_type = 'organization'`
	args := []interface{}{nodeDomain}
	if subtype != "" {
		query += ` AND organization_subtype = $2`
		args = append(args, subtype)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := o.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing organizations: %w", err)
	}
	defer rows.Close()

	var orgs []Organization
	for rows.Next() {
		var org Organization
		err := rows.Scan(&org.ID, &org.NodeDomain, &org.Username, &org.DisplayName, &org.AccountType,
			&org.OrganizationSubtype, &org.MembershipStatus, &org.IsApproved, &org.ApprovedBy,
			&org.CreditLimit, &org.DebitLimit, &org.AnnualBudgetLimit, &org.TaxRate,
			&org.RequiredSignatures, &org.AuthorizedSigners, &org.PublicKey, &org.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning organization: %w", err)
		}
		orgs = append(orgs, org)
	}
	return orgs, nil
}

func (o *Organizations) SetMultiSig(ctx context.Context, orgID uuid.UUID, requiredSigs int, signers []uuid.UUID) error {
	_, err := o.Pool.Exec(ctx, `
		UPDATE users SET required_signatures = $2, authorized_signers = $3 WHERE id = $1 AND account_type IN ('organization', 'public_institution')`,
		orgID, requiredSigs, signers,
	)
	if err != nil {
		return fmt.Errorf("setting multi-sig: %w", err)
	}
	return nil
}

func (o *Organizations) CreatePublicInstitution(ctx context.Context, p CreateOrganizationParams) (*Organization, error) {
	var org Organization
	err := o.Pool.QueryRow(ctx, `
		INSERT INTO users (node_domain, username, display_name, account_type, organization_subtype,
						  membership_status, is_approved, credit_limit, debit_limit, annual_budget_limit,
						  tax_rate, public_key, encrypted_private_key, encryption_key_salt, required_signatures)
		VALUES ($1, $2, $3, 'public_institution', $4, 'pending', false, $5, $6, $7, $8, $9, $10, $11, 1)
		RETURNING id, node_domain, username, display_name, account_type, organization_subtype,
				  membership_status, is_approved, approved_by, credit_limit, debit_limit, annual_budget_limit,
				  tax_rate, required_signatures, authorized_signers, public_key, created_at`,
		p.NodeDomain, p.Username, p.DisplayName, p.OrganizationSubtype,
		p.CreditLimit, p.DebitLimit, p.AnnualBudgetLimit, p.TaxRate,
		p.PublicKey, p.EncryptedPrivKey, p.KeySalt,
	).Scan(&org.ID, &org.NodeDomain, &org.Username, &org.DisplayName, &org.AccountType,
		&org.OrganizationSubtype, &org.MembershipStatus, &org.IsApproved, &org.ApprovedBy,
		&org.CreditLimit, &org.DebitLimit, &org.AnnualBudgetLimit, &org.TaxRate,
		&org.RequiredSignatures, &org.AuthorizedSigners, &org.PublicKey, &org.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating public institution: %w", err)
	}
	return &org, nil
}

func (o *Organizations) IncreaseAnnualBudget(ctx context.Context, orgID uuid.UUID, newBudget int64, approvedBy []uuid.UUID) error {
	_, err := o.Pool.Exec(ctx, `
		UPDATE users SET annual_budget_limit = $2 WHERE id = $1 AND account_type = 'public_institution'`,
		orgID, newBudget,
	)
	if err != nil {
		return fmt.Errorf("increasing annual budget: %w", err)
	}

	_, err = o.Pool.Exec(ctx, `
		INSERT INTO audit_log (action, target_id, details)
		VALUES ('annual_budget_increase', $1, jsonb_build_object('new_budget', $2, 'approved_by', $3::jsonb))`,
		orgID, newBudget, approvedBy)
	if err != nil {
		return fmt.Errorf("logging budget increase: %w", err)
	}

	return nil
}

type MultiSigApproval struct {
	ID                  uuid.UUID                `json:"id"`
	ProposalType        string                   `json:"proposal_type"`
	FromAccount         uuid.UUID                `json:"from_account"`
	ToAccount           uuid.UUID                `json:"to_account"`
	Amount              int64                    `json:"amount"`
	RequiredSignatures  int                      `json:"required_signatures"`
	CollectedSignatures []map[string]interface{} `json:"collected_signatures"`
	Status              string                   `json:"status"`
	CreatedAt           time.Time                `json:"created_at"`
	ExecutedAt          *time.Time               `json:"executed_at"`
}

func (o *Organizations) CreateMultiSigProposal(ctx context.Context, propType string, fromAccount, toAccount uuid.UUID, amount int64, requiredSigs int) (*MultiSigApproval, error) {
	var msig MultiSigApproval
	err := o.Pool.QueryRow(ctx, `
		INSERT INTO multi_sig_approvals (proposal_type, from_account, to_account, amount, required_signatures, status)
		VALUES ($1, $2, $3, $4, $5, 'pending')
		RETURNING id, proposal_type, from_account, to_account, amount, required_signatures, collected_signatures, status, created_at, executed_at`,
		propType, fromAccount, toAccount, amount, requiredSigs,
	).Scan(&msig.ID, &msig.ProposalType, &msig.FromAccount, &msig.ToAccount, &msig.Amount,
		&msig.RequiredSignatures, &msig.CollectedSignatures, &msig.Status, &msig.CreatedAt, &msig.ExecutedAt)
	if err != nil {
		return nil, fmt.Errorf("creating multi-sig proposal: %w", err)
	}
	return &msig, nil
}

func (o *Organizations) SignMultiSigProposal(ctx context.Context, proposalID, signerID uuid.UUID, signature string) error {
	var collected []map[string]interface{}
	err := o.Pool.QueryRow(ctx,
		`SELECT collected_signatures FROM multi_sig_approvals WHERE id = $1 AND status = 'pending'`,
		proposalID,
	).Scan(&collected)
	if err != nil {
		return fmt.Errorf("getting proposal: %w", err)
	}

	sigEntry := map[string]interface{}{
		"signer_id": signerID.String(),
		"signature": signature,
		"timestamp": time.Now().UTC(),
	}
	collected = append(collected, sigEntry)

	var requiredSigs int
	_ = o.Pool.QueryRow(ctx, `SELECT required_signatures FROM multi_sig_approvals WHERE id = $1`, proposalID).Scan(&requiredSigs)

	status := "pending"
	if len(collected) >= requiredSigs {
		status = "ready"
	}

	_, err = o.Pool.Exec(ctx, `
		UPDATE multi_sig_approvals SET collected_signatures = $2, status = $3 WHERE id = $1`,
		proposalID, collected, status)
	if err != nil {
		return fmt.Errorf("signing proposal: %w", err)
	}

	return nil
}

func (o *Organizations) ExecuteMultiSigProposal(ctx context.Context, proposalID uuid.UUID) error {
	var msig MultiSigApproval
	err := o.Pool.QueryRow(ctx, `
		SELECT id, proposal_type, from_account, to_account, amount, required_signatures, collected_signatures, status
		FROM multi_sig_approvals WHERE id = $1`,
		proposalID,
	).Scan(&msig.ID, &msig.ProposalType, &msig.FromAccount, &msig.ToAccount, &msig.Amount,
		&msig.RequiredSignatures, &msig.CollectedSignatures, &msig.Status)
	if err != nil {
		return fmt.Errorf("getting proposal: %w", err)
	}

	if msig.Status != "ready" {
		return fmt.Errorf("proposal not ready for execution: status=%s, collected=%d, required=%d",
			msig.Status, len(msig.CollectedSignatures), msig.RequiredSignatures)
	}

	_, err = o.Pool.Exec(ctx, `
		UPDATE multi_sig_approvals SET status = 'executed', executed_at = NOW() WHERE id = $1`,
		proposalID)
	if err != nil {
		return fmt.Errorf("executing proposal: %w", err)
	}

	return nil
}

func (o *Organizations) ListMultiSigProposals(ctx context.Context, accountID uuid.UUID) ([]MultiSigApproval, error) {
	rows, err := o.Pool.Query(ctx, `
		SELECT id, proposal_type, from_account, to_account, amount, required_signatures, collected_signatures, status, created_at, executed_at
		FROM multi_sig_approvals 
		WHERE from_account = $1 OR to_account = $1
		ORDER BY created_at DESC`,
		accountID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing multi-sig proposals: %w", err)
	}
	defer rows.Close()

	var proposals []MultiSigApproval
	for rows.Next() {
		var p MultiSigApproval
		err := rows.Scan(&p.ID, &p.ProposalType, &p.FromAccount, &p.ToAccount, &p.Amount,
			&p.RequiredSignatures, &p.CollectedSignatures, &p.Status, &p.CreatedAt, &p.ExecutedAt)
		if err != nil {
			return nil, fmt.Errorf("scanning proposal: %w", err)
		}
		proposals = append(proposals, p)
	}
	return proposals, nil
}
