package accounts

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Accounts struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Accounts {
	return &Accounts{Pool: pool}
}

type User struct {
	ID                uuid.UUID  `json:"id"`
	NodeDomain        string     `json:"node_domain"`
	Username          string     `json:"username"`
	DisplayName       string     `json:"display_name"`
	AccountType       string     `json:"account_type"`
	MemberLevelID     *string    `json:"member_level_id"`
	HasVoice          bool       `json:"has_voice"`
	HasVote           bool       `json:"has_vote"`
	CountsInQuorum    bool       `json:"counts_in_quorum"`
	MembershipStatus  string     `json:"membership_status"`
	AdmittedAt        *time.Time `json:"admitted_at"`
	Balance           int64      `json:"balance"`
	CreditLimit       int64      `json:"credit_limit"`
	DebitLimit        int64      `json:"debit_limit"`
	PublicKey         *string    `json:"public_key"`
	CreatedAt         time.Time  `json:"created_at"`
	Email             *string    `json:"email"`
	Phone             *string    `json:"phone"`
	TelegramChatID    *string    `json:"telegram_chat_id"`
	MatrixUserID      *string    `json:"matrix_user_id"`
	XmppJID           *string    `json:"xmpp_jid"`
	QuietHoursStart   *int       `json:"quiet_hours_start"`
	QuietHoursEnd     *int       `json:"quiet_hours_end"`
	DigestMode        string     `json:"digest_mode"`
	NationalID        string     `json:"national_id"`
	NationalIDType    string     `json:"national_id_type"`
	NationalIDCountry string     `json:"national_id_country"`
	PassportNumber    string     `json:"passport_number"`
	PassportCountry   string     `json:"passport_country"`
}

func (a *Accounts) GetUser(ctx context.Context, id uuid.UUID) (*User, error) {
	var u User
	var metadata []byte
	err := a.Pool.QueryRow(ctx, `
		SELECT id, node_domain, username, display_name, account_type, member_level_id,
			   has_voice, has_vote, counts_in_quorum, membership_status, admitted_at,
			   credit_limit, debit_limit, public_key, created_at,
			   email, phone, telegram_chat_id, matrix_user_id, xmpp_jid,
			   quiet_hours_start, quiet_hours_end,
			   COALESCE(national_id, ''), COALESCE(national_id_type, ''), COALESCE(national_id_country, ''),
			   COALESCE(passport_number, ''), COALESCE(passport_country, ''),
			   COALESCE(metadata, '{}'::jsonb)
		FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.NodeDomain, &u.Username, &u.DisplayName, &u.AccountType, &u.MemberLevelID,
		&u.HasVoice, &u.HasVote, &u.CountsInQuorum, &u.MembershipStatus, &u.AdmittedAt,
		&u.CreditLimit, &u.DebitLimit, &u.PublicKey, &u.CreatedAt,
		&u.Email, &u.Phone, &u.TelegramChatID, &u.MatrixUserID, &u.XmppJID,
		&u.QuietHoursStart, &u.QuietHoursEnd,
		&u.NationalID, &u.NationalIDType, &u.NationalIDCountry,
		&u.PassportNumber, &u.PassportCountry,
		&metadata)
	if err != nil {
		return nil, fmt.Errorf("getting user: %w", err)
	}

	// Extraer digest_mode del metadata
	var meta struct {
		DigestMode string `json:"digest_mode"`
	}
	json.Unmarshal(metadata, &meta)
	u.DigestMode = meta.DigestMode
	if u.DigestMode == "" {
		u.DigestMode = "instant"
	}
	if err != nil {
		return nil, fmt.Errorf("getting user: %w", err)
	}

	balance, _ := a.GetUserBalance(ctx, id)
	u.Balance = balance

	return &u, nil
}

func (a *Accounts) GetUserBalance(ctx context.Context, id uuid.UUID) (int64, error) {
	var balance int64
	err := a.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM ledger_entries WHERE account_id = $1 AND account_category = 'user_balance'`,
		id,
	).Scan(&balance)
	if err != nil {
		return 0, err
	}
	return balance, nil
}

func (a *Accounts) FindUserByUsername(ctx context.Context, nodeDomain, username string) (*User, error) {
	var u User
	err := a.Pool.QueryRow(ctx, `
		SELECT id, node_domain, username, display_name, account_type, member_level_id,
			   has_voice, has_vote, counts_in_quorum, membership_status, admitted_at,
			   credit_limit, debit_limit, public_key, created_at
		FROM users WHERE node_domain = $1 AND LOWER(username) = LOWER($2)`,
		nodeDomain, username,
	).Scan(&u.ID, &u.NodeDomain, &u.Username, &u.DisplayName, &u.AccountType, &u.MemberLevelID,
		&u.HasVoice, &u.HasVote, &u.CountsInQuorum, &u.MembershipStatus, &u.AdmittedAt,
		&u.CreditLimit, &u.DebitLimit, &u.PublicKey, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("finding user: %w", err)
	}
	balance, _ := a.GetUserBalance(ctx, u.ID)
	u.Balance = balance
	return &u, nil
}

type CreateUserParams struct {
	NodeDomain        string
	Username          string
	DisplayName       string
	AccountType       string
	MemberLevelID     string
	CreditLimit       int64
	DebitLimit        int64
	PublicKey         string
	EncryptedPrivKey  []byte
	KeySalt           []byte
	NationalID        string
	NationalIDType    string
	NationalIDCountry string
	PassportNumber    string
	PassportCountry   string
}

func (a *Accounts) CreateUser(ctx context.Context, p CreateUserParams) (*User, error) {
	var u User
	err := a.Pool.QueryRow(ctx, `
		INSERT INTO users (node_domain, username, display_name, account_type, member_level_id,
						  membership_status, credit_limit, debit_limit, public_key,
						  encrypted_private_key, encryption_key_salt, admitted_at,
						  national_id, national_id_type, national_id_country,
						  passport_number, passport_country)
		VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15)
		RETURNING id, node_domain, username, display_name, account_type, member_level_id,
				  has_voice, has_vote, counts_in_quorum, membership_status, admitted_at,
				  credit_limit, debit_limit, public_key, created_at`,
		p.NodeDomain, p.Username, p.DisplayName, p.AccountType, p.MemberLevelID,
		p.CreditLimit, p.DebitLimit, p.PublicKey, p.EncryptedPrivKey, p.KeySalt,
		p.NationalID, p.NationalIDType, p.NationalIDCountry,
		p.PassportNumber, p.PassportCountry,
	).Scan(&u.ID, &u.NodeDomain, &u.Username, &u.DisplayName, &u.AccountType, &u.MemberLevelID,
		&u.HasVoice, &u.HasVote, &u.CountsInQuorum, &u.MembershipStatus, &u.AdmittedAt,
		&u.CreditLimit, &u.DebitLimit, &u.PublicKey, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}
	return &u, nil
}

type MemberLevel struct {
	ID                      string   `json:"id"`
	Name                    string   `json:"name"`
	Description             string   `json:"description"`
	Level                   int      `json:"level"`
	HasVoice                bool     `json:"has_voice"`
	HasVote                 bool     `json:"has_vote"`
	CountsInQuorum          bool     `json:"counts_in_quorum"`
	CreditLimit             int64    `json:"credit_limit"`
	DebitLimit              int64    `json:"debit_limit"`
	PerTransactionLimit     *int64   `json:"per_transaction_limit"`
	DailyLimit              *int64   `json:"daily_limit"`
	MonthlyLimit            *int64   `json:"monthly_limit"`
	TaxRate                 *float64 `json:"tax_rate"`
	AutoUpgradeAfterDays    *int     `json:"auto_upgrade_after_days"`
	UpgradeTo               *string  `json:"upgrade_to"`
	CanCreateOrganization   bool     `json:"can_create_organization"`
	CanCrossNodeTrade       bool     `json:"can_cross_node_trade"`
	CanReceiveNFCCard       bool     `json:"can_receive_nfc_card"`
	CanViewAudit            bool     `json:"can_view_audit"`
	CanUseExternalBridge    bool     `json:"can_use_external_bridge"`
	MaxOrganizations        int      `json:"max_organizations"`
	CanRequestLimitIncrease bool     `json:"can_request_limit_increase"`
	IsSystem                bool     `json:"is_system"`
}

func (a *Accounts) ListMemberLevels(ctx context.Context, nodeDomain string) ([]MemberLevel, error) {
	rows, err := a.Pool.Query(ctx, `
		SELECT id, name, description, level, has_voice, has_vote, counts_in_quorum,
			   credit_limit, debit_limit, per_transaction_limit, daily_limit, monthly_limit,
			   tax_rate, auto_upgrade_after_days, upgrade_to,
			   can_create_organization, can_cross_node_trade, can_receive_nfc_card,
			   can_view_audit, can_use_external_bridge, max_organizations, can_request_limit_increase, is_system
		FROM member_levels WHERE node_domain = $1 AND is_active = true ORDER BY level`,
		nodeDomain,
	)
	if err != nil {
		return nil, fmt.Errorf("listing member levels: %w", err)
	}
	defer rows.Close()

	var levels []MemberLevel
	for rows.Next() {
		var ml MemberLevel
		err := rows.Scan(&ml.ID, &ml.Name, &ml.Description, &ml.Level, &ml.HasVoice, &ml.HasVote,
			&ml.CountsInQuorum, &ml.CreditLimit, &ml.DebitLimit, &ml.PerTransactionLimit,
			&ml.DailyLimit, &ml.MonthlyLimit, &ml.TaxRate, &ml.AutoUpgradeAfterDays, &ml.UpgradeTo,
			&ml.CanCreateOrganization, &ml.CanCrossNodeTrade, &ml.CanReceiveNFCCard,
			&ml.CanViewAudit, &ml.CanUseExternalBridge, &ml.MaxOrganizations,
			&ml.CanRequestLimitIncrease, &ml.IsSystem)
		if err != nil {
			return nil, fmt.Errorf("scanning member level: %w", err)
		}
		levels = append(levels, ml)
	}
	return levels, nil
}

type AdmissionRequest struct {
	ID                   uuid.UUID              `json:"id"`
	NodeDomain           string                 `json:"node_domain"`
	ProposedUsername     string                 `json:"proposed_username"`
	DisplayName          string                 `json:"display_name"`
	ContactInfo          map[string]interface{} `json:"contact_info"`
	ProposedLevel        string                 `json:"proposed_level"`
	Status               string                 `json:"status"`
	SubmittedAt          time.Time              `json:"submitted_at"`
	ReviewedAt           *time.Time             `json:"reviewed_at"`
	ApprovedAt           *time.Time             `json:"approved_at"`
	RejectedAt           *time.Time             `json:"rejected_at"`
	RejectionReason      string                 `json:"rejection_reason"`
	SponsoredBy          *uuid.UUID             `json:"sponsored_by"`
	SponsorAmountHeld    int64                  `json:"sponsor_amount_held"`
	RequestedCreditLimit int64                  `json:"requested_credit_limit"`
	RequestedDebitLimit  int64                  `json:"requested_debit_limit"`
}

func (a *Accounts) CreateAdmissionRequest(ctx context.Context, nodeDomain, username, displayName, proposedLevel string, contactInfo map[string]interface{}, nationalID, nationalIDType, nationalIDCountry, passportNumber, passportCountry string) (*AdmissionRequest, error) {
	return a.CreateAdmissionRequestWithSponsor(ctx, nodeDomain, username, displayName, proposedLevel, contactInfo, nationalID, nationalIDType, nationalIDCountry, passportNumber, passportCountry, nil, 0, 0, 0)
}

func (a *Accounts) CreateAdmissionRequestWithSponsor(ctx context.Context, nodeDomain, username, displayName, proposedLevel string, contactInfo map[string]interface{}, nationalID, nationalIDType, nationalIDCountry, passportNumber, passportCountry string, sponsoredBy *uuid.UUID, sponsorAmountHeld, requestedCreditLimit, requestedDebitLimit int64) (*AdmissionRequest, error) {
	var req AdmissionRequest
	err := a.Pool.QueryRow(ctx, `
		INSERT INTO admission_requests (node_domain, proposed_username, display_name, proposed_level, contact_info, status, national_id, national_id_type, national_id_country, passport_number, passport_country, sponsored_by, sponsor_amount_held, requested_credit_limit, requested_debit_limit)
		VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, node_domain, proposed_username, display_name, proposed_level, contact_info, status, submitted_at`,
		nodeDomain, username, displayName, proposedLevel, contactInfo, nationalID, nationalIDType, nationalIDCountry, passportNumber, passportCountry, sponsoredBy, sponsorAmountHeld, requestedCreditLimit, requestedDebitLimit,
	).Scan(&req.ID, &req.NodeDomain, &req.ProposedUsername, &req.DisplayName, &req.ProposedLevel, &req.ContactInfo, &req.Status, &req.SubmittedAt)
	if err != nil {
		return nil, fmt.Errorf("creating admission request: %w", err)
	}
	return &req, nil
}

func (a *Accounts) ListAdmissionRequests(ctx context.Context, nodeDomain, status string) ([]AdmissionRequest, error) {
	query := `SELECT id, node_domain, COALESCE(proposed_username, ''), COALESCE(display_name, ''), COALESCE(proposed_level, 'new'), status, submitted_at, reviewed_at, approved_at, rejected_at, COALESCE(rejection_reason, ''), sponsored_by, sponsor_amount_held, requested_credit_limit, requested_debit_limit FROM admission_requests WHERE node_domain = $1`
	args := []interface{}{nodeDomain}
	if status != "" {
		query += ` AND status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY submitted_at DESC`

	rows, err := a.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing admission requests: %w", err)
	}
	defer rows.Close()

	var reqs []AdmissionRequest
	for rows.Next() {
		var req AdmissionRequest
		err := rows.Scan(&req.ID, &req.NodeDomain, &req.ProposedUsername, &req.DisplayName, &req.ProposedLevel, &req.Status, &req.SubmittedAt, &req.ReviewedAt, &req.ApprovedAt, &req.RejectedAt, &req.RejectionReason, &req.SponsoredBy, &req.SponsorAmountHeld, &req.RequestedCreditLimit, &req.RequestedDebitLimit)
		if err != nil {
			return nil, fmt.Errorf("scanning admission request: %w", err)
		}
		reqs = append(reqs, req)
	}
	return reqs, nil
}

func (a *Accounts) ApproveAdmissionRequest(ctx context.Context, reqID uuid.UUID, reviewerID uuid.UUID) (*User, error) {
	var req AdmissionRequest
	var nationalID, nationalIDType, nationalIDCountry string
	var passportNumber, passportCountry string
	err := a.Pool.QueryRow(ctx, `
		UPDATE admission_requests SET status = 'approved', approved_at = NOW(), reviewed_at = NOW(), reviewed_by = $2
		WHERE id = $1 AND status IN ('pending', 'under_review')
		RETURNING node_domain, proposed_username, display_name, proposed_level,
		          COALESCE(national_id, ''), COALESCE(national_id_type, ''), COALESCE(national_id_country, ''),
		          COALESCE(passport_number, ''), COALESCE(passport_country, ''),
		          sponsored_by, sponsor_amount_held, requested_credit_limit, requested_debit_limit`,
		reqID, reviewerID,
	).Scan(&req.NodeDomain, &req.ProposedUsername, &req.DisplayName, &req.ProposedLevel, &nationalID, &nationalIDType, &nationalIDCountry, &passportNumber, &passportCountry,
		&req.SponsoredBy, &req.SponsorAmountHeld, &req.RequestedCreditLimit, &req.RequestedDebitLimit)
	if err != nil {
		return nil, fmt.Errorf("approving admission request: %w", err)
	}

	// Determinar limites: si hay apadrinamiento con monto, usar ese monto (simetrico)
	// Si no, usar los limites del nivel propuesto
	var levelCredit, levelDebit int64
	if req.SponsorAmountHeld > 0 {
		// El apadrinamiento asigna limites simetricos: +monto y -monto
		levelCredit = req.SponsorAmountHeld
		levelDebit = req.SponsorAmountHeld
	} else if req.RequestedCreditLimit > 0 {
		// Si el solicitante pidio limites especificos, usarlos
		levelCredit = req.RequestedCreditLimit
		levelDebit = req.RequestedDebitLimit
	} else {
		err = a.Pool.QueryRow(ctx, `SELECT credit_limit, debit_limit FROM member_levels WHERE id = $1 AND node_domain = $2`, req.ProposedLevel, req.NodeDomain).Scan(&levelCredit, &levelDebit)
		if err != nil {
			levelCredit = -20000
			levelDebit = 20000
		}
	}

	user, err := a.CreateUser(ctx, CreateUserParams{
		NodeDomain:        req.NodeDomain,
		Username:          req.ProposedUsername,
		DisplayName:       req.DisplayName,
		AccountType:       "individual",
		MemberLevelID:     req.ProposedLevel,
		CreditLimit:       levelCredit,
		DebitLimit:        levelDebit,
		NationalID:        nationalID,
		NationalIDType:    nationalIDType,
		NationalIDCountry: nationalIDCountry,
		PassportNumber:    passportNumber,
		PassportCountry:   passportCountry,
	})
	if err != nil {
		return nil, fmt.Errorf("creating user from approved request: %w", err)
	}

	_, err = a.Pool.Exec(ctx, `UPDATE admission_requests SET created_user_id = $2 WHERE id = $1`, reqID, user.ID)
	if err != nil {
		return nil, fmt.Errorf("linking user to admission request: %w", err)
	}

	// Si hay padrino, vincular al nuevo usuario con su padrino y descontar el limite del padrino
	if req.SponsoredBy != nil && req.SponsorAmountHeld > 0 {
		_, err = a.Pool.Exec(ctx, `
			UPDATE users SET sponsored_by = $2, sponsor_amount_held = $3 WHERE id = $1`,
			user.ID, *req.SponsoredBy, req.SponsorAmountHeld)
		if err != nil {
			// No es fatal, continuamos
		}
		// Descontar el limite del padrino (simetrico: credito y debito)
		_, err = a.Pool.Exec(ctx, `
			UPDATE users SET credit_limit = credit_limit - $2, debit_limit = debit_limit - $2
			WHERE id = $1`,
			*req.SponsoredBy, req.SponsorAmountHeld)
		if err != nil {
			// No es fatal, continuamos
		}
	}

	// Transferir documentos de admission_documents a user_documents
	_, err = a.Pool.Exec(ctx, `
		INSERT INTO user_documents (user_id, document_type_code, document_number, country_iso2, country_name)
		SELECT $2, document_type_code, document_number, country_iso2, country_name
		FROM admission_documents WHERE admission_request_id = $1
		ON CONFLICT DO NOTHING`,
		reqID, user.ID)
	if err != nil {
		// No es fatal, continuamos
	}

	_, err = a.Pool.Exec(ctx, `
		INSERT INTO membership_history (user_id, new_level, new_status, reason, approved_by)
		VALUES ($1, $2, 'active', 'Admitted via admission process', ARRAY[$3]::uuid[])`,
		user.ID, req.ProposedLevel, reviewerID)
	if err != nil {
		return nil, fmt.Errorf("recording membership history: %w", err)
	}

	return user, nil
}

// SponsorAdmissionRequest permite que un miembro se agregue como padrino
// de una solicitud de admision pendiente, asignando un monto de su propio limite.
func (a *Accounts) SponsorAdmissionRequest(ctx context.Context, reqID, sponsorID uuid.UUID, amountHeld int64) error {
	// Verificar que el padrino tiene suficiente limite disponible
	var sponsorCredit, sponsorDebit, sponsorBalance int64
	err := a.Pool.QueryRow(ctx, `SELECT credit_limit, debit_limit, balance FROM users WHERE id = $1`, sponsorID).
		Scan(&sponsorCredit, &sponsorDebit, &sponsorBalance)
	if err != nil {
		return fmt.Errorf("error obteniendo datos del padrino: %w", err)
	}

	// El limite efectivo del padrino es su limite menos lo que ya tiene comprometido
	// El limite es simetrico: credit_limit es negativo (maximo negativo), debit_limit es positivo (maximo positivo)
	// Para apadrinar, el padrino necesita tener al menos amountHeld disponible en ambos lados
	effectiveCredit := -sponsorCredit // convertir a positivo para comparar
	effectiveDebit := sponsorDebit
	// Considerar el balance actual: si esta en negativo, su capacidad de credito se reduce
	// si esta en positivo, su capacidad de debito se reduce
	availableCredit := effectiveCredit + sponsorBalance // si balance es negativo, resta capacidad
	availableDebit := effectiveDebit - sponsorBalance   // si balance es positivo, resta capacidad
	if availableCredit < amountHeld || availableDebit < amountHeld {
		return fmt.Errorf("no tienes suficiente limite disponible para apadrinar. Disponible credito: %.2f TQ, disponible debito: %.2f TQ, solicitado: %.2f TQ",
			float64(availableCredit)/100, float64(availableDebit)/100, float64(amountHeld)/100)
	}

	// Asignar el padrino a la solicitud
	_, err = a.Pool.Exec(ctx, `
		UPDATE admission_requests SET sponsored_by = $2, sponsor_amount_held = $3
		WHERE id = $1 AND status = 'pending' AND sponsored_by IS NULL`,
		reqID, sponsorID, amountHeld)
	if err != nil {
		return fmt.Errorf("error asignando padrino: %w", err)
	}
	if err == nil {
		// Verificar que se actualizo
		var cnt int
		a.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM admission_requests WHERE id = $1 AND sponsored_by = $2`, reqID, sponsorID).Scan(&cnt)
		if cnt == 0 {
			return fmt.Errorf("la solicitud ya tiene padrino o no esta pendiente")
		}
	}
	return nil
}

func (a *Accounts) RejectAdmissionRequest(ctx context.Context, reqID, reviewerID uuid.UUID, reason string) error {
	_, err := a.Pool.Exec(ctx, `
		UPDATE admission_requests SET status = 'rejected', rejected_at = NOW(), reviewed_at = NOW(), reviewed_by = $2, rejection_reason = $3
		WHERE id = $1 AND status IN ('pending', 'under_review')`,
		reqID, reviewerID, reason)
	if err != nil {
		return fmt.Errorf("rejecting admission request: %w", err)
	}
	return nil
}
