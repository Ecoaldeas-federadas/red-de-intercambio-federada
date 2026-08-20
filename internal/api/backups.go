package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BackupsHandler maneja los endpoints de backups
type BackupsHandler struct {
	Pool       *pgxpool.Pool
	BackupsDir string
}

// NewBackupsHandler crea un nuevo handler de backups
func NewBackupsHandler(pool *pgxpool.Pool) *BackupsHandler {
	return &BackupsHandler{
		Pool:       pool,
		BackupsDir: "/backups",
	}
}

func (h *BackupsHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.Group(func(r chi.Router) {
		r.With(am.RequirePermission("config.manage")).Get("/api/admin/backups", h.listBackups)
		r.With(am.RequirePermission("config.manage")).Post("/api/admin/backups/now", h.createBackupNow)
		r.With(am.RequirePermission("config.manage")).Get("/api/admin/backups/{filename}/download", h.downloadBackup)
		r.With(am.RequirePermission("config.manage")).Delete("/api/admin/backups/{filename}", h.deleteBackup)
		r.With(am.RequirePermission("config.manage")).Put("/api/admin/backups/{filename}/lock", h.toggleLockBackup)
		r.With(am.RequirePermission("config.manage")).Get("/api/admin/backup-config", h.getBackupConfig)
		r.With(am.RequirePermission("config.manage")).Put("/api/admin/backup-config", h.updateBackupConfig)
	})
}

// backupFileInfo representa un archivo de backup
type backupFileInfo struct {
	Filename  string    `json:"filename"`
	SizeBytes int64     `json:"size_bytes"`
	IsLocked  bool      `json:"is_locked"`
	CreatedAt time.Time `json:"created_at"`
}

// listBackups lista todos los archivos de backup
func (h *BackupsHandler) listBackups(w http.ResponseWriter, r *http.Request) {
	// Asegurar que el directorio existe
	os.MkdirAll(h.BackupsDir, 0755)

	entries, err := os.ReadDir(h.BackupsDir)
	if err != nil {
		writeError(w, 500, "no se pudo leer el directorio de backups")
		return
	}

	var backups []backupFileInfo
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		// Verificar si esta locked
		lockFile := filepath.Join(h.BackupsDir, entry.Name()+".lock")
		isLocked := fileExists(lockFile)

		backups = append(backups, backupFileInfo{
			Filename:  entry.Name(),
			SizeBytes: info.Size(),
			IsLocked:  isLocked,
			CreatedAt: info.ModTime(),
		})
	}

	// Ordenar por fecha descendente
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt.After(backups[j].CreatedAt)
	})

	if backups == nil {
		backups = []backupFileInfo{}
	}
	writeJSON(w, 200, backups)
}

// createBackupNow crea un backup manual inmediato
func (h *BackupsHandler) createBackupNow(w http.ResponseWriter, r *http.Request) {
	// Escribir un archivo trigger que el servicio db-backup lee
	triggerFile := filepath.Join(h.BackupsDir, ".trigger_now")
	err := os.WriteFile(triggerFile, []byte(fmt.Sprintf("%d", time.Now().Unix())), 0644)
	if err != nil {
		writeError(w, 500, "no se pudo crear el trigger de backup")
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"message": "Backup solicitado. Se creara en los proximos segundos.",
	})
}

// downloadBackup descarga un archivo de backup
func (h *BackupsHandler) downloadBackup(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	// Validar que no tenga path traversal
	if strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		writeError(w, 400, "nombre de archivo invalido")
		return
	}
	filePath := filepath.Join(h.BackupsDir, filename)
	if !fileExists(filePath) {
		writeError(w, 404, "backup no encontrado")
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	w.Header().Set("Content-Type", "application/sql")
	http.ServeFile(w, r, filePath)
}

// deleteBackup borra un backup (solo si no esta locked)
func (h *BackupsHandler) deleteBackup(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	if strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		writeError(w, 400, "nombre de archivo invalido")
		return
	}
	filePath := filepath.Join(h.BackupsDir, filename)
	lockFile := filePath + ".lock"

	if fileExists(lockFile) {
		writeError(w, 403, "este backup esta bloqueado y no se puede borrar")
		return
	}
	if !fileExists(filePath) {
		writeError(w, 404, "backup no encontrado")
		return
	}
	if err := os.Remove(filePath); err != nil {
		writeError(w, 500, "no se pudo borrar el backup")
		return
	}
	// Borrar de la BD tambien
	h.Pool.Exec(r.Context(), "DELETE FROM backup_files WHERE filename = $1", filename)
	writeJSON(w, 200, map[string]interface{}{"message": "backup borrado"})
}

// toggleLockBackup bloquea/desbloquea un backup
func (h *BackupsHandler) toggleLockBackup(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	if strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		writeError(w, 400, "nombre de archivo invalido")
		return
	}
	filePath := filepath.Join(h.BackupsDir, filename)
	lockFile := filePath + ".lock"

	if !fileExists(filePath) {
		writeError(w, 404, "backup no encontrado")
		return
	}

	isLocked := fileExists(lockFile)
	if isLocked {
		// Desbloquear
		os.Remove(lockFile)
		h.Pool.Exec(r.Context(), "UPDATE backup_files SET is_locked = false WHERE filename = $1", filename)
		writeJSON(w, 200, map[string]interface{}{"message": "backup desbloqueado", "is_locked": false})
	} else {
		// Bloquear
		os.WriteFile(lockFile, []byte("locked"), 0644)
		h.Pool.Exec(r.Context(), "UPDATE backup_files SET is_locked = true WHERE filename = $1", filename)
		writeJSON(w, 200, map[string]interface{}{"message": "backup bloqueado", "is_locked": true})
	}
}

// backupConfigResponse representa la configuracion de backups
type backupConfigResponse struct {
	IntervalHours int  `json:"interval_hours"`
	RetentionDays int  `json:"retention_days"`
	Enabled       bool `json:"enabled"`
}

// getBackupConfig obtiene la configuracion de backups
func (h *BackupsHandler) getBackupConfig(w http.ResponseWriter, r *http.Request) {
	var cfg backupConfigResponse
	err := h.Pool.QueryRow(r.Context(),
		"SELECT interval_hours, retention_days, enabled FROM backup_config ORDER BY id LIMIT 1").
		Scan(&cfg.IntervalHours, &cfg.RetentionDays, &cfg.Enabled)
	if err != nil {
		// Si no existe, devolver defaults
		writeJSON(w, 200, backupConfigResponse{IntervalHours: 24, RetentionDays: 7, Enabled: true})
		return
	}
	writeJSON(w, 200, cfg)
}

// updateBackupConfig actualiza la configuracion de backups
func (h *BackupsHandler) updateBackupConfig(w http.ResponseWriter, r *http.Request) {
	var req backupConfigResponse
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "JSON invalido")
		return
	}
	if req.IntervalHours < 1 {
		req.IntervalHours = 1
	}
	if req.RetentionDays < 1 {
		req.RetentionDays = 1
	}

	_, err := h.Pool.Exec(r.Context(),
		"UPDATE backup_config SET interval_hours = $1, retention_days = $2, enabled = $3, updated_at = NOW()",
		req.IntervalHours, req.RetentionDays, req.Enabled)
	if err != nil {
		writeError(w, 500, "no se pudo actualizar la configuracion")
		return
	}

	// Escribir archivo de configuracion para que el servicio db-backup lo lea
	h.writeBackupConfigFile(req)

	writeJSON(w, 200, map[string]interface{}{
		"message":        "configuracion actualizada",
		"interval_hours": req.IntervalHours,
		"retention_days": req.RetentionDays,
		"enabled":        req.Enabled,
	})
}

// writeBackupConfigFile escribe la configuracion a un archivo JSON
// que el servicio db-backup lee para saber que hacer
func (h *BackupsHandler) writeBackupConfigFile(cfg backupConfigResponse) {
	configFile := filepath.Join(h.BackupsDir, "config.json")
	data, _ := json.Marshal(cfg)
	os.WriteFile(configFile, data, 0644)
}

// fileExists verifica si un archivo existe
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// ReadBackupConfig lee la configuracion de backup desde el archivo
// (usado por el servicio db-backup via volumen compartido)
func ReadBackupConfig(dir string) backupConfigResponse {
	cfg := backupConfigResponse{IntervalHours: 24, RetentionDays: 7, Enabled: true}
	configFile := filepath.Join(dir, "config.json")
	if fileExists(configFile) {
		data, err := os.ReadFile(configFile)
		if err == nil {
			json.Unmarshal(data, &cfg)
		}
	}
	return cfg
}

// ensure io import is used
var _ = io.EOF
