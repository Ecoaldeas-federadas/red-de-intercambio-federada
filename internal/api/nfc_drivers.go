// Package api — nfc_drivers.go
//
// Handlers HTTP para gestion de drivers NFC auto-instalables (.nfcpkg).
// Permite al admin subir, instalar, activar, desactivar, desinstalar y
// compartir drivers con nodos federados.

package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"federated-credit-node/internal/payments/cards"
)

// NFCDriverHandler maneja los endpoints de drivers NFC.
type NFCDriverHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

// NewNFCDriverHandler crea un nuevo handler.
func NewNFCDriverHandler(pool *pgxpool.Pool, nodeDomain string) *NFCDriverHandler {
	return &NFCDriverHandler{Pool: pool, NodeDomain: nodeDomain}
}

// RegisterRoutes registra las rutas de drivers NFC.
func (h *NFCDriverHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	// Endpoints admin (JWT + permiso nfc.issue_card)
	r.With(am.RequirePermission("nfc.issue_card")).Get("/api/nfc/drivers", h.listDrivers)
	r.With(am.RequirePermission("nfc.issue_card")).Get("/api/nfc/drivers/{type}", h.getDriver)
	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/drivers/upload", h.uploadDriver)
	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/drivers/{type}/activate", h.activateDriver)
	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/drivers/{type}/deactivate", h.deactivateDriver)
	r.With(am.RequirePermission("nfc.issue_card")).Delete("/api/nfc/drivers/{type}", h.uninstallDriver)
	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/drivers/{type}/share", h.shareDriver)

	// Drivers disponibles de peers federados
	r.With(am.RequirePermission("nfc.issue_card")).Get("/api/nfc/drivers/available", h.listAvailableFromPeers)
	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/drivers/install-from-peer", h.installFromPeer)

	// Gestion de claves de firma
	r.With(am.RequirePermission("nfc.issue_card")).Get("/api/nfc/drivers/signing-keys", h.listSigningKeys)
	r.With(am.RequirePermission("nfc.issue_card")).Post("/api/nfc/drivers/signing-keys", h.addSigningKey)
	r.With(am.RequirePermission("nfc.issue_card")).Delete("/api/nfc/drivers/signing-keys/{id}", h.removeSigningKey)

	// Endpoints para POS Android (JWT del terminal o del usuario)
	r.With(am.RequireAuth).Get("/api/nfc/card-drivers", h.listCardDriversForPOS)
	r.With(am.RequireAuth).Get("/api/nfc/card-drivers/{type}/reader", h.getReaderJSON)
}

// listDrivers retorna todos los drivers instalados.
func (h *NFCDriverHandler) listDrivers(w http.ResponseWriter, r *http.Request) {
	drivers, err := cards.ListInstalledDrivers(r.Context(), h.Pool, false)
	if err != nil {
		writeError(w, 500, "error listando drivers: "+err.Error())
		return
	}
	if drivers == nil {
		drivers = []cards.InstalledDriverInfo{}
	}
	writeJSON(w, 200, drivers)
}

// getDriver retorna el detalle de un driver.
func (h *NFCDriverHandler) getDriver(w http.ResponseWriter, r *http.Request) {
	cardType := chi.URLParam(r, "type")
	driver, err := cards.GetInstalledDriver(r.Context(), h.Pool, cardType)
	if err != nil {
		writeError(w, 404, "driver no encontrado: "+err.Error())
		return
	}
	writeJSON(w, 200, driver)
}

// uploadDriver recibe un .nfcpkg via multipart/form-data y lo instala.
func (h *NFCDriverHandler) uploadDriver(w http.ResponseWriter, r *http.Request) {
	// Limitar tamano del upload (50MB max)
	r.Body = http.MaxBytesReader(w, r.Body, 50<<20)

	// Parsear multipart
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		writeError(w, 400, "error parseando upload: "+err.Error())
		return
	}

	// Obtener el archivo
	file, header, err := r.FormFile("package")
	if err != nil {
		writeError(w, 400, "archivo 'package' no encontrado en el upload")
		return
	}
	defer file.Close()

	// Verificar extension
	if !strings.HasSuffix(strings.ToLower(header.Filename), ".nfcpkg") &&
		!strings.HasSuffix(strings.ToLower(header.Filename), ".zip") {
		writeError(w, 400, "el archivo debe ser .nfcpkg o .zip")
		return
	}

	// Leer el contenido
	pkgData, err := io.ReadAll(file)
	if err != nil {
		writeError(w, 400, "error leyendo archivo: "+err.Error())
		return
	}

	if len(pkgData) == 0 {
		writeError(w, 400, "archivo vacio")
		return
	}

	// Instalar el paquete
	// signWithNodeKey=true: si el paquete no tiene firma, lo firma con la clave del nodo
	result, err := cards.InstallPackage(r.Context(), h.Pool, h.NodeDomain, pkgData, true)
	if err != nil {
		writeError(w, 400, "error instalando driver: "+err.Error())
		return
	}

	writeJSON(w, 200, result)
}

// activateDriver activa un driver desactivado.
func (h *NFCDriverHandler) activateDriver(w http.ResponseWriter, r *http.Request) {
	cardType := chi.URLParam(r, "type")
	if err := cards.ActivateDriver(r.Context(), h.Pool, cardType); err != nil {
		writeError(w, 400, "error activando driver: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "activated", "type": cardType})
}

// deactivateDriver desactiva un driver.
func (h *NFCDriverHandler) deactivateDriver(w http.ResponseWriter, r *http.Request) {
	cardType := chi.URLParam(r, "type")
	if err := cards.DeactivateDriver(r.Context(), h.Pool, cardType); err != nil {
		writeError(w, 400, "error desactivando driver: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deactivated", "type": cardType})
}

// uninstallDriver desinstala un driver.
func (h *NFCDriverHandler) uninstallDriver(w http.ResponseWriter, r *http.Request) {
	cardType := chi.URLParam(r, "type")
	if err := cards.UninstallDriver(r.Context(), h.Pool, cardType); err != nil {
		writeError(w, 400, "error desinstalando driver: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "uninstalled", "type": cardType})
}

// shareDriver marca un driver para compartir con nodos federados.
func (h *NFCDriverHandler) shareDriver(w http.ResponseWriter, r *http.Request) {
	cardType := chi.URLParam(r, "type")
	if err := cards.ShareDriverWithFederation(r.Context(), h.Pool, cardType); err != nil {
		writeError(w, 400, "error compartiendo driver: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "shared", "type": cardType})
}

// listAvailableFromPeers lista drivers disponibles en nodos federados
// que este nodo no tiene instalados.
func (h *NFCDriverHandler) listAvailableFromPeers(w http.ResponseWriter, r *http.Request) {
	// Leer de la cache de paquetes recibidos via gossip
	rows, err := h.Pool.Query(r.Context(),
		`SELECT type, version, display_name, shared_by, signed_by, package_hash, received_at
		 FROM nfc_driver_packages_cache
		 WHERE installed = false AND dismissed = false
		 ORDER BY received_at DESC`)
	if err != nil {
		writeError(w, 500, "error consultando paquetes disponibles: "+err.Error())
		return
	}
	defer rows.Close()

	type AvailableDriver struct {
		Type        string `json:"type"`
		Version     string `json:"version"`
		DisplayName string `json:"display_name"`
		SharedBy    string `json:"shared_by"`
		SignedBy    string `json:"signed_by"`
		PackageHash string `json:"package_hash"`
		ReceivedAt  string `json:"received_at"`
	}

	var drivers []AvailableDriver
	for rows.Next() {
		var d AvailableDriver
		if err := rows.Scan(&d.Type, &d.Version, &d.DisplayName, &d.SharedBy, &d.SignedBy, &d.PackageHash, &d.ReceivedAt); err != nil {
			continue
		}
		drivers = append(drivers, d)
	}
	if drivers == nil {
		drivers = []AvailableDriver{}
	}
	writeJSON(w, 200, drivers)
}

// installFromPeer instala un driver desde la cache de paquetes federados.
type installFromPeerRequest struct {
	Type string `json:"type"`
}

func (h *NFCDriverHandler) installFromPeer(w http.ResponseWriter, r *http.Request) {
	var req installFromPeerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Type == "" {
		writeError(w, 400, "type es obligatorio")
		return
	}

	// Obtener el paquete de la cache
	var pkgData []byte
	err := h.Pool.QueryRow(r.Context(),
		"SELECT package_data FROM nfc_driver_packages_cache WHERE type = $1 AND installed = false ORDER BY received_at DESC LIMIT 1",
		req.Type).Scan(&pkgData)
	if err != nil {
		writeError(w, 404, "paquete no encontrado en cache federada: "+err.Error())
		return
	}

	// Instalar (no firmar con clave del nodo — ya viene firmado por el nodo origen)
	result, err := cards.InstallPackage(r.Context(), h.Pool, h.NodeDomain, pkgData, false)
	if err != nil {
		writeError(w, 400, "error instalando driver federado: "+err.Error())
		return
	}

	// Marcar como instalado en la cache
	h.Pool.Exec(r.Context(),
		"UPDATE nfc_driver_packages_cache SET installed = true WHERE type = $1", req.Type)

	writeJSON(w, 200, result)
}

// listSigningKeys lista las claves de firma confiables.
func (h *NFCDriverHandler) listSigningKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := cards.ListTrustedKeys(r.Context(), h.Pool)
	if err != nil {
		writeError(w, 500, "error listando claves: "+err.Error())
		return
	}
	if keys == nil {
		keys = []cards.TrustedKeyInfo{}
	}
	writeJSON(w, 200, keys)
}

// addSigningKey agrega una clave de firma confiable.
type addSigningKeyRequest struct {
	Label      string `json:"label"`
	PublicKey  string `json:"public_key"`
	TrustLevel string `json:"trust_level"`
}

func (h *NFCDriverHandler) addSigningKey(w http.ResponseWriter, r *http.Request) {
	var req addSigningKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Label == "" || req.PublicKey == "" {
		writeError(w, 400, "label y public_key son obligatorios")
		return
	}
	if req.TrustLevel == "" {
		req.TrustLevel = "manual"
	}

	if err := cards.AddTrustedKey(r.Context(), h.Pool, req.Label, req.PublicKey, req.TrustLevel); err != nil {
		writeError(w, 400, "error agregando clave: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "added"})
}

// removeSigningKey remueve una clave de firma confiable.
func (h *NFCDriverHandler) removeSigningKey(w http.ResponseWriter, r *http.Request) {
	keyID := chi.URLParam(r, "id")
	if err := cards.RemoveTrustedKey(r.Context(), h.Pool, keyID); err != nil {
		writeError(w, 400, "error removiendo clave: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "removed"})
}

// listCardDriversForPOS retorna la lista de drivers con reader.json para el POS Android.
func (h *NFCDriverHandler) listCardDriversForPOS(w http.ResponseWriter, r *http.Request) {
	drivers, err := cards.ListInstalledDrivers(r.Context(), h.Pool, true)
	if err != nil {
		writeError(w, 500, "error listando drivers: "+err.Error())
		return
	}

	// Filtrar solo drivers activos
	type POSDriverInfo struct {
		Type        string `json:"type"`
		DisplayName string `json:"display_name"`
		Version     string `json:"version"`
		ReaderJSON  string `json:"reader_json"`
	}
	var posDrivers []POSDriverInfo
	for _, d := range drivers {
		if d.IsActive && d.ReaderJSON != "" {
			posDrivers = append(posDrivers, POSDriverInfo{
				Type:        d.Type,
				DisplayName: d.DisplayName,
				Version:     d.Version,
				ReaderJSON:  d.ReaderJSON,
			})
		}
	}
	if posDrivers == nil {
		posDrivers = []POSDriverInfo{}
	}
	writeJSON(w, 200, posDrivers)
}

// getReaderJSON retorna el reader.json de un driver especifico.
func (h *NFCDriverHandler) getReaderJSON(w http.ResponseWriter, r *http.Request) {
	cardType := chi.URLParam(r, "type")
	driver, err := cards.GetInstalledDriver(r.Context(), h.Pool, cardType)
	if err != nil {
		writeError(w, 404, "driver no encontrado: "+err.Error())
		return
	}
	if driver.ReaderJSON == "" {
		writeError(w, 404, "driver no tiene reader.json")
		return
	}

	// Retornar como JSON raw
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(driver.ReaderJSON))
}
