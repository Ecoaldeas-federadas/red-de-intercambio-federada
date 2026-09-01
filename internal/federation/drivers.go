// Package federation — drivers.go
//
// Endpoints federation para sharing de drivers NFC (.nfcpkg).
// Permite que los nodos federados compartan drivers entre si.
//
// Endpoints:
//   GET  /federation/drivers/list          — lista drivers instalados para peers
//   GET  /federation/drivers/download/{type} — descarga .nfcpkg completo
//   POST /federation/drivers/sync          — recibe lista de drivers de un peer

package federation

import (
	"context"
	"encoding/json"
	"federated-credit-node/internal/payments/cards"
	"io"
	"net/http"
)

// DriverSyncPayload es el payload que se envia/recibe via gossip.
type DriverSyncPayload struct {
	FromNode string            `json:"from_node"`
	Drivers  []DriverSyncEntry `json:"drivers"`
}

// DriverSyncEntry es un driver individual en el payload de sync.
type DriverSyncEntry struct {
	Type        string `json:"type"`
	Version     string `json:"version"`
	DisplayName string `json:"display_name"`
	PackageHash string `json:"package_hash"`
	SignedBy    string `json:"signed_by"`
	Signature   string `json:"signature"`
}

// handleDriversList responde con la lista de drivers activos compartidos.
func (s *Server) handleDriversList(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Pool.Query(r.Context(),
		`SELECT type, version, display_name, package_hash, signed_by, signature
		 FROM nfc_card_drivers
		 WHERE is_active = true AND shared_with_federation = true`)
	if err != nil {
		http.Error(w, "error consultando drivers", 500)
		return
	}
	defer rows.Close()

	var drivers []DriverSyncEntry
	for rows.Next() {
		var d DriverSyncEntry
		if err := rows.Scan(&d.Type, &d.Version, &d.DisplayName, &d.PackageHash, &d.SignedBy, &d.Signature); err != nil {
			continue
		}
		drivers = append(drivers, d)
	}
	if drivers == nil {
		drivers = []DriverSyncEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drivers)
}

// handleDriversDownload permite a un peer descargar el .nfcpkg completo.
func (s *Server) handleDriversDownload(w http.ResponseWriter, r *http.Request) {
	// Extraer type del path: /federation/drivers/download/{type}
	cardType := r.URL.Path[len("/federation/drivers/download/"):]
	if cardType == "" {
		http.Error(w, "type requerido", 400)
		return
	}

	// Reconstruir el paquete desde la DB
	var manifestJSON, driverJS, readerJSON, migrationSQL string
	var displayName, version, signature string
	err := s.Pool.QueryRow(r.Context(),
		`SELECT manifest::text, driver_js, reader_json, COALESCE(migration_sql, ''),
		        display_name, version, signature
		 FROM nfc_card_drivers
		 WHERE type = $1 AND is_active = true AND shared_with_federation = true`,
		cardType).Scan(&manifestJSON, &driverJS, &readerJSON, &migrationSQL, &displayName, &version, &signature)
	if err != nil {
		http.Error(w, "driver no encontrado o no compartido", 404)
		return
	}

	// Reconstruir el ZIP
	pkgData, err := buildPackageForFederation(manifestJSON, driverJS, readerJSON, migrationSQL, signature)
	if err != nil {
		http.Error(w, "error reconstruyendo paquete: "+err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename="+cardType+"-"+version+".nfcpkg")
	w.Write(pkgData)
}

// handleDriversSync recibe la lista de drivers de un peer y la guarda en cache.
func (s *Server) handleDriversSync(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "error leyendo body", 400)
		return
	}
	defer r.Body.Close()

	var payload DriverSyncPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "error parseando payload: "+err.Error(), 400)
		return
	}

	if payload.FromNode == "" || payload.FromNode == s.NodeDomain {
		// Ignorar sync de nosotros mismos
		w.WriteHeader(200)
		return
	}

	// Guardar cada driver en la cache (si no lo tenemos instalado)
	saved := 0
	for _, d := range payload.Drivers {
		// Verificar si ya lo tenemos instalado
		var installed bool
		err := s.Pool.QueryRow(r.Context(),
			"SELECT EXISTS(SELECT 1 FROM nfc_card_drivers WHERE type = $1 AND version = $2)",
			d.Type, d.Version).Scan(&installed)
		if err != nil || installed {
			continue
		}

		// Verificar si ya esta en cache
		var cached bool
		err = s.Pool.QueryRow(r.Context(),
			"SELECT EXISTS(SELECT 1 FROM nfc_driver_packages_cache WHERE type = $1 AND version = $2)",
			d.Type, d.Version).Scan(&cached)
		if err != nil || cached {
			continue
		}

		// Guardar metadata en cache (sin el paquete completo — se descarga despues)
		_, err = s.Pool.Exec(r.Context(),
			`INSERT INTO nfc_driver_packages_cache
				(type, version, display_name, shared_by, signed_by, package_hash, signature, package_data)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 ON CONFLICT (type, version) DO NOTHING`,
			d.Type, d.Version, d.DisplayName, payload.FromNode, d.SignedBy,
			d.PackageHash, d.Signature, []byte{})
		if err == nil {
			saved++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"saved": saved})
}

// syncDrivers envia la lista de drivers compartidos a todos los peers activos.
// Se llama desde el tick de gossip.
func (g *Gossip) syncDrivers(ctx context.Context) {
	// Obtener drivers compartidos
	rows, err := g.Pool.Query(ctx,
		`SELECT type, version, display_name, package_hash, signed_by, signature
		 FROM nfc_card_drivers
		 WHERE is_active = true AND shared_with_federation = true`)
	if err != nil {
		return
	}
	defer rows.Close()

	var drivers []DriverSyncEntry
	for rows.Next() {
		var d DriverSyncEntry
		if err := rows.Scan(&d.Type, &d.Version, &d.DisplayName, &d.PackageHash, &d.SignedBy, &d.Signature); err != nil {
			continue
		}
		drivers = append(drivers, d)
	}

	if len(drivers) == 0 {
		return
	}

	// Enviar a cada peer activo
	if g.Client != nil {
		payload, _ := json.Marshal(DriverSyncPayload{
			FromNode: g.NodeDomain,
			Drivers:  drivers,
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
			_ = g.postToPeer(ctx, peerDomain, "/federation/drivers/sync", payload)
		}
	}
}

// buildPackageForFederation reconstruye un .nfcpkg desde los componentes en la DB.
func buildPackageForFederation(manifestJSON, driverJS, readerJSON, migrationSQL, signature string) ([]byte, error) {
	return cards.BuildPackageWithSignature(manifestJSON, driverJS, readerJSON, migrationSQL, "", "", signature)
}
