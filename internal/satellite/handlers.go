package satellite

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handlers contiene los handlers HTTP para los endpoints del satelite.
type Handlers struct {
	Sat  *Satellite
	Pool *pgxpool.Pool
}

func NewHandlers(sat *Satellite, pool *pgxpool.Pool) *Handlers {
	return &Handlers{Sat: sat, Pool: pool}
}

// SnapshotPullRequest es el body del endpoint de snapshot pull.
type SnapshotPullRequest struct {
	NodeURL string   `json:"node_url"` // URL del servidor federado mTLS del nodo origen
	Nodes   []string `json:"nodes"`    // lista de dominios a sincronizar (opcional, vacio = todos)
}

// RegisterRoutes registra las rutas del satelite en el mux dado.
func (h *Handlers) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/satellite/snapshot/pull", h.handleSnapshotPull)
	mux.HandleFunc("/api/satellite/snapshot/status", h.HandleSnapshotStatus)
	mux.HandleFunc("/api/satellite/pending-tx", h.handleListPendingTx)
	mux.HandleFunc("/api/satellite/sync-all", h.handleSyncAll)
	mux.HandleFunc("/api/satellite/cached-users", h.HandleListCachedUsers)
}

// handleSnapshotPull descarga el estado de usuarios y tarjetas de un nodo remoto.
func (h *Handlers) handleSnapshotPull(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	if !h.Sat.IsSatellite(r.Context()) {
		writeJSON(w, 403, map[string]string{"error": "este nodo no es un satelite"})
		return
	}

	var req SnapshotPullRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	if req.NodeURL == "" {
		writeJSON(w, 400, map[string]string{"error": "node_url is required"})
		return
	}

	// Crear HTTP client con timeout largo para snapshot
	httpClient := &http.Client{Timeout: 120 * time.Second}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	snapshot, err := h.Sat.PullSnapshot(ctx, req.NodeURL, httpClient)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": fmt.Sprintf("pulling snapshot: %v", err)})
		return
	}

	// Guardar en cache
	if err := h.Sat.SaveCachedUsers(ctx, snapshot.Users); err != nil {
		writeJSON(w, 500, map[string]string{"error": fmt.Sprintf("saving users: %v", err)})
		return
	}
	if err := h.Sat.SaveCachedCards(ctx, snapshot.Cards); err != nil {
		writeJSON(w, 500, map[string]string{"error": fmt.Sprintf("saving cards: %v", err)})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":       "ok",
		"users_cached": len(snapshot.Users),
		"cards_cached": len(snapshot.Cards),
	})
}

// HandleSnapshotStatus retorna el estado del cache del satelite.
func (h *Handlers) HandleSnapshotStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	var userCount, cardCount, pendingCount int
	_ = h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM satellite_cached_users`).Scan(&userCount)
	_ = h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM satellite_cached_cards`).Scan(&cardCount)
	_ = h.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM satellite_pending_tx WHERE synced = false`).Scan(&pendingCount)

	var lastCached time.Time
	_ = h.Pool.QueryRow(r.Context(), `SELECT MAX(cached_at) FROM satellite_cached_users`).Scan(&lastCached)

	writeJSON(w, 200, map[string]interface{}{
		"is_satellite":   h.Sat.IsSatellite(r.Context()),
		"users_cached":   userCount,
		"cards_cached":   cardCount,
		"pending_tx":     pendingCount,
		"last_cached_at": lastCached,
	})
}

// handleListPendingTx lista las transacciones pendientes de sincronizar.
func (h *Handlers) handleListPendingTx(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	txs, err := h.Sat.GetPendingTx(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if txs == nil {
		txs = []PendingTx{}
	}
	writeJSON(w, 200, txs)
}

// handleSyncAll envia todas las transacciones pendientes al nodo origen.
func (h *Handlers) handleSyncAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	var req struct {
		NodeURL string `json:"node_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if req.NodeURL == "" {
		writeJSON(w, 400, map[string]string{"error": "node_url is required"})
		return
	}

	httpClient := &http.Client{Timeout: 60 * time.Second}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()

	synced, failed, err := h.Sat.SyncAllPending(ctx, req.NodeURL, httpClient)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"synced": synced,
		"failed": failed,
	})
}

// HandleListCachedUsers lista los usuarios en cache.
func (h *Handlers) HandleListCachedUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}

	rows, err := h.Pool.Query(r.Context(), `
		SELECT id::text, node_domain, username, COALESCE(display_name, ''),
		       balance, credit_limit, debit_limit, membership_status, cached_at
		FROM satellite_cached_users ORDER BY node_domain, username`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	type CachedUser struct {
		ID               string    `json:"id"`
		NodeDomain       string    `json:"node_domain"`
		Username         string    `json:"username"`
		DisplayName      string    `json:"display_name"`
		Balance          int64     `json:"balance"`
		CreditLimit      int64     `json:"credit_limit"`
		DebitLimit       int64     `json:"debit_limit"`
		MembershipStatus string    `json:"membership_status"`
		CachedAt         time.Time `json:"cached_at"`
	}

	var users []CachedUser
	for rows.Next() {
		var u CachedUser
		if err := rows.Scan(&u.ID, &u.NodeDomain, &u.Username, &u.DisplayName,
			&u.Balance, &u.CreditLimit, &u.DebitLimit, &u.MembershipStatus, &u.CachedAt); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		users = append(users, u)
	}
	if users == nil {
		users = []CachedUser{}
	}
	writeJSON(w, 200, users)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
