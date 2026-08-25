package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// FRNEHandler maneja el modulo FRNE (Fair exit / Salida Justa al Retirarse).
// Resuelve como liquidar de forma no especulativa la vivienda de un socio
// que decide retirarse de la comunidad, sin descapitalizar el fondo comun.
type FRNEHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *FRNEHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/frne/requests", h.listRequests)
	r.Post("/api/frne/requests", h.createRequest)
	r.Get("/api/frne/requests/{id}", h.getRequest)
	r.With(am.RequirePermission("config.manage")).Put("/api/frne/requests/{id}", h.updateRequest)
	r.With(am.RequirePermission("config.manage")).Post("/api/frne/requests/{id}/approve", h.approveRequest)
	r.With(am.RequirePermission("config.manage")).Post("/api/frne/requests/{id}/pay-installment", h.payInstallment)
	r.With(am.RequirePermission("config.manage")).Delete("/api/frne/requests/{id}", h.cancelRequest)
}

func (h *FRNEHandler) listRequests(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT er.id, er.user_id, u.username, u.display_name,
		       er.property_description, er.join_date, er.requested_exit_date,
		       er.original_contribution_tq, er.improvements_value_tq,
		       er.speculative_value_tq, er.total_payout_tq,
		       er.status, er.payout_method, er.installments_count,
		       er.assembly_notes, er.created_at
		FROM frne_exit_requests er
		JOIN users u ON u.id = er.user_id
		WHERE er.node_domain = $1
		ORDER BY er.created_at DESC`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing FRNE requests")
		return
	}
	defer rows.Close()

	var reqs []map[string]interface{}
	for rows.Next() {
		var id, userID, username, displayName, propertyDesc, status, payoutMethod, assemblyNotes *string
		var joinDate, requestedExitDate, createdAt interface{}
		var originalTQ, improvementsTQ, speculativeTQ, totalPayoutTQ *float64
		var installmentsCount *int
		if err := rows.Scan(&id, &userID, &username, &displayName,
			&propertyDesc, &joinDate, &requestedExitDate,
			&originalTQ, &improvementsTQ, &speculativeTQ, &totalPayoutTQ,
			&status, &payoutMethod, &installmentsCount,
			&assemblyNotes, &createdAt); err != nil {
			continue
		}
		req := map[string]interface{}{
			"id":                    id,
			"user_id":               userID,
			"username":              username,
			"display_name":          displayName,
			"property_description":  propertyDesc,
			"join_date":             joinDate,
			"requested_exit_date":   requestedExitDate,
			"original_contribution": originalTQ,
			"improvements_value":    improvementsTQ,
			"speculative_value":     speculativeTQ,
			"total_payout":          totalPayoutTQ,
			"status":                status,
			"payout_method":         payoutMethod,
			"installments_count":    installmentsCount,
			"assembly_notes":        assemblyNotes,
			"created_at":            createdAt,
		}
		reqs = append(reqs, req)
	}
	if reqs == nil {
		reqs = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"requests": reqs})
}

func (h *FRNEHandler) createRequest(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	var body struct {
		PropertyDescription  string  `json:"property_description"`
		JoinDate             string  `json:"join_date"`
		RequestedExitDate    string  `json:"requested_exit_date"`
		OriginalContribution float64 `json:"original_contribution_tq"`
		ImprovementsValue    float64 `json:"improvements_value_tq"`
		SpeculativeValue     float64 `json:"speculative_value_tq"`
		PayoutMethod         string  `json:"payout_method"`
		InstallmentsCount    int     `json:"installments_count"`
		AssemblyNotes        string  `json:"assembly_notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if body.PayoutMethod == "" {
		body.PayoutMethod = "lump_sum"
	}
	if body.InstallmentsCount < 1 {
		body.InstallmentsCount = 1
	}

	totalPayout := body.OriginalContribution + body.ImprovementsValue

	var joinDate, exitDate interface{}
	if body.JoinDate != "" {
		if d, err := time.Parse("2006-01-02", body.JoinDate); err == nil {
			joinDate = d
		}
	}
	if body.RequestedExitDate != "" {
		if d, err := time.Parse("2006-01-02", body.RequestedExitDate); err == nil {
			exitDate = d
		}
	}

	var id string
	err = h.Pool.QueryRow(r.Context(), `
		INSERT INTO frne_exit_requests (node_domain, user_id, property_description, join_date, requested_exit_date,
			original_contribution_tq, improvements_value_tq, speculative_value_tq, total_payout_tq,
			payout_method, installments_count, assembly_notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id`,
		nodeDomain, userID, body.PropertyDescription, joinDate, exitDate,
		body.OriginalContribution, body.ImprovementsValue, body.SpeculativeValue, totalPayout,
		body.PayoutMethod, body.InstallmentsCount, body.AssemblyNotes).Scan(&id)
	if err != nil {
		writeError(w, 500, "error creating FRNE request")
		return
	}

	// Si es pago en cuotas, crear las cuotas
	if body.PayoutMethod == "installments" && body.InstallmentsCount > 1 {
		amountPerInstallment := totalPayout / float64(body.InstallmentsCount)
		baseDate := time.Now()
		if exitDate != nil {
			if d, ok := exitDate.(time.Time); ok {
				baseDate = d
			}
		}
		for i := 1; i <= body.InstallmentsCount; i++ {
			dueDate := baseDate.AddDate(0, i, 0)
			h.Pool.Exec(r.Context(), `
				INSERT INTO frne_installments (exit_request_id, installment_number, amount_tq, due_date)
				VALUES ($1, $2, $3, $4)`,
				id, i, amountPerInstallment, dueDate)
		}
	}

	writeJSON(w, 201, map[string]interface{}{"id": id, "total_payout_tq": totalPayout})
}

func (h *FRNEHandler) getRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id requerido")
		return
	}

	var req map[string]interface{}
	var userID, propertyDesc, status, payoutMethod, assemblyNotes *string
	var joinDate, exitDate, approvedAt, createdAt interface{}
	var originalTQ, improvementsTQ, speculativeTQ, totalPayoutTQ *float64
	var installmentsCount *int

	err := h.Pool.QueryRow(r.Context(), `
		SELECT user_id, property_description, join_date, requested_exit_date,
		       original_contribution_tq, improvements_value_tq, speculative_value_tq, total_payout_tq,
		       status, payout_method, installments_count, assembly_notes, approved_at, created_at
		FROM frne_exit_requests WHERE id = $1`, id).Scan(
		&userID, &propertyDesc, &joinDate, &exitDate,
		&originalTQ, &improvementsTQ, &speculativeTQ, &totalPayoutTQ,
		&status, &payoutMethod, &installmentsCount, &assemblyNotes, &approvedAt, &createdAt)
	if err != nil {
		writeError(w, 404, "solicitud no encontrada")
		return
	}

	req = map[string]interface{}{
		"id":                    id,
		"user_id":               userID,
		"property_description":  propertyDesc,
		"join_date":             joinDate,
		"requested_exit_date":   exitDate,
		"original_contribution": originalTQ,
		"improvements_value":    improvementsTQ,
		"speculative_value":     speculativeTQ,
		"total_payout":          totalPayoutTQ,
		"status":                status,
		"payout_method":         payoutMethod,
		"installments_count":    installmentsCount,
		"assembly_notes":        assemblyNotes,
		"approved_at":           approvedAt,
		"created_at":            createdAt,
	}

	// Cargar cuotas si existen
	rows, _ := h.Pool.Query(r.Context(), `
		SELECT installment_number, amount_tq, due_date, paid_date, paid
		FROM frne_installments WHERE exit_request_id = $1 ORDER BY installment_number`, id)
	if rows != nil {
		defer rows.Close()
		var installments []map[string]interface{}
		for rows.Next() {
			var num int
			var amount float64
			var dueDate interface{}
			var paidDate interface{}
			var paid bool
			rows.Scan(&num, &amount, &dueDate, &paidDate, &paid)
			installments = append(installments, map[string]interface{}{
				"installment_number": num,
				"amount_tq":          amount,
				"due_date":           dueDate,
				"paid_date":          paidDate,
				"paid":               paid,
			})
		}
		if installments == nil {
			installments = []map[string]interface{}{}
		}
		req["installments"] = installments
	}

	writeJSON(w, 200, req)
}

func (h *FRNEHandler) updateRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id requerido")
		return
	}

	var body struct {
		OriginalContribution float64 `json:"original_contribution_tq"`
		ImprovementsValue    float64 `json:"improvements_value_tq"`
		SpeculativeValue     float64 `json:"speculative_value_tq"`
		PayoutMethod         string  `json:"payout_method"`
		InstallmentsCount    int     `json:"installments_count"`
		AssemblyNotes        string  `json:"assembly_notes"`
		Status               string  `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	totalPayout := body.OriginalContribution + body.ImprovementsValue

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE frne_exit_requests SET
			original_contribution_tq = $2, improvements_value_tq = $3, speculative_value_tq = $4,
			total_payout_tq = $5, payout_method = $6, installments_count = $7,
			assembly_notes = $8, status = $9, updated_at = NOW()
		WHERE id = $1`,
		id, body.OriginalContribution, body.ImprovementsValue, body.SpeculativeValue,
		totalPayout, body.PayoutMethod, body.InstallmentsCount, body.AssemblyNotes, body.Status)
	if err != nil {
		writeError(w, 500, "error updating FRNE request")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *FRNEHandler) approveRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id requerido")
		return
	}

	approverID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	_, err = h.Pool.Exec(r.Context(), `
		UPDATE frne_exit_requests SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
		WHERE id = $1`, id, approverID)
	if err != nil {
		writeError(w, 500, "error approving FRNE request")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *FRNEHandler) payInstallment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id requerido")
		return
	}

	var body struct {
		InstallmentNumber int `json:"installment_number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.InstallmentNumber == 0 {
		writeError(w, 400, "installment_number requerido")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE frne_installments SET paid = true, paid_date = NOW()
		WHERE exit_request_id = $1 AND installment_number = $2`,
		id, body.InstallmentNumber)
	if err != nil {
		writeError(w, 500, "error paying installment")
		return
	}

	// Verificar si todas las cuotas estan pagadas
	var total, paid int
	h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM frne_installments WHERE exit_request_id = $1`, id).Scan(&total)
	h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM frne_installments WHERE exit_request_id = $1 AND paid = true`, id).Scan(&paid)
	if total > 0 && total == paid {
		h.Pool.Exec(r.Context(), `UPDATE frne_exit_requests SET status = 'paid', updated_at = NOW() WHERE id = $1`, id)
	}

	writeJSON(w, 200, map[string]interface{}{"success": true, "paid": paid, "total": total})
}

func (h *FRNEHandler) cancelRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id requerido")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE frne_exit_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, "error cancelling FRNE request")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}
