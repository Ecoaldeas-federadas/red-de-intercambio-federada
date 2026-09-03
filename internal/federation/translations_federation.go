// Package federation — translations_federation.go
//
// Endpoints federation para sharing de archivos de traduccion.
// Permite que los nodos federados anuncien que tienen traducciones disponibles.
// NO instala automaticamente: solo anuncia disponibilidad.
// El administrador debe descargar e instalar manualmente.
//
// Endpoints:
//   GET  /federation/translations/list           — lista traducciones disponibles para peers
//   GET  /federation/translations/download/{lang} — descarga archivo de traduccion
//   POST /federation/translations/sync           — recibe lista de traducciones de un peer

package federation

import (
	"encoding/json"
	"io"
	"net/http"
)

// TranslationSyncPayload es el payload que se envia/recibe via gossip.
type TranslationSyncPayload struct {
	FromNode    string                  `json:"from_node"`
	Translations []TranslationSyncEntry `json:"translations"`
}

// TranslationSyncEntry es una traduccion individual en el payload de sync.
type TranslationSyncEntry struct {
	LanguageCode  string `json:"language_code"`
	DisplayName   string `json:"display_name"`
	Version       string `json:"version"`
	FileHash      string `json:"file_hash"`
	SignedBy      string `json:"signed_by"`
	Signature     string `json:"signature"`
	NumKeys       int    `json:"num_keys"`
	LastUpdated   string `json:"last_updated"`
}

// handleTranslationsList responde con la lista de traducciones compartidas.
func (s *Server) handleTranslationsList(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Pool.Query(r.Context(),
		`SELECT l.code, l.native_name, l.version, l.file_hash, l.signed_by, l.signature,
		        (SELECT COUNT(*) FROM translations t WHERE t.language_code = l.code AND t.is_published = true),
		        COALESCE(l.updated_at::text, '')
		 FROM languages l
		 WHERE l.enabled = true AND l.shared_with_federation = true`)
	if err != nil {
		http.Error(w, "error consultando traducciones", 500)
		return
	}
	defer rows.Close()

	var translations []TranslationSyncEntry
	for rows.Next() {
		var t TranslationSyncEntry
		if err := rows.Scan(&t.LanguageCode, &t.DisplayName, &t.Version, &t.FileHash,
			&t.SignedBy, &t.Signature, &t.NumKeys, &t.LastUpdated); err != nil {
			continue
		}
		translations = append(translations, t)
	}
	if translations == nil {
		translations = []TranslationSyncEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(translations)
}

// handleTranslationsDownload permite a un peer descargar el archivo de traduccion.
func (s *Server) handleTranslationsDownload(w http.ResponseWriter, r *http.Request) {
	// Extraer lang del path: /federation/translations/download/{lang}
	langCode := r.URL.Path[len("/federation/translations/download/"):]
	if langCode == "" {
		http.Error(w, "language_code requerido", 400)
		return
	}

	// Construir el JSON de traduccion desde la BD
	rows, err := s.Pool.Query(r.Context(),
		`SELECT namespace, key, value
		 FROM translations
		 WHERE language_code = $1 AND is_published = true
		 ORDER BY namespace, key`, langCode)
	if err != nil {
		http.Error(w, "error consultando traducciones", 500)
		return
	}
	defer rows.Close()

	// Agrupar por namespace
	result := map[string]map[string]string{}
	for rows.Next() {
		var ns, key, value string
		if err := rows.Scan(&ns, &key, &value); err != nil {
			continue
		}
		if result[ns] == nil {
			result[ns] = map[string]string{}
		}
		result[ns][key] = value
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename="+langCode+".json")
	json.NewEncoder(w).Encode(result)
}

// handleTranslationsSync recibe la lista de traducciones de un peer y la guarda
// como notificacion para que el admin decida si descargarla.
func (s *Server) handleTranslationsSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "metodo no permitido", 405)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "error leyendo body", 400)
		return
	}
	defer r.Body.Close()

	var payload TranslationSyncPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "JSON invalido", 400)
		return
	}

	// Guardar cada traduccion como notificacion para el admin
	for _, tr := range payload.Translations {
		// Verificar si ya tenemos esta traduccion registrada
		var existingVersion string
		err := s.Pool.QueryRow(r.Context(),
			`SELECT version FROM federated_translations
			 WHERE source_node = $1 AND language_code = $2`,
			payload.FromNode, tr.LanguageCode).Scan(&existingVersion)

		if err == nil && existingVersion == tr.Version {
			// Ya tenemos esta version, no notificar de nuevo
			continue
		}

		// Insertar/actualizar en federated_translations
		_, err = s.Pool.Exec(r.Context(),
			`INSERT INTO federated_translations
			 (source_node, language_code, display_name, version, file_hash, signed_by, signature, num_keys, received_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
			 ON CONFLICT (source_node, language_code) DO UPDATE SET
			   display_name = EXCLUDED.display_name,
			   version = EXCLUDED.version,
			   file_hash = EXCLUDED.file_hash,
			   signed_by = EXCLUDED.signed_by,
			   signature = EXCLUDED.signature,
			   num_keys = EXCLUDED.num_keys,
			   received_at = NOW()`,
			payload.FromNode, tr.LanguageCode, tr.DisplayName, tr.Version,
			tr.FileHash, tr.SignedBy, tr.Signature, tr.NumKeys)
		if err != nil {
			continue
		}

		// Crear notificacion para el admin
		notifMsg := "Nueva traduccion disponible: " + tr.DisplayName + " v" + tr.Version + " de " + payload.FromNode
		_, _ = s.Pool.Exec(r.Context(),
			`INSERT INTO notifications (node_domain, user_id, notification_type, title, message, link)
			 SELECT $1, u.id, 'federation_translation', 'Traduccion disponible', $2, '/app/translations'
			 FROM users u
			 WHERE u.node_domain = $1 AND u.is_super_admin = true`,
			s.NodeDomain, notifMsg)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
