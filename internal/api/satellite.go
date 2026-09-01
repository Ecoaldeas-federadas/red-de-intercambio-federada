package api

import (
	"encoding/json"
	"federated-credit-node/internal/satellite"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SatelliteAPIHandler envuelve el paquete satellite para registrar rutas en chi.
type SatelliteAPIHandler struct {
	Sat *satellite.Satellite
	Pool *pgxpool.Pool
}

func NewSatelliteAPIHandler(pool *pgxpool.Pool, nodeDomain string) *SatelliteAPIHandler {
	return &SatelliteAPIHandler{
		Sat:  satellite.New(pool, nodeDomain),
		Pool: pool,
	}
}

func (sh *SatelliteAPIHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)

		r.Post("/api/satellite/snapshot/pull", sh.handleSnapshotPull)
		r.Get("/api/satellite/snapshot/status", sh.handleSnapshotStatus)
		r.Get("/api/satellite/pending-tx", sh.handleListPendingTx)
		r.Post("/api/satellite/sync-all", sh.handleSyncAll)
		r.Get("/api/satellite/cached-users", sh.handleListCachedUsers)
	})
}

func (sh *SatelliteAPIHandler) handleSnapshotPull(w http.ResponseWriter, r *http.Request) {
	if !sh.Sat.IsSatellite(r.Context()) {
		writeJSON(w, 403, map[string]string{"error": "este nodo no es un satelite"})
		return
	}

	var req satellite.SnapshotPullRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	if req.NodeURL == "" {
		writeJSON(w, 400, map[string]string{"error": "node_url is required"})
		return
	}

	httpClient := &http.Client{Timeout: 120 * 1e9}
	snapshot, err := sh.Sat.PullSnapshot(r.Context(), req.NodeURL, httpClient)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": err.Error()})
		return
	}

	if err := sh.Sat.SaveCachedUsers(r.Context(), snapshot.Users); err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if err := sh.Sat.SaveCachedCards(r.Context(), snapshot.Cards); err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":       "ok",
		"users_cached": len(snapshot.Users),
		"cards_cached": len(snapshot.Cards),
	})
}

func (sh *SatelliteAPIHandler) handleSnapshotStatus(w http.ResponseWriter, r *http.Request) {
	handlers := satellite.NewHandlers(sh.Sat, sh.Pool)
	handlers.HandleSnapshotStatus(w, r)
}

func (sh *SatelliteAPIHandler) handleListPendingTx(w http.ResponseWriter, r *http.Request) {
	txs, err := sh.Sat.GetPendingTx(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if txs == nil {
		txs = []satellite.PendingTx{}
	}
	writeJSON(w, 200, txs)
}

func (sh *SatelliteAPIHandler) handleSyncAll(w http.ResponseWriter, r *http.Request) {
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

	httpClient := &http.Client{Timeout: 60 * 1e9}
	synced, failed, err := sh.Sat.SyncAllPending(r.Context(), req.NodeURL, httpClient)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"synced": synced,
		"failed": failed,
	})
}

func (sh *SatelliteAPIHandler) handleListCachedUsers(w http.ResponseWriter, r *http.Request) {
	handlers := satellite.NewHandlers(sh.Sat, sh.Pool)
	handlers.HandleListCachedUsers(w, r)
}
