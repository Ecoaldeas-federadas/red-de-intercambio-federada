package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"federated-credit-node/internal/accounts"
)

type OrganizationHandler struct {
	Orgs       *accounts.Organizations
	NodeDomain string
}

func NewOrganizationHandler(orgs *accounts.Organizations, nodeDomain string) *OrganizationHandler {
	return &OrganizationHandler{Orgs: orgs, NodeDomain: nodeDomain}
}

func (oh *OrganizationHandler) RegisterRoutes(r chi.Router) {
	oh.RegisterRoutesWithAuth(r, nil)
}

func (oh *OrganizationHandler) RegisterRoutesWithAuth(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/organizations", oh.listOrganizations)
	r.Post("/api/organizations", oh.createOrganization)
	if am != nil {
		r.With(am.RequirePermission("org.approve")).Post("/api/organizations/{id}/approve", oh.approveOrganization)
	} else {
		r.Post("/api/organizations/{id}/approve", oh.approveOrganization)
	}
	r.Put("/api/organizations/{id}/multisig", oh.setMultiSig)

	// Junta directiva de organizacion
	r.Get("/api/organizations/{id}/board", oh.listOrganizationBoard)
	r.Post("/api/organizations/{id}/board", oh.assignOrganizationBoardMember)
	r.Delete("/api/organizations/{id}/board/{memberId}", oh.removeOrganizationBoardMember)

	r.Post("/api/institutions", oh.createInstitution)
	if am != nil {
		r.With(am.RequirePermission("org.budget_increase")).Post("/api/institutions/{id}/budget", oh.increaseBudget)
	} else {
		r.Post("/api/institutions/{id}/budget", oh.increaseBudget)
	}

	r.Post("/api/multisig/proposals", oh.createMultiSigProposal)
	r.Get("/api/multisig/proposals", oh.listMultiSigProposals)
	r.Post("/api/multisig/proposals/{id}/sign", oh.signMultiSigProposal)
	r.Post("/api/multisig/proposals/{id}/execute", oh.executeMultiSigProposal)
}

type CreateOrgRequest struct {
	Username            string  `json:"username"`
	DisplayName         string  `json:"display_name"`
	OrganizationSubtype string  `json:"organization_subtype"`
	CreditLimit         int64   `json:"credit_limit"`
	DebitLimit          int64   `json:"debit_limit"`
	AnnualBudgetLimit   *int64  `json:"annual_budget_limit"`
	TaxRate             float64 `json:"tax_rate"`
	PublicKey           string  `json:"public_key"`
}

func (oh *OrganizationHandler) createOrganization(w http.ResponseWriter, r *http.Request) {
	var req CreateOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	org, err := oh.Orgs.Create(r.Context(), accounts.CreateOrganizationParams{
		NodeDomain:          oh.NodeDomain,
		Username:            req.Username,
		DisplayName:         req.DisplayName,
		OrganizationSubtype: req.OrganizationSubtype,
		CreditLimit:         req.CreditLimit,
		DebitLimit:          req.DebitLimit,
		AnnualBudgetLimit:   req.AnnualBudgetLimit,
		TaxRate:             req.TaxRate,
		PublicKey:           req.PublicKey,
	})
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, org)
}

func (oh *OrganizationHandler) listOrganizations(w http.ResponseWriter, r *http.Request) {
	subtype := r.URL.Query().Get("subtype")
	orgs, err := oh.Orgs.List(r.Context(), oh.NodeDomain, subtype)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, orgs)
}

func (oh *OrganizationHandler) approveOrganization(w http.ResponseWriter, r *http.Request) {
	orgID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid organization id")
		return
	}

	approverIDStr := r.Header.Get("X-User-ID")
	approverID, err := uuid.Parse(approverIDStr)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	if err := oh.Orgs.Approve(r.Context(), orgID, approverID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "approved"})
}

type SetMultiSigRequest struct {
	RequiredSignatures int         `json:"required_signatures"`
	AuthorizedSigners  []uuid.UUID `json:"authorized_signers"`
}

func (oh *OrganizationHandler) setMultiSig(w http.ResponseWriter, r *http.Request) {
	orgID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid organization id")
		return
	}

	var req SetMultiSigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if err := oh.Orgs.SetMultiSig(r.Context(), orgID, req.RequiredSignatures, req.AuthorizedSigners); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "updated"})
}

func (oh *OrganizationHandler) createInstitution(w http.ResponseWriter, r *http.Request) {
	var req CreateOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	org, err := oh.Orgs.CreatePublicInstitution(r.Context(), accounts.CreateOrganizationParams{
		NodeDomain:          oh.NodeDomain,
		Username:            req.Username,
		DisplayName:         req.DisplayName,
		OrganizationSubtype: req.OrganizationSubtype,
		CreditLimit:         req.CreditLimit,
		DebitLimit:          req.DebitLimit,
		AnnualBudgetLimit:   req.AnnualBudgetLimit,
		TaxRate:             req.TaxRate,
		PublicKey:           req.PublicKey,
	})
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, org)
}

type IncreaseBudgetRequest struct {
	NewBudget  int64       `json:"new_budget"`
	ApprovedBy []uuid.UUID `json:"approved_by"`
}

func (oh *OrganizationHandler) increaseBudget(w http.ResponseWriter, r *http.Request) {
	institutionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid institution id")
		return
	}

	var req IncreaseBudgetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if err := oh.Orgs.IncreaseAnnualBudget(r.Context(), institutionID, req.NewBudget, req.ApprovedBy); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "budget_increased"})
}

type CreateMultiSigProposalRequest struct {
	ProposalType       string    `json:"proposal_type"`
	FromAccount        uuid.UUID `json:"from_account"`
	ToAccount          uuid.UUID `json:"to_account"`
	Amount             int64     `json:"amount"`
	RequiredSignatures int       `json:"required_signatures"`
}

func (oh *OrganizationHandler) createMultiSigProposal(w http.ResponseWriter, r *http.Request) {
	var req CreateMultiSigProposalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	proposal, err := oh.Orgs.CreateMultiSigProposal(r.Context(), req.ProposalType, req.FromAccount, req.ToAccount, req.Amount, req.RequiredSignatures)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, proposal)
}

func (oh *OrganizationHandler) listMultiSigProposals(w http.ResponseWriter, r *http.Request) {
	accountIDStr := r.URL.Query().Get("account")
	if accountIDStr == "" {
		writeError(w, 400, "account parameter required")
		return
	}
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		writeError(w, 400, "invalid account id")
		return
	}

	proposals, err := oh.Orgs.ListMultiSigProposals(r.Context(), accountID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, proposals)
}

type SignMultiSigRequest struct {
	SignerID  uuid.UUID `json:"signer_id"`
	Signature string    `json:"signature"`
}

func (oh *OrganizationHandler) signMultiSigProposal(w http.ResponseWriter, r *http.Request) {
	proposalID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid proposal id")
		return
	}

	var req SignMultiSigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if err := oh.Orgs.SignMultiSigProposal(r.Context(), proposalID, req.SignerID, req.Signature); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "signed"})
}

func (oh *OrganizationHandler) executeMultiSigProposal(w http.ResponseWriter, r *http.Request) {
	proposalID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid proposal id")
		return
	}

	if err := oh.Orgs.ExecuteMultiSigProposal(r.Context(), proposalID); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "executed"})
}

// ===== Junta directiva de organizacion =====

func (oh *OrganizationHandler) listOrganizationBoard(w http.ResponseWriter, r *http.Request) {
	orgID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid organization id")
		return
	}

	rows, err := oh.Orgs.Pool.Query(r.Context(), `
		SELECT b.id, b.user_id, u.username, u.display_name, b.position, b.term_start, b.term_end, b.is_active, b.created_at
		FROM organization_board_members b
		JOIN users u ON u.id = b.user_id
		WHERE b.organization_id = $1 AND b.is_active = true
		ORDER BY b.position`, orgID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var board []map[string]interface{}
	for rows.Next() {
		var id, userID uuid.UUID
		var username, position string
		var displayName *string
		var termStart time.Time
		var termEnd *time.Time
		var isActive bool
		var createdAt time.Time
		if err := rows.Scan(&id, &userID, &username, &displayName, &position, &termStart, &termEnd, &isActive, &createdAt); err != nil {
			continue
		}
		board = append(board, map[string]interface{}{
			"id":           id.String(),
			"user_id":      userID.String(),
			"username":     username,
			"display_name": deref(displayName),
			"position":     position,
			"term_start":   termStart,
			"term_end":     derefTime(termEnd),
			"is_active":    isActive,
			"created_at":   createdAt,
		})
	}
	if board == nil {
		board = []map[string]interface{}{}
	}
	writeJSON(w, 200, board)
}

type AssignOrgBoardRequest struct {
	UserID   string `json:"user_id"`
	Position string `json:"position"`
}

func (oh *OrganizationHandler) assignOrganizationBoardMember(w http.ResponseWriter, r *http.Request) {
	orgID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid organization id")
		return
	}

	var req AssignOrgBoardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.UserID == "" || req.Position == "" {
		writeError(w, 400, "user_id and position are required")
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		writeError(w, 400, "invalid user_id")
		return
	}

	id := uuid.New()
	_, err = oh.Orgs.Pool.Exec(r.Context(), `
		INSERT INTO organization_board_members (id, organization_id, user_id, position)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (organization_id, user_id, position) DO UPDATE SET is_active = true, term_start = NOW()`,
		id, orgID, userID, req.Position)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":              id.String(),
		"organization_id": orgID.String(),
		"user_id":         userID.String(),
		"position":        req.Position,
		"is_active":       true,
	})
}

func (oh *OrganizationHandler) removeOrganizationBoardMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := uuid.Parse(chi.URLParam(r, "memberId"))
	if err != nil {
		writeError(w, 400, "invalid member id")
		return
	}

	_, err = oh.Orgs.Pool.Exec(r.Context(), `UPDATE organization_board_members SET is_active = false WHERE id = $1`, memberID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"status": "removed"})
}
