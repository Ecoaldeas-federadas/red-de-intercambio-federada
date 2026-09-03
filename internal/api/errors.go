package api

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse es la estructura estandar de error del API.
// Si ErrorCode esta presente, el frontend lo usa para traducir.
// Si no, el frontend muestra Message directamente.
type ErrorResponse struct {
	ErrorCode string `json:"error_code,omitempty"`
	Message   string `json:"message"`
}

// writeErrorCode escribe un error con codigo para que el frontend lo traduzca.
// Ej: writeErrorCode(w, 400, "error.invalid_password")
func writeErrorCode(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		ErrorCode: code,
		Message:   defaultErrorMessages[code],
	})
}

// writeErrorCodeWithMsg escribe un error con codigo Y mensaje personalizado.
// Util cuando el mensaje incluye variables (ej: "campo X es obligatorio").
func writeErrorCodeWithMsg(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		ErrorCode: code,
		Message:   msg,
	})
}

// defaultErrorMessages contiene los mensajes por defecto (espanol) para cada codigo.
// El frontend puede traducir estos usando el namespace 'errors'.
var defaultErrorMessages = map[string]string{
	// Auth
	"error.auth_required":            "Autenticacion requerida",
	"error.invalid_credentials":      "Usuario o contrasena incorrectos",
	"error.account_locked":           "Cuenta bloqueada",
	"error.account_disabled":         "Cuenta deshabilitada",
	"error.session_expired":          "Sesion expirada",
	"error.passkey_not_found":        "Passkey no encontrado",
	"error.passkey_invalid":          "Passkey invalido",
	"error.username_taken":           "El nombre de usuario ya esta en uso",
	"error.username_too_short":       "El nombre de usuario debe tener al menos 3 caracteres",
	"error.password_too_short":       "La contrasena debe tener al menos 8 caracteres",
	"error.password_mismatch":        "Las contrasenas no coinciden",

	// Permisos
	"error.permission_denied":        "No tienes permiso para realizar esta accion",
	"error.permission_required":      "Se requiere permiso especial",

	// Validacion
	"error.invalid_request":          "Peticion invalida",
	"error.invalid_input":            "Entrada invalida",
	"error.missing_field":            "Campo obligatorio faltante",
	"error.invalid_format":           "Formato invalido",
	"error.value_too_large":          "Valor demasiado grande",
	"error.value_too_small":          "Valor demasiado pequeno",

	// Recursos
	"error.not_found":                "No encontrado",
	"error.already_exists":           "Ya existe",
	"error.conflict":                 "Conflicto",

	// Operaciones
	"error.insufficient_balance":     "Saldo insuficiente",
	"error.over_limit":               "Estas sobre el limite de credito",
	"error.transfer_failed":          "Error en la transferencia",
	"error.payment_failed":           "Error en el pago",
	"error.card_deactivated":         "Tarjeta desactivada",
	"error.card_not_found":           "Tarjeta no encontrada",

	// Sistema
	"error.server_error":             "Error del servidor",
	"error.database_error":           "Error de base de datos",
	"error.network_error":            "Error de red",
	"error.rate_limited":             "Demasiadas peticiones",
	"error.maintenance":              "Sistema en mantenimiento",

	// Traducciones
	"error.translation.lang_required":     "Idioma requerido",
	"error.translation.namespace_required": "Namespace requerido",
	"error.translation.invalid_json":      "JSON invalido",
	"error.translation.cannot_delete_default": "No se puede eliminar el idioma por defecto",
}
