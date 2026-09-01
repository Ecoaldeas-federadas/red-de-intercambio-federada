// Package federation — profiles.go
//
// Endpoints federation para sharing de perfiles de nodo y prohibiciones
// de productos entre nodos federados que comparten el mismo perfil.

package federation

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
)

// ===== Tipos =====

// FaithProfileSync es un perfil compartido via federation.
type FaithProfileSync struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Category     string `json:"category"`
	Icon         string `json:"icon"`
	DefaultRules string `json:"default_rules"`
	CreatedBy    string `json:"created_by"`
	IsOfficial   bool   `json:"is_official"`
}

// FaithProfilesSyncPayload es el payload de sync de perfiles.
type FaithProfilesSyncPayload struct {
	FromNode string             `json:"from_node"`
	Profiles []FaithProfileSync `json:"profiles"`
}

// ProhibitionSync es una prohibicion compartida via federation.
type ProhibitionSync struct {
	ProfileID       string  `json:"profile_id"`
	ProductName     string  `json:"product_name"`
	ProductCategory *string `json:"product_category"`
	Reason          *string `json:"reason"`
}

// ProhibitionsSyncPayload es el payload de sync de prohibiciones.
type ProhibitionsSyncPayload struct {
	FromNode     string            `json:"from_node"`
	Prohibitions []ProhibitionSync `json:"prohibitions"`
}

// ===== Endpoints =====

// handleFaithProfilesList responde con la lista de perfiles compartidos.
func (s *Server) handleFaithProfilesList(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Pool.Query(r.Context(), `
		SELECT id, name, description, category, icon, default_rules, created_by, is_official
		FROM node_faith_profiles WHERE is_shared = true`)
	if err != nil {
		http.Error(w, "error querying profiles", 500)
		return
	}
	defer rows.Close()

	var profiles []FaithProfileSync
	for rows.Next() {
		var p FaithProfileSync
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Category,
			&p.Icon, &p.DefaultRules, &p.CreatedBy, &p.IsOfficial); err != nil {
			continue
		}
		profiles = append(profiles, p)
	}
	if profiles == nil {
		profiles = []FaithProfileSync{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profiles)
}

// handleFaithProfilesSync recibe perfiles de un peer y los guarda.
func (s *Server) handleFaithProfilesSync(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "error reading body", 400)
		return
	}
	defer r.Body.Close()

	var payload FaithProfilesSyncPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "error parsing payload", 400)
		return
	}

	if payload.FromNode == "" || payload.FromNode == s.NodeDomain {
		w.WriteHeader(200)
		return
	}

	saved := 0
	for _, p := range payload.Profiles {
		// No sobrescribir perfiles oficiales (system)
		_, err := s.Pool.Exec(r.Context(), `
			INSERT INTO node_faith_profiles (id, name, description, category, icon, default_rules, created_by, is_official, is_shared)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
			ON CONFLICT (id) DO UPDATE SET
				name = $2, description = $3, default_rules = $6, updated_at = NOW()
			WHERE node_faith_profiles.is_official = false OR node_faith_profiles.created_by = $7`,
			p.ID, p.Name, p.Description, p.Category, p.Icon, p.DefaultRules,
			p.CreatedBy, p.IsOfficial)
		if err == nil {
			saved++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"saved": saved})
}

// handleProfileProhibitionsList responde con prohibiciones de un perfil.
func (s *Server) handleProfileProhibitionsList(w http.ResponseWriter, r *http.Request) {
	profileID := r.URL.Query().Get("profile")
	if profileID == "" {
		http.Error(w, "profile query param required", 400)
		return
	}

	rows, err := s.Pool.Query(r.Context(), `
		SELECT profile_id, product_name, product_category, reason
		FROM profile_product_prohibitions
		WHERE approval_status = 'approved' AND profile_id = $1`,
		profileID)
	if err != nil {
		http.Error(w, "error querying prohibitions", 500)
		return
	}
	defer rows.Close()

	var prohibitions []ProhibitionSync
	for rows.Next() {
		var p ProhibitionSync
		if err := rows.Scan(&p.ProfileID, &p.ProductName, &p.ProductCategory, &p.Reason); err != nil {
			continue
		}
		prohibitions = append(prohibitions, p)
	}
	if prohibitions == nil {
		prohibitions = []ProhibitionSync{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(prohibitions)
}

// handleProfileProhibitionsSync recibe prohibiciones de un peer.
func (s *Server) handleProfileProhibitionsSync(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "error reading body", 400)
		return
	}
	defer r.Body.Close()

	var payload ProhibitionsSyncPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "error parsing payload", 400)
		return
	}

	if payload.FromNode == "" || payload.FromNode == s.NodeDomain {
		w.WriteHeader(200)
		return
	}

	// Obtener el perfil del nodo actual
	var myProfile string
	err = s.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(faith_profile, '') FROM node_profile_settings WHERE node_domain = $1`,
		s.NodeDomain).Scan(&myProfile)
	if err != nil || myProfile == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"saved": 0})
		return
	}

	// Verificar si el nodo recibe prohibiciones de peers
	var receivePeer bool
	s.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(receive_peer_prohibitions, true) FROM node_profile_settings WHERE node_domain = $1`,
		s.NodeDomain).Scan(&receivePeer)
	if !receivePeer {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"saved": 0})
		return
	}

	// Verificar auto-approve
	var autoApprove bool
	s.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(auto_approve_prohibitions, false) FROM node_profile_settings WHERE node_domain = $1`,
		s.NodeDomain).Scan(&autoApprove)

	saved := 0
	for _, p := range payload.Prohibitions {
		// Solo procesar prohibiciones para nuestro perfil
		if p.ProfileID != myProfile {
			continue
		}

		// Verificar si ya existe (aprobada o rechazada)
		var existingStatus string
		err := s.Pool.QueryRow(r.Context(), `
			SELECT approval_status FROM profile_product_prohibitions
			WHERE node_domain = $1 AND profile_id = $2 AND product_name = $3`,
			s.NodeDomain, p.ProfileID, p.ProductName).Scan(&existingStatus)
		if err == nil && existingStatus == "approved" {
			continue // ya la tenemos
		}
		if err == nil && existingStatus == "rejected" {
			continue // el admin la rechazo, no re-agregar
		}

		if autoApprove {
			// Auto-aprobar: guardar directamente en prohibiciones
			_, err := s.Pool.Exec(r.Context(), `
				INSERT INTO profile_product_prohibitions
					(node_domain, profile_id, product_name, product_category, reason, reported_by, approval_status, auto_approved)
				VALUES ($1, $2, $3, $4, $5, $6, 'approved', true)
				ON CONFLICT (node_domain, profile_id, product_name) DO NOTHING`,
				s.NodeDomain, p.ProfileID, p.ProductName, p.ProductCategory, p.Reason, payload.FromNode)
			if err == nil {
				saved++
			}
		} else {
			// Guardar en cola de aprobacion
			_, err := s.Pool.Exec(r.Context(), `
				INSERT INTO profile_product_prohibition_queue
					(node_domain, profile_id, product_name, product_category, reason, reported_by, status)
				VALUES ($1, $2, $3, $4, $5, $6, 'pending')
				ON CONFLICT (node_domain, profile_id, product_name) DO NOTHING`,
				s.NodeDomain, p.ProfileID, p.ProductName, p.ProductCategory, p.Reason, payload.FromNode)
			if err == nil {
				saved++
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"saved": saved})
}

// ===== Gossip =====

// syncFaithProfiles envia perfiles compartidos a todos los peers activos.
func (g *Gossip) syncFaithProfiles(ctx context.Context) {
	rows, err := g.Pool.Query(ctx, `
		SELECT id, name, description, category, icon, default_rules, created_by, is_official
		FROM node_faith_profiles WHERE is_shared = true`)
	if err != nil {
		return
	}
	defer rows.Close()

	var profiles []FaithProfileSync
	for rows.Next() {
		var p FaithProfileSync
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Category,
			&p.Icon, &p.DefaultRules, &p.CreatedBy, &p.IsOfficial); err != nil {
			continue
		}
		profiles = append(profiles, p)
	}

	if len(profiles) == 0 {
		return
	}

	if g.Client != nil {
		payload, _ := json.Marshal(FaithProfilesSyncPayload{
			FromNode: g.NodeDomain,
			Profiles: profiles,
		})

		peerRows, err := g.Pool.Query(ctx,
			`SELECT peer_domain FROM node_federation_keys WHERE status = 'active'`)
		if err != nil {
			return
		}
		defer peerRows.Close()

		for peerRows.Next() {
			var peerDomain string
			_ = peerRows.Scan(&peerDomain)
			if peerDomain == g.NodeDomain {
				continue
			}
			_ = g.postToPeer(ctx, peerDomain, "/federation/faith-profiles/sync", payload)
		}
	}
}

// syncProfileProhibitions envia prohibiciones aprobadas a peers con el mismo perfil.
func (g *Gossip) syncProfileProhibitions(ctx context.Context) {
	// Obtener perfil del nodo
	var myProfile string
	err := g.Pool.QueryRow(ctx, `
		SELECT COALESCE(faith_profile, '') FROM node_profile_settings WHERE node_domain = $1`,
		g.NodeDomain).Scan(&myProfile)
	if err != nil || myProfile == "" {
		return
	}

	// Obtener prohibiciones aprobadas
	rows, err := g.Pool.Query(ctx, `
		SELECT profile_id, product_name, product_category, reason
		FROM profile_product_prohibitions
		WHERE node_domain = $1 AND approval_status = 'approved' AND profile_id = $2`,
		g.NodeDomain, myProfile)
	if err != nil {
		return
	}
	defer rows.Close()

	var prohibitions []ProhibitionSync
	for rows.Next() {
		var p ProhibitionSync
		if err := rows.Scan(&p.ProfileID, &p.ProductName, &p.ProductCategory, &p.Reason); err != nil {
			continue
		}
		prohibitions = append(prohibitions, p)
	}

	if len(prohibitions) == 0 {
		return
	}

	if g.Client != nil {
		payload, _ := json.Marshal(ProhibitionsSyncPayload{
			FromNode:     g.NodeDomain,
			Prohibitions: prohibitions,
		})

		peerRows, err := g.Pool.Query(ctx,
			`SELECT peer_domain FROM node_federation_keys WHERE status = 'active'`)
		if err != nil {
			return
		}
		defer peerRows.Close()

		for peerRows.Next() {
			var peerDomain string
			_ = peerRows.Scan(&peerDomain)
			if peerDomain == g.NodeDomain {
				continue
			}
			_ = g.postToPeer(ctx, peerDomain, "/federation/profile-prohibitions/sync", payload)
		}
	}
}
