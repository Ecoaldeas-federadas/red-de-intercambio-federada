package api

import (
	"encoding/json"
	"net/http"

	"federated-credit-node/internal/accounts"
	"federated-credit-node/internal/db"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ServicesHandler maneja los endpoints de servicios y suscripciones
type ServicesHandler struct {
	Services *accounts.Services
	Pool     *pgxpool.Pool
}

func NewServicesHandler(pool *pgxpool.Pool) *ServicesHandler {
	return &ServicesHandler{
		Services: accounts.NewServices(pool),
		Pool:     pool,
	}
}

func (h *ServicesHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.With(am.RequireAuth).Get("/api/organizations/{id}/services", h.listServices)
	r.With(am.RequireAuth).Post("/api/organizations/{id}/services", h.createService)
	r.With(am.RequireAuth).Put("/api/organizations/services/{serviceId}", h.updateService)
	r.With(am.RequireAuth).Delete("/api/organizations/services/{serviceId}", h.deactivateService)

	r.With(am.RequireAuth).Get("/api/organizations/services/{serviceId}/subscriptions", h.listSubscriptions)
	r.With(am.RequireAuth).Post("/api/organizations/services/{serviceId}/subscribe", h.subscribe)
	r.With(am.RequireAuth).Delete("/api/organizations/services/{serviceId}/subscribe", h.unsubscribe)

	r.With(am.RequireAuth).Get("/api/my-services", h.myServices)
	r.With(am.RequireAuth).Get("/api/my-subscriptions", h.mySubscriptions)
}

// listServices lista los servicios de una organizacion
func (h *ServicesHandler) listServices(w http.ResponseWriter, r *http.Request) {
	orgID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid organization id")
		return
	}

	services, err := h.Services.ListServices(r.Context(), orgID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if services == nil {
		services = []accounts.Service{}
	}
	h.localizeServices(r, services)
	writeJSON(w, 200, services)
}

// createService crea un nuevo servicio en una organizacion
func (h *ServicesHandler) createService(w http.ResponseWriter, r *http.Request) {
	orgID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 400, "invalid organization id")
		return
	}

	// Verificar que la organizacion existe y obtener node_domain
	var nodeDomain string
	var isAssemblyOwned bool
	err = h.Pool.QueryRow(r.Context(), `SELECT node_domain, COALESCE(is_assembly_owned, false) FROM users WHERE id = $1 AND account_type = 'organization'`, orgID).Scan(&nodeDomain, &isAssemblyOwned)
	if err != nil {
		writeError(w, 404, "organizacion no encontrada")
		return
	}

	var req accounts.Service
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, 400, "name es requerido")
		return
	}
	if req.ServiceType == "" {
		req.ServiceType = "subscription"
	}
	if req.Frequency == "" {
		req.Frequency = "monthly"
	}

	// Si es org de Asamblea, el servicio es obligatorio
	if isAssemblyOwned {
		req.IsMandatory = true
	}

	req.NodeDomain = nodeDomain
	req.OrganizationID = orgID

	svc, err := h.Services.CreateService(r.Context(), &req)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	registerEntityFields(r.Context(), h.Pool, svc.NodeDomain, "organization_service", svc.ID.String(), map[string]string{
		"name": svc.Name, "description": svc.Description, "obligations": svc.Obligations,
		"rights": svc.Rights, "duties": svc.Duties,
	}, map[string]interface{}{"label": svc.Name})

	// Si es obligatorio (org de Asamblea), auto-suscribir a todos los miembros
	if svc.IsMandatory {
		if err := h.Services.AutoSubscribeAllMembers(r.Context(), svc.ID, nodeDomain); err != nil {
			writeJSON(w, 200, map[string]interface{}{
				"service": svc,
				"warning": "Servicio creado pero fallo auto-suscripcion de miembros",
				"error":   err.Error(),
			})
			return
		}
	}

	writeJSON(w, 201, svc)
}

// updateService actualiza un servicio existente
func (h *ServicesHandler) updateService(w http.ResponseWriter, r *http.Request) {
	serviceID, err := uuid.Parse(chi.URLParam(r, "serviceId"))
	if err != nil {
		writeError(w, 400, "invalid service id")
		return
	}

	var req accounts.Service
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	if err := h.Services.UpdateService(r.Context(), serviceID, &req); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	var nodeDomain string
	if err := h.Pool.QueryRow(r.Context(), `SELECT node_domain FROM organization_services WHERE id = $1`, serviceID).Scan(&nodeDomain); err == nil {
		registerEntityFields(r.Context(), h.Pool, nodeDomain, "organization_service", serviceID.String(), map[string]string{
			"name": req.Name, "description": req.Description, "obligations": req.Obligations,
			"rights": req.Rights, "duties": req.Duties,
		}, map[string]interface{}{"label": req.Name})
	}

	writeJSON(w, 200, map[string]interface{}{"status": "updated"})
}

func (h *ServicesHandler) localizeServices(r *http.Request, services []accounts.Service) {
	if len(services) == 0 {
		return
	}
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), services[0].NodeDomain)
	lang, fallbackLang := resolveRequestLanguages(r, h.Pool, nodeDomain)
	if lang == fallbackLang {
		return
	}
	keys := make([]string, 0, len(services)*5)
	for _, svc := range services {
		id := svc.ID.String()
		for _, field := range []string{"name", "description", "obligations", "rights", "duties"} {
			keys = append(keys, "organization_service:"+id+":"+field)
		}
	}
	values := localizedContentValues(r.Context(), h.Pool, keys, lang)
	for i := range services {
		svc := &services[i]
		id := svc.ID.String()
		if value := values["organization_service:"+id+":name"]; value != "" {
			svc.Name = value
		}
		if value := values["organization_service:"+id+":description"]; value != "" {
			svc.Description = value
		}
		if value := values["organization_service:"+id+":obligations"]; value != "" {
			svc.Obligations = value
		}
		if value := values["organization_service:"+id+":rights"]; value != "" {
			svc.Rights = value
		}
		if value := values["organization_service:"+id+":duties"]; value != "" {
			svc.Duties = value
		}
	}
}

// deactivateService desactiva un servicio
func (h *ServicesHandler) deactivateService(w http.ResponseWriter, r *http.Request) {
	serviceID, err := uuid.Parse(chi.URLParam(r, "serviceId"))
	if err != nil {
		writeError(w, 400, "invalid service id")
		return
	}

	if err := h.Services.DeactivateService(r.Context(), serviceID); err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"status": "deactivated"})
}

// listSubscriptions lista los suscriptores de un servicio
func (h *ServicesHandler) listSubscriptions(w http.ResponseWriter, r *http.Request) {
	serviceID, err := uuid.Parse(chi.URLParam(r, "serviceId"))
	if err != nil {
		writeError(w, 400, "invalid service id")
		return
	}

	subs, err := h.Services.ListServiceSubscriptions(r.Context(), serviceID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if subs == nil {
		subs = []accounts.Subscription{}
	}
	writeJSON(w, 200, subs)
}

// subscribe suscribe al usuario actual a un servicio voluntario
func (h *ServicesHandler) subscribe(w http.ResponseWriter, r *http.Request) {
	serviceID, err := uuid.Parse(chi.URLParam(r, "serviceId"))
	if err != nil {
		writeError(w, 400, "invalid service id")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Verificar que el servicio es voluntario
	var isMandatory bool
	var isActive bool
	_ = h.Pool.QueryRow(r.Context(), `SELECT is_mandatory, is_active FROM organization_services WHERE id = $1`, serviceID).Scan(&isMandatory, &isActive)
	if !isActive {
		writeError(w, 400, "servicio no disponible")
		return
	}
	if isMandatory {
		writeError(w, 400, "este servicio es obligatorio, no requiere suscripcion manual")
		return
	}

	if err := h.Services.Subscribe(r.Context(), serviceID, userID, false); err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"status": "subscribed"})
}

// unsubscribe desuscribe al usuario actual de un servicio voluntario
func (h *ServicesHandler) unsubscribe(w http.ResponseWriter, r *http.Request) {
	serviceID, err := uuid.Parse(chi.URLParam(r, "serviceId"))
	if err != nil {
		writeError(w, 400, "invalid service id")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	if err := h.Services.Unsubscribe(r.Context(), serviceID, userID); err != nil {
		writeError(w, 400, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{"status": "unsubscribed"})
}

// myServices lista los servicios disponibles para el usuario
func (h *ServicesHandler) myServices(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Obtener node_domain del usuario
	var nodeDomain string
	_ = h.Pool.QueryRow(r.Context(), `SELECT node_domain FROM users WHERE id = $1`, userID).Scan(&nodeDomain)

	// Servicios de la Asamblea (obligatorios)
	assemblyServices, err := h.Services.ListAssemblyServices(r.Context(), nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Servicios voluntarios disponibles (no de Asamblea, activos)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT s.id, s.node_domain, s.organization_id, s.name, COALESCE(s.description, ''),
			   s.service_type, s.amount, s.frequency, s.is_mandatory,
			   COALESCE(s.obligations, ''), COALESCE(s.rights, ''), COALESCE(s.duties, ''),
			   s.is_active, s.created_by_proposal, s.created_at, s.updated_at,
			   COALESCE(o.display_name, o.username, ''), 0
		FROM organization_services s
		JOIN users o ON o.id = s.organization_id
		WHERE s.node_domain = $1 AND s.is_active = true AND o.is_assembly_owned = false AND s.is_mandatory = false
		ORDER BY s.name`, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	var voluntaryServices []accounts.Service
	for rows.Next() {
		var svc accounts.Service
		var proposalID *uuid.UUID
		if err := rows.Scan(&svc.ID, &svc.NodeDomain, &svc.OrganizationID, &svc.Name, &svc.Description,
			&svc.ServiceType, &svc.Amount, &svc.Frequency, &svc.IsMandatory,
			&svc.Obligations, &svc.Rights, &svc.Duties,
			&svc.IsActive, &proposalID, &svc.CreatedAt, &svc.UpdatedAt,
			&svc.OrganizationName, &svc.SubscribersCount); err != nil {
			continue
		}
		svc.CreatedByProposal = proposalID
		voluntaryServices = append(voluntaryServices, svc)
	}
	if voluntaryServices == nil {
		voluntaryServices = []accounts.Service{}
	}
	h.localizeServices(r, assemblyServices)
	h.localizeServices(r, voluntaryServices)

	writeJSON(w, 200, map[string]interface{}{
		"assembly_services":  assemblyServices,
		"voluntary_services": voluntaryServices,
	})
}

// mySubscriptions lista las suscripciones activas del usuario
func (h *ServicesHandler) mySubscriptions(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	subs, err := h.Services.ListUserSubscriptions(r.Context(), userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if subs == nil {
		subs = []accounts.Subscription{}
	}
	writeJSON(w, 200, subs)
}

// getUserID extrae el user ID del contexto JWT
func getUserID(r *http.Request) (uuid.UUID, error) {
	// El middleware RequireAuth guarda user_id como string
	if uidStr, ok := r.Context().Value("user_id").(string); ok {
		return uuid.Parse(uidStr)
	}
	// Compatibilidad: algunos contextos podrian guardarlo como uuid.UUID
	if uid, ok := r.Context().Value("user_id").(uuid.UUID); ok {
		return uid, nil
	}
	// Fallback al header
	idStr := r.Header.Get("X-User-ID")
	return uuid.Parse(idStr)
}
