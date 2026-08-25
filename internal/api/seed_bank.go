package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SeedBankHandler maneja el Banco de Semillas Criollas.
// Funciona con prestamo y devolucion: el agricultor retira semillas,
// las siembra, y al cosechar devuelve la misma cantidad mas un porcentaje
// adicional para que el banco crezca comunitariamente.
type SeedBankHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *SeedBankHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Get("/api/seeds/loans", h.listLoans)
	r.Post("/api/seeds/loan", h.createLoan)
	r.Get("/api/seeds/loans/{id}", h.getLoan)
	r.Post("/api/seeds/loans/{id}/return", h.registerReturn)
	r.With(am.RequirePermission("config.manage")).Put("/api/seeds/loans/{id}", h.updateLoan)
	r.With(am.RequirePermission("config.manage")).Delete("/api/seeds/loans/{id}", h.cancelLoan)
	// Inventario del banco de semillas
	r.Get("/api/seeds/inventory", h.getInventory)
	// Configuracion del banco
	r.Get("/api/seeds/config", h.getSeedConfig)
}

func (h *SeedBankHandler) listLoans(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	statusFilter := r.URL.Query().Get("status")
	query := `
		SELECT sl.id, sl.user_id, u.username, u.display_name,
		       sl.seed_name, sl.quantity_borrowed, sl.unit,
		       sl.expected_return_qty, sl.returned_qty, sl.return_percentage,
		       sl.status, sl.borrowed_at, sl.due_date, sl.returned_at,
		       sl.authorized_by, sl.notes
		FROM seed_loans sl
		JOIN users u ON u.id = sl.user_id
		WHERE sl.node_domain = $1`
	args := []interface{}{nodeDomain}
	if statusFilter != "" {
		query += ` AND sl.status = $2`
		args = append(args, statusFilter)
	}
	query += ` ORDER BY sl.borrowed_at DESC`

	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, 500, "error listing seed loans")
		return
	}
	defer rows.Close()

	var loans []map[string]interface{}
	for rows.Next() {
		var id, userID, username, displayName, seedName, unit, status, notes *string
		var qtyBorrowed, expectedReturn, returnedQty, returnPct *float64
		var borrowedAt, dueDate, returnedAt interface{}
		var authorizedBy *string
		if err := rows.Scan(&id, &userID, &username, &displayName,
			&seedName, &qtyBorrowed, &unit,
			&expectedReturn, &returnedQty, &returnPct,
			&status, &borrowedAt, &dueDate, &returnedAt,
			&authorizedBy, &notes); err != nil {
			continue
		}
		loan := map[string]interface{}{
			"id":                id,
			"user_id":           userID,
			"username":          username,
			"display_name":      displayName,
			"seed_name":         seedName,
			"quantity_borrowed": qtyBorrowed,
			"unit":              unit,
			"expected_return":   expectedReturn,
			"returned_qty":      returnedQty,
			"return_percentage": returnPct,
			"status":            status,
			"borrowed_at":       borrowedAt,
			"due_date":          dueDate,
			"returned_at":       returnedAt,
			"authorized_by":     authorizedBy,
			"notes":             notes,
		}
		loans = append(loans, loan)
	}
	if loans == nil {
		loans = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"loans": loans})
}

func (h *SeedBankHandler) createLoan(w http.ResponseWriter, r *http.Request) {
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
		SeedName         string  `json:"seed_name"`
		QuantityBorrowed float64 `json:"quantity_borrowed"`
		Unit             string  `json:"unit"`
		ReturnPercentage float64 `json:"return_percentage"`
		DueDate          string  `json:"due_date"`
		Notes            string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.SeedName == "" || body.QuantityBorrowed <= 0 {
		writeError(w, 400, "seed_name y quantity_borrowed son requeridos")
		return
	}
	if body.Unit == "" {
		body.Unit = "sobres"
	}
	if body.ReturnPercentage <= 0 {
		body.ReturnPercentage = 20.0
	}

	expectedReturn := body.QuantityBorrowed * (1 + body.ReturnPercentage/100)

	var dueDate interface{}
	if body.DueDate != "" {
		if d, err := time.Parse("2006-01-02", body.DueDate); err == nil {
			dueDate = d
		}
	}

	var id string
	err = h.Pool.QueryRow(r.Context(), `
		INSERT INTO seed_loans (node_domain, user_id, seed_name, quantity_borrowed, unit,
			expected_return_qty, return_percentage, due_date, authorized_by, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id`,
		nodeDomain, userID, body.SeedName, body.QuantityBorrowed, body.Unit,
		expectedReturn, body.ReturnPercentage, dueDate, userID, body.Notes).Scan(&id)
	if err != nil {
		writeError(w, 500, "error creating seed loan")
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"id":              id,
		"expected_return": expectedReturn,
		"message":         "Prestamo de semillas registrado. Recuerda devolver " + formatFloat(expectedReturn) + " " + body.Unit,
	})
}

func (h *SeedBankHandler) getLoan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id requerido")
		return
	}

	var loan map[string]interface{}
	var userID, seedName, unit, status, notes *string
	var qtyBorrowed, expectedReturn, returnedQty, returnPct *float64
	var borrowedAt, dueDate, returnedAt interface{}

	err := h.Pool.QueryRow(r.Context(), `
		SELECT user_id, seed_name, quantity_borrowed, unit,
		       expected_return_qty, returned_qty, return_percentage,
		       status, borrowed_at, due_date, returned_at, notes
		FROM seed_loans WHERE id = $1`, id).Scan(
		&userID, &seedName, &qtyBorrowed, &unit,
		&expectedReturn, &returnedQty, &returnPct,
		&status, &borrowedAt, &dueDate, &returnedAt, &notes)
	if err != nil {
		writeError(w, 404, "prestamo no encontrado")
		return
	}

	loan = map[string]interface{}{
		"id":                id,
		"user_id":           userID,
		"seed_name":         seedName,
		"quantity_borrowed": qtyBorrowed,
		"unit":              unit,
		"expected_return":   expectedReturn,
		"returned_qty":      returnedQty,
		"return_percentage": returnPct,
		"status":            status,
		"borrowed_at":       borrowedAt,
		"due_date":          dueDate,
		"returned_at":       returnedAt,
		"notes":             notes,
	}

	// Cargar devoluciones parciales
	rows, _ := h.Pool.Query(r.Context(), `
		SELECT id, quantity_returned, received_by, notes, returned_at
		FROM seed_returns WHERE loan_id = $1 ORDER BY returned_at`, id)
	if rows != nil {
		defer rows.Close()
		var returns []map[string]interface{}
		for rows.Next() {
			var retID, receivedBy, retNotes *string
			var qtyReturned *float64
			var retAt interface{}
			rows.Scan(&retID, &qtyReturned, &receivedBy, &retNotes, &retAt)
			returns = append(returns, map[string]interface{}{
				"id":                retID,
				"quantity_returned": qtyReturned,
				"received_by":       receivedBy,
				"notes":             retNotes,
				"returned_at":       retAt,
			})
		}
		if returns == nil {
			returns = []map[string]interface{}{}
		}
		loan["returns"] = returns
	}

	writeJSON(w, 200, loan)
}

func (h *SeedBankHandler) registerReturn(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id requerido")
		return
	}

	receiverID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "no autenticado")
		return
	}

	var body struct {
		QuantityReturned float64 `json:"quantity_returned"`
		Notes            string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if body.QuantityReturned <= 0 {
		writeError(w, 400, "quantity_returned debe ser mayor que 0")
		return
	}

	// Registrar la devolucion
	_, err = h.Pool.Exec(r.Context(), `
		INSERT INTO seed_returns (loan_id, quantity_returned, received_by, notes)
		VALUES ($1, $2, $3, $4)`, id, body.QuantityReturned, receiverID, body.Notes)
	if err != nil {
		writeError(w, 500, "error registering return")
		return
	}

	// Actualizar el prestamo
	var newReturnedQty, expectedReturn float64
	err = h.Pool.QueryRow(r.Context(), `
		UPDATE seed_loans
		SET returned_qty = returned_qty + $2,
		    status = CASE
		    	WHEN returned_qty + $2 >= expected_return_qty THEN 'returned'
		    	WHEN returned_qty + $2 > 0 THEN 'active'
		    	ELSE status
		    END,
		    returned_at = CASE
		    	WHEN returned_qty + $2 >= expected_return_qty THEN NOW()
		    	ELSE returned_at
		    END,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING returned_qty, expected_return_qty`, id, body.QuantityReturned).Scan(&newReturnedQty, &expectedReturn)
	if err != nil {
		writeError(w, 500, "error updating loan")
		return
	}

	completed := newReturnedQty >= expectedReturn
	msg := "Devolucion registrada. Faltan " + formatFloat(expectedReturn-newReturnedQty) + " por devolver."
	if completed {
		msg = "Prestamo completamente devuelto. Banco de semillas crecido!"
	}
	writeJSON(w, 200, map[string]interface{}{
		"success":        true,
		"returned_total": newReturnedQty,
		"expected":       expectedReturn,
		"remaining":      expectedReturn - newReturnedQty,
		"completed":      completed,
		"message":        msg,
	})
}

func (h *SeedBankHandler) updateLoan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id requerido")
		return
	}

	var body struct {
		Status  string `json:"status"`
		Notes   string `json:"notes"`
		DueDate string `json:"due_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	var dueDate interface{}
	if body.DueDate != "" {
		if d, err := time.Parse("2006-01-02", body.DueDate); err == nil {
			dueDate = d
		}
	}

	_, err := h.Pool.Exec(r.Context(), `
		UPDATE seed_loans SET status = $2, notes = $3, due_date = COALESCE($4, due_date), updated_at = NOW()
		WHERE id = $1`, id, body.Status, body.Notes, dueDate)
	if err != nil {
		writeError(w, 500, "error updating loan")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *SeedBankHandler) cancelLoan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, 400, "id requerido")
		return
	}

	_, err := h.Pool.Exec(r.Context(), `UPDATE seed_loans SET status = 'defaulted', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		writeError(w, 500, "error cancelling loan")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"success": true})
}

func (h *SeedBankHandler) getInventory(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	// Inventario: sumar prestamos activos vs devoluciones
	rows, err := h.Pool.Query(r.Context(), `
		SELECT seed_name, unit,
		       SUM(quantity_borrowed) as total_borrowed,
		       SUM(returned_qty) as total_returned,
		       SUM(expected_return_qty) as total_expected,
		       COUNT(*) as loan_count
		FROM seed_loans
		WHERE node_domain = $1
		GROUP BY seed_name, unit
		ORDER BY seed_name`, nodeDomain)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"inventory": []map[string]interface{}{}})
		return
	}
	defer rows.Close()

	var inventory []map[string]interface{}
	for rows.Next() {
		var seedName, unit *string
		var totalBorrowed, totalReturned, totalExpected *float64
		var loanCount *int
		rows.Scan(&seedName, &unit, &totalBorrowed, &totalReturned, &totalExpected, &loanCount)
		balance := 0.0
		if totalReturned != nil && totalBorrowed != nil {
			balance = *totalReturned - *totalBorrowed
		}
		inv := map[string]interface{}{
			"seed_name":      seedName,
			"unit":           unit,
			"total_borrowed": totalBorrowed,
			"total_returned": totalReturned,
			"total_expected": totalExpected,
			"balance":        balance,
			"loan_count":     loanCount,
		}
		inventory = append(inventory, inv)
	}
	if inventory == nil {
		inventory = []map[string]interface{}{}
	}
	writeJSON(w, 200, map[string]interface{}{"inventory": inventory})
}

func (h *SeedBankHandler) getSeedConfig(w http.ResponseWriter, r *http.Request) {
	// Configuracion por defecto del banco de semillas
	writeJSON(w, 200, map[string]interface{}{
		"default_return_percentage": 20.0,
		"default_unit":              "sobres",
		"default_due_months":        6,
		"message":                   "El banco de semillas funciona con prestamo y devolucion. Devuelve mas de lo que tomaste para que el banco crezca.",
	})
}

func formatFloat(f float64) string {
	return fmt.Sprintf("%.2f", f)
}
