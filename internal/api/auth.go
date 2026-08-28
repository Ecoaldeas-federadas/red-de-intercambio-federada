package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"federated-credit-node/internal/crypto"
	"federated-credit-node/internal/db"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// base64UrlDecode decodifica un string base64url a bytes
func base64UrlDecode(s string) ([]byte, error) {
	b64 := strings.ReplaceAll(s, "-", "+")
	b64 = strings.ReplaceAll(b64, "_", "/")
	padLen := (4 - len(b64)%4) % 4
	b64 += strings.Repeat("=", padLen)
	return base64.StdEncoding.DecodeString(b64)
}

// deriveRPID extrae el RP ID (dominio sin puerto) del request.
// WebAuthn requiere que el RP ID coincida con el dominio desde el que
// se accede. Por ejemplo:
//   - http://localhost:8080  -> RP ID: localhost
//   - https://feria.loanstly.com -> RP ID: feria.loanstly.com
func deriveRPID(r *http.Request) string {
	// Priorizar el header Origin (mas confiable)
	origin := r.Header.Get("Origin")
	if origin != "" {
		origin = strings.TrimPrefix(origin, "https://")
		origin = strings.TrimPrefix(origin, "http://")
		// Quitar el puerto si lo tiene
		if idx := strings.LastIndex(origin, ":"); idx > 0 {
			origin = origin[:idx]
		}
		if origin != "" {
			return origin
		}
	}
	// Fallback: usar el header Host
	host := r.Host
	if host == "" {
		host = r.Header.Get("Host")
	}
	if host != "" {
		if idx := strings.LastIndex(host, ":"); idx > 0 {
			host = host[:idx]
		}
		return host
	}
	return "localhost"
}

// parseUsernameDomain separa un username en formato "usuario@dominio"
// en username y node_domain. Si no tiene @, devuelve el username tal cual
// y nodeDomain vacio.
func parseUsernameDomain(fullUsername string) (username, nodeDomain string) {
	parts := strings.SplitN(fullUsername, "@", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return fullUsername, ""
}

// resolveNodeDomain determina el node_domain efectivo para un login.
// Orden de prioridad:
// resolveNodeDomain determina el node_domain efectivo para un login.
// Para usuarios del nodo local, devuelve LOCAL_NODE_DOMAIN ("__LOCAL__")
// que es como se guardan en la base de datos.
// Para usuarios de otros nodos (federacion), devuelve el dominio remoto.
//
// Orden de resolucion:
// 1. Dominio extraido del username (formato usuario@dominio)
// 2. Header X-Node-Domain (enviado por el frontend)
// 3. Si es el nodo local, usar LOCAL_NODE_DOMAIN
// 4. ah.NodeDomain (del config.yaml, puede estar vacio)
func (ah *AuthHandlers) resolveNodeDomain(r *http.Request, usernameWithDomain string) string {
	// 1. Si el username trae @dominio, usar ese
	if _, domain := parseUsernameDomain(usernameWithDomain); domain != "" {
		// Verificar si es nuestro dominio
		actual := db.ActualNodeDomain(r.Context(), ah.Pool, ah.NodeDomain)
		if domain == actual || (domain == "localhost" && (actual == "" || actual == "localhost")) {
			return db.LOCAL_NODE_DOMAIN
		}
		return domain
	}
	// 2. Header X-Node-Domain - usar ResolveNodeDomain que maneja local vs remoto
	headerDomain := r.Header.Get("X-Node-Domain")
	return db.ResolveNodeDomain(r.Context(), ah.Pool, headerDomain, ah.NodeDomain)
}
func deriveOrigin(r *http.Request) string {
	origin := r.Header.Get("Origin")
	if origin != "" {
		return origin
	}
	// Construir desde el Host
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	if host == "" {
		host = "localhost:8080"
	}
	return fmt.Sprintf("%s://%s", scheme, host)
}

type AuthMiddleware struct {
	JWTSecret []byte
	Pool      *pgxpool.Pool
}

func NewAuthMiddleware(secret string) *AuthMiddleware {
	return &AuthMiddleware{JWTSecret: []byte(secret)}
}

func NewAuthMiddlewareWithPool(secret string, pool *pgxpool.Pool) *AuthMiddleware {
	return &AuthMiddleware{JWTSecret: []byte(secret), Pool: pool}
}

type Claims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Node     string `json:"node"`
	IsDemo   bool   `json:"is_demo"`
	jwt.RegisteredClaims
}

func (am *AuthMiddleware) GenerateToken(userID uuid.UUID, username, node string) (string, error) {
	claims := &Claims{
		UserID:   userID.String(),
		Username: username,
		Node:     node,
		IsDemo:   false,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(am.JWTSecret)
}

func (am *AuthMiddleware) GenerateDemoToken(userID uuid.UUID, username, node string) (string, error) {
	claims := &Claims{
		UserID:   userID.String(),
		Username: username,
		Node:     node,
		IsDemo:   true,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(am.JWTSecret)
}

func (am *AuthMiddleware) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return am.JWTSecret, nil
	})
	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("invalid token")
}

func (am *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeError(w, 401, "authorization header required")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			writeError(w, 401, "invalid authorization header format")
			return
		}

		claims, err := am.ValidateToken(parts[1])
		if err != nil {
			writeError(w, 401, "invalid or expired token")
			return
		}

		ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
		ctx = context.WithValue(ctx, "username", claims.Username)
		ctx = context.WithValue(ctx, "node", claims.Node)
		ctx = context.WithValue(ctx, "is_demo", claims.IsDemo)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// IsDemoUser verifica si el request actual es de un usuario demo
func (am *AuthMiddleware) IsDemoUser(r *http.Request) bool {
	isDemo, ok := r.Context().Value("is_demo").(bool)
	return ok && isDemo
}

// BlockDemo bloquea todas las operaciones de escritura para usuarios demo
func (am *AuthMiddleware) BlockDemo(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if am.IsDemoUser(r) {
			if r.Method != "GET" && r.Method != "HEAD" && r.Method != "OPTIONS" {
				writeError(w, 403, "Usuario demo: no tienes permiso para modificar datos. Puedes navegar pero no guardar cambios.")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (am *AuthMiddleware) GetUserID(r *http.Request) (uuid.UUID, error) {
	userIDStr, ok := r.Context().Value("user_id").(string)
	if !ok {
		return uuid.Nil, fmt.Errorf("no user_id in context")
	}
	return uuid.Parse(userIDStr)
}

func (am *AuthMiddleware) RequirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if am.Pool == nil {
				next.ServeHTTP(w, r)
				return
			}

			// Asegurar que el token JWT este presente y valido (autocontenido:
			// no depende de que RequireAuth se haya aplicado antes).
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeError(w, 401, "authentication required")
				return
			}
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				writeError(w, 401, "invalid authorization header format")
				return
			}
			claims, err := am.ValidateToken(parts[1])
			if err != nil {
				writeError(w, 401, "invalid or expired token")
				return
			}
			ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
			ctx = context.WithValue(ctx, "username", claims.Username)
			ctx = context.WithValue(ctx, "node", claims.Node)
			r = r.WithContext(ctx)

			userID, err := am.GetUserID(r)
			if err != nil {
				writeError(w, 401, "authentication required")
				return
			}

			// Super admin tiene acceso a todo
			var isSuperAdmin, superAdminEnabled bool
			_ = am.Pool.QueryRow(r.Context(), `
				SELECT is_super_admin, super_admin_enabled FROM users WHERE id = $1`,
				userID).Scan(&isSuperAdmin, &superAdminEnabled)
			if isSuperAdmin && superAdminEnabled {
				next.ServeHTTP(w, r)
				return
			}

			var has bool
			err = am.Pool.QueryRow(r.Context(), `
				SELECT EXISTS(
					SELECT 1 FROM user_permissions up
					JOIN permissions p ON p.id = up.permission_id
					WHERE up.user_id = $1 AND p.name = $2
					AND (up.expires_at IS NULL OR up.expires_at > NOW())
				)`,
				userID, permission,
			).Scan(&has)
			if err == nil && has {
				next.ServeHTTP(w, r)
				return
			}

			err = am.Pool.QueryRow(r.Context(), `
				SELECT EXISTS(
					SELECT 1 FROM department_members dm
					JOIN role_permissions rp ON rp.role_id = dm.role_id
					JOIN permissions p ON p.id = rp.permission_id
					WHERE dm.user_id = $1 AND p.name = $2
				)`,
				userID, permission,
			).Scan(&has)
			if err != nil {
				writeError(w, 500, "error checking permissions")
				return
			}

			if !has {
				writeError(w, 403, fmt.Sprintf("permission denied: %s required", permission))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

type AuthHandlers struct {
	PasskeyManager PasskeyService
	KeyManager     KeyService
	Accounts       AccountsService
	ChallengeStore *ChallengeStoreService
	JWTSecret      string
	NodeDomain     string
	RPName         string
	Pool           *pgxpool.Pool
}

type PasskeyService interface {
	BeginRegistration(userID uuid.UUID, username, displayName string, existingCreds [][]byte, rpID, rpName string) (interface{}, error)
	VerifyRegistration(response interface{}, expectedChallenge, expectedOrigin string) (interface{}, error)
	BeginLogin(credentialIDs [][]byte, rpID string) (interface{}, error)
	VerifyLogin(response interface{}, expectedChallenge string, storedPubKey []byte, storedSignCount int64) (int64, error)
}

type KeyService interface {
	GenerateEd25519KeyPair() (interface{}, interface{}, error)
	EncryptPrivateKey(privKey interface{}, passphrase string) ([]byte, []byte, error)
	PublicKeyToHex(pubKey interface{}) string
}

type AccountsService interface {
	GetUser(ctx context.Context, id uuid.UUID) (interface{}, error)
	FindUserByUsername(ctx context.Context, nodeDomain, username string) (interface{}, error)
	CreateUser(ctx context.Context, params interface{}) (interface{}, error)
}

type ChallengeStoreService struct {
	store map[string]challengeEntry
}

type challengeEntry struct {
	Challenge string
	UserID    uuid.UUID
	Expires   time.Time
}

func NewChallengeStoreService() *ChallengeStoreService {
	return &ChallengeStoreService{store: make(map[string]challengeEntry)}
}

func (cs *ChallengeStoreService) Store(key, challenge string, userID uuid.UUID) {
	cs.store[key] = challengeEntry{
		Challenge: challenge,
		UserID:    userID,
		Expires:   time.Now().Add(5 * time.Minute),
	}
}

func (cs *ChallengeStoreService) Get(key string) (string, uuid.UUID, bool) {
	entry, ok := cs.store[key]
	if !ok || time.Now().After(entry.Expires) {
		delete(cs.store, key)
		return "", uuid.Nil, false
	}
	return entry.Challenge, entry.UserID, true
}

func (cs *ChallengeStoreService) Delete(key string) {
	delete(cs.store, key)
}

func (ah *AuthHandlers) RegisterRoutes(r chi.Router) {
	am := NewAuthMiddleware(ah.JWTSecret)

	// Rutas publicas (sin autenticacion)
	r.Post("/api/auth/register", ah.beginRegistration)
	r.Post("/api/auth/passkey/finish", ah.finishRegistration)
	r.Post("/api/auth/login/begin", ah.beginLogin)
	r.Post("/api/auth/login/finish", ah.finishLogin)
	r.Post("/api/auth/login/password", ah.passwordLogin)

	// Rutas autenticadas (requieren token JWT valido)
	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.Get("/api/auth/me", ah.getMe)
		r.Put("/api/auth/me/contacts", ah.updateMyContacts)
		r.Get("/api/me/preferences", ah.getMyPreferences)
		r.Put("/api/me/preferences", ah.updateMyPreferences)
		r.Get("/api/auth/passkey/list", ah.listPasskeys)
		r.Post("/api/auth/passkey/add/begin", ah.beginAddPasskey)
		r.Post("/api/auth/passkey/add/finish", ah.finishAddPasskey)
		r.Delete("/api/auth/passkey/{id}", ah.deletePasskey)
	})
}

type BeginRegistrationRequest struct {
	Username          string `json:"username"`
	DisplayName       string `json:"display_name"`
	NationalID        string `json:"national_id"`
	NationalIDType    string `json:"national_id_type"`
	NationalIDCountry string `json:"national_id_country"`
}

func (ah *AuthHandlers) beginRegistration(w http.ResponseWriter, r *http.Request) {
	var req BeginRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Username == "" {
		writeError(w, 400, "username is required")
		return
	}

	rpID := deriveRPID(r)
	rpName := ah.RPName
	if rpName == "" {
		rpName = rpID
	}

	userID := uuid.New()
	options, err := ah.PasskeyManager.BeginRegistration(userID, req.Username, req.DisplayName, nil, rpID, rpName)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Extraer el challenge
	var challengeStr string
	switch opts := options.(type) {
	case *crypto.RegistrationChallenge:
		challengeStr = opts.Challenge
	case map[string]interface{}:
		challengeStr, _ = opts["challenge"].(string)
	}

	ah.ChallengeStore.Store(userID.String(), challengeStr, userID)

	writeJSON(w, 200, map[string]interface{}{
		"options":  options,
		"user_id":  userID.String(),
		"username": req.Username,
	})
}

type FinishRegistrationRequest struct {
	UserID            string      `json:"user_id"`
	Username          string      `json:"username"`
	DisplayName       string      `json:"display_name"`
	Response          interface{} `json:"response"`
	NationalID        string      `json:"national_id"`
	NationalIDType    string      `json:"national_id_type"`
	NationalIDCountry string      `json:"national_id_country"`
}

func (ah *AuthHandlers) finishRegistration(w http.ResponseWriter, r *http.Request) {
	var req FinishRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		writeError(w, 400, "invalid user_id")
		return
	}

	challenge, storedUserID, ok := ah.ChallengeStore.Get(userID.String())
	if !ok || storedUserID != userID {
		writeError(w, 400, "no pending registration challenge")
		return
	}

	origin := deriveOrigin(r)

	passkey, err := ah.PasskeyManager.VerifyRegistration(req.Response, challenge, origin)
	if err != nil {
		writeError(w, 400, fmt.Sprintf("registration verification failed: %v", err))
		return
	}

	ah.ChallengeStore.Delete(userID.String())

	writeJSON(w, 201, map[string]interface{}{
		"user_id":    userID.String(),
		"username":   req.Username,
		"passkey_id": passkey,
		"message":    "Passkey registered successfully. User account pending admission approval.",
	})
}

type BeginLoginRequest struct {
	Username string `json:"username"`
}

func (ah *AuthHandlers) beginLogin(w http.ResponseWriter, r *http.Request) {
	var req BeginLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Username == "" {
		writeError(w, 400, "username is required")
		return
	}

	// Separar username@domain y resolver el dominio efectivo
	// El username se convierte a minusculas para ser case-insensitive
	// (los moviles suelen poner la primera letra en mayuscula automaticamente)
	username, _ := parseUsernameDomain(req.Username)
	username = strings.ToLower(username)
	nodeDomain := ah.resolveNodeDomain(r, req.Username)

	// Buscar el usuario por username y node_domain
	var userID uuid.UUID
	var userDisplayName string
	err := ah.Pool.QueryRow(r.Context(), `
		SELECT id, COALESCE(display_name, username) FROM users
		WHERE username = $1 AND node_domain = $2 AND membership_status = 'active'`,
		username, nodeDomain).Scan(&userID, &userDisplayName)
	if err != nil {
		writeError(w, 404, "usuario no encontrado")
		return
	}

	// Obtener los credential IDs de los passkeys del usuario
	var credentialIDs [][]byte
	rows, err := ah.Pool.Query(r.Context(), `
		SELECT credential_id FROM user_passkeys WHERE user_id = $1`, userID)
	if err != nil {
		writeError(w, 500, "error querying passkeys")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var credID []byte
		rows.Scan(&credID)
		credentialIDs = append(credentialIDs, credID)
	}

	if len(credentialIDs) == 0 {
		writeError(w, 400, "no tienes passkeys registrados. Usa contrasena para iniciar sesion y registra un dispositivo en tu perfil.")
		return
	}

	rpID := deriveRPID(r)

	options, err := ah.PasskeyManager.BeginLogin(credentialIDs, rpID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Extraer el challenge del *LoginChallenge
	var challengeStr string
	switch opts := options.(type) {
	case *crypto.LoginChallenge:
		challengeStr = opts.Challenge
	case map[string]interface{}:
		challengeStr, _ = opts["challenge"].(string)
	default:
		writeError(w, 500, "unexpected options type from passkey manager")
		return
	}

	sessionKey := uuid.New().String()
	ah.ChallengeStore.Store(sessionKey, challengeStr, userID)

	writeJSON(w, 200, map[string]interface{}{
		"options":     options,
		"session_key": sessionKey,
		"username":    req.Username,
	})
}

type FinishLoginRequest struct {
	SessionKey string      `json:"session_key"`
	Username   string      `json:"username"`
	Response   interface{} `json:"response"`
}

func (ah *AuthHandlers) finishLogin(w http.ResponseWriter, r *http.Request) {
	var req FinishLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	challenge, userID, ok := ah.ChallengeStore.Get(req.SessionKey)
	if !ok {
		writeError(w, 400, "no pending login challenge")
		return
	}

	ah.ChallengeStore.Delete(req.SessionKey)

	if ah.Pool == nil {
		writeError(w, 500, "database not available")
		return
	}

	// Obtener el passkey del usuario para verificar la firma
	// El credential ID viene en la respuesta del navegador
	var storedPubKey []byte
	var storedSignCount int64
	var passkeyID uuid.UUID

	// Extraer el credential ID de la respuesta para buscar el passkey correcto
	credIDStr := ""
	if respMap, ok := req.Response.(map[string]interface{}); ok {
		if id, ok := respMap["id"].(string); ok {
			credIDStr = id
		}
	}

	if credIDStr != "" {
		// Decodificar el credential ID de base64url
		credIDBytes, err := base64UrlDecode(credIDStr)
		if err == nil {
			err = ah.Pool.QueryRow(r.Context(), `
				SELECT id, public_key, sign_count FROM user_passkeys
				WHERE user_id = $1 AND credential_id = $2`,
				userID, credIDBytes).Scan(&passkeyID, &storedPubKey, &storedSignCount)
			if err != nil {
				writeError(w, 401, "passkey no encontrado")
				return
			}
		}
	}

	if storedPubKey == nil {
		// Fallback: usar el primer passkey del usuario
		err := ah.Pool.QueryRow(r.Context(), `
			SELECT id, public_key, sign_count FROM user_passkeys
			WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
			userID).Scan(&passkeyID, &storedPubKey, &storedSignCount)
		if err != nil {
			writeError(w, 401, "no tienes passkeys registrados")
			return
		}
	}

	// Verificar la firma del login
	newSignCount, err := ah.PasskeyManager.VerifyLogin(req.Response, challenge, storedPubKey, storedSignCount)
	if err != nil {
		writeError(w, 401, fmt.Sprintf("verificacion fallida: %v", err))
		return
	}

	// Actualizar el sign count y last_used_at
	_, _ = ah.Pool.Exec(r.Context(), `
		UPDATE user_passkeys SET sign_count = $1, last_used_at = NOW() WHERE id = $2`,
		newSignCount, passkeyID)

	// Obtener el username real del usuario
	var username, storedDomain string
	_ = ah.Pool.QueryRow(r.Context(), `SELECT username, node_domain FROM users WHERE id = $1`, userID).Scan(&username, &storedDomain)
	// El token JWT usa el dominio real del nodo (para federacion),
	// no LOCAL_NODE_DOMAIN que es solo para datos internos
	jwtDomain := db.ActualNodeDomain(r.Context(), ah.Pool, ah.NodeDomain)
	if jwtDomain == "" {
		jwtDomain = ah.NodeDomain
	}

	am := NewAuthMiddleware(ah.JWTSecret)
	token, err := am.GenerateToken(userID, username, jwtDomain)
	if err != nil {
		writeError(w, 500, "failed to generate token")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"token":    token,
		"username": username,
		"node":     jwtDomain,
	})
}

func (ah *AuthHandlers) getMe(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	user, err := ah.Accounts.GetUser(r.Context(), userID)
	if err != nil {
		writeError(w, 404, "user not found")
		return
	}

	// Resolver el dominio del nodo del usuario para el fallback de nodo
	var userNodeDomain string
	_ = ah.Pool.QueryRow(r.Context(), `SELECT node_domain FROM users WHERE id = $1`, userID).Scan(&userNodeDomain)
	if userNodeDomain == "" {
		userNodeDomain = ah.NodeDomain
	}
	fs := resolveFormatSettings(r.Context(), ah.Pool, userID.String(), userNodeDomain)

	// Incluir format_settings en la respuesta preservando el objeto del usuario.
	// Como GetUser devuelve interface{}, lo serializamos a un mapa para anadir el campo.
	userBytes, _ := json.Marshal(user)
	var resp map[string]interface{}
	if err := json.Unmarshal(userBytes, &resp); err != nil {
		// Si no es un objeto JSON, devolver el usuario tal cual con format_settings aparte
		writeJSON(w, 200, map[string]interface{}{
			"user":            user,
			"format_settings": fs,
		})
		return
	}
	resp["format_settings"] = fs
	writeJSON(w, 200, resp)
}

// updateMyContacts permite al usuario actualizar sus datos de contacto para notificaciones
func (ah *AuthHandlers) updateMyContacts(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req struct {
		Email             *string `json:"email"`
		Phone             *string `json:"phone"`
		TelegramChatID    *string `json:"telegram_chat_id"`
		MatrixUserID      *string `json:"matrix_user_id"`
		XmppJID           *string `json:"xmpp_jid"`
		QuietHoursStart   *int    `json:"quiet_hours_start"`
		QuietHoursEnd     *int    `json:"quiet_hours_end"`
		DigestMode        *string `json:"digest_mode"`
		NationalID        *string `json:"national_id"`
		NationalIDType    *string `json:"national_id_type"`
		NationalIDCountry *string `json:"national_id_country"`
		PassportNumber    *string `json:"passport_number"`
		PassportCountry   *string `json:"passport_country"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	// Guardar digest_mode en metadata del usuario
	if req.DigestMode != nil {
		ah.Pool.Exec(r.Context(), `
			UPDATE users SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('digest_mode', $2)
			WHERE id = $1`, userID, *req.DigestMode)
	}

	_, err = ah.Pool.Exec(r.Context(), `
		UPDATE users SET
			email = COALESCE($2, email),
			phone = COALESCE($3, phone),
			telegram_chat_id = COALESCE($4, telegram_chat_id),
			matrix_user_id = COALESCE($5, matrix_user_id),
			xmpp_jid = COALESCE($6, xmpp_jid),
			quiet_hours_start = $7,
			quiet_hours_end = $8,
			national_id = COALESCE($9, national_id),
			national_id_type = COALESCE($10, national_id_type),
			national_id_country = COALESCE($11, national_id_country),
			passport_number = COALESCE($12, passport_number),
			passport_country = COALESCE($13, passport_country)
		WHERE id = $1`,
		userID, req.Email, req.Phone, req.TelegramChatID, req.MatrixUserID, req.XmppJID,
		req.QuietHoursStart, req.QuietHoursEnd,
		req.NationalID, req.NationalIDType, req.NationalIDCountry,
		req.PassportNumber, req.PassportCountry)
	if err != nil {
		writeError(w, 500, "error updating contacts")
		return
	}

	writeJSON(w, 200, map[string]string{"status": "updated"})
}

func (ah *AuthHandlers) listAccounts(w http.ResponseWriter, r *http.Request) {
	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = "localhost"
	}
	rows, err := ah.Pool.Query(r.Context(), `
		SELECT id, username, display_name, account_type, membership_status
		FROM users WHERE node_domain = $1 AND membership_status = 'active'
		ORDER BY username`, nodeDomain)
	if err != nil {
		writeError(w, 500, "error listing accounts")
		return
	}
	defer rows.Close()
	var accounts []map[string]interface{}
	for rows.Next() {
		var id string
		var username, displayName, accountType, status string
		if err := rows.Scan(&id, &username, &displayName, &accountType, &status); err != nil {
			continue
		}
		accounts = append(accounts, map[string]interface{}{
			"id":                id,
			"username":          username,
			"display_name":      displayName,
			"account_type":      accountType,
			"membership_status": status,
		})
	}
	if accounts == nil {
		accounts = []map[string]interface{}{}
	}
	writeJSON(w, 200, accounts)
}

func (ah *AuthHandlers) listPasskeys(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	if ah.Pool == nil {
		writeJSON(w, 200, map[string]interface{}{
			"user_id":  userID.String(),
			"passkeys": []interface{}{},
		})
		return
	}

	rows, err := ah.Pool.Query(r.Context(), `
		SELECT id, credential_id, device_type, label, created_at, last_used_at
		FROM user_passkeys WHERE user_id = $1 ORDER BY created_at DESC`,
		userID)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"user_id":  userID.String(),
			"passkeys": []interface{}{},
		})
		return
	}
	defer rows.Close()

	type passkeyInfo struct {
		ID           string  `json:"id"`
		CredentialID []byte  `json:"credential_id"`
		DeviceType   *string `json:"device_type"`
		Label        *string `json:"name"`
		CreatedAt    string  `json:"created_at"`
		LastUsedAt   *string `json:"last_used_at"`
	}

	var passkeys []passkeyInfo
	for rows.Next() {
		var p passkeyInfo
		var createdAt time.Time
		var lastUsedAt *time.Time
		if err := rows.Scan(&p.ID, &p.CredentialID, &p.DeviceType, &p.Label, &createdAt, &lastUsedAt); err != nil {
			continue
		}
		p.CreatedAt = createdAt.Format(time.RFC3339)
		if lastUsedAt != nil {
			s := lastUsedAt.Format(time.RFC3339)
			p.LastUsedAt = &s
		}
		passkeys = append(passkeys, p)
	}

	if passkeys == nil {
		passkeys = []passkeyInfo{}
	}

	writeJSON(w, 200, map[string]interface{}{
		"user_id":  userID.String(),
		"passkeys": passkeys,
	})
}

// ===== AGREGAR PASSKEY A USUARIO EXISTENTE =====

type BeginAddPasskeyRequest struct {
	Label string `json:"label"`
}

func (ah *AuthHandlers) beginAddPasskey(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	// Obtener username y display_name del usuario
	var username, displayName string
	_ = ah.Pool.QueryRow(r.Context(), `SELECT username, COALESCE(display_name, username) FROM users WHERE id = $1`, userID).Scan(&username, &displayName)

	// Obtener credential IDs existentes para excluirlas
	var existingCreds [][]byte
	if ah.Pool != nil {
		rows, _ := ah.Pool.Query(r.Context(), `SELECT credential_id FROM user_passkeys WHERE user_id = $1`, userID)
		if rows != nil {
			defer rows.Close()
			for rows.Next() {
				var credID []byte
				rows.Scan(&credID)
				existingCreds = append(existingCreds, credID)
			}
		}
	}

	rpID := deriveRPID(r)
	rpName := ah.RPName
	if rpName == "" {
		rpName = rpID
	}

	options, err := ah.PasskeyManager.BeginRegistration(userID, username, displayName, existingCreds, rpID, rpName)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	// Extraer el challenge del *RegistrationChallenge
	var challengeStr string
	switch opts := options.(type) {
	case *crypto.RegistrationChallenge:
		challengeStr = opts.Challenge
	case map[string]interface{}:
		challengeStr, _ = opts["challenge"].(string)
	default:
		writeError(w, 500, "unexpected options type from passkey manager")
		return
	}

	// Guardar el challenge para verificar despues
	ah.ChallengeStore.Store("add_"+userID.String(), challengeStr, userID)

	writeJSON(w, 200, map[string]interface{}{
		"options": options,
	})
}

type FinishAddPasskeyRequest struct {
	Label    string      `json:"label"`
	Response interface{} `json:"response"`
}

func (ah *AuthHandlers) finishAddPasskey(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	var req FinishAddPasskeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}

	challenge, storedUserID, ok := ah.ChallengeStore.Get("add_" + userID.String())
	if !ok || storedUserID != userID {
		writeError(w, 400, "no pending passkey registration challenge")
		return
	}

	origin := deriveOrigin(r)

	passkeyRaw, err := ah.PasskeyManager.VerifyRegistration(req.Response, challenge, origin)
	if err != nil {
		writeError(w, 400, fmt.Sprintf("registration verification failed: %v", err))
		return
	}

	ah.ChallengeStore.Delete("add_" + userID.String())

	if ah.Pool == nil {
		writeError(w, 500, "database not available")
		return
	}

	// Type-assert a *crypto.StoredPasskey para acceder a CredentialID y PublicKey
	var credentialID, publicKey []byte
	switch pk := passkeyRaw.(type) {
	case *crypto.StoredPasskey:
		credentialID = pk.CredentialID
		publicKey = pk.PublicKey
	default:
		writeError(w, 500, "unexpected passkey type from manager")
		return
	}

	// Determinar device_type desde la respuesta WebAuthn si es posible
	deviceType := ""
	label := req.Label
	if label == "" {
		label = "Dispositivo"
	}

	// Guardar el passkey en la base de datos
	var passkeyID string
	err = ah.Pool.QueryRow(r.Context(), `
		INSERT INTO user_passkeys (user_id, credential_id, public_key, sign_count, device_type, label)
		VALUES ($1, $2, $3, 0, $4, $5)
		RETURNING id::text`,
		userID, credentialID, publicKey, deviceType, label).Scan(&passkeyID)
	if err != nil {
		writeError(w, 500, fmt.Sprintf("failed to save passkey: %v", err))
		return
	}

	writeJSON(w, 201, map[string]interface{}{
		"passkey_id": passkeyID,
		"message":    "Passkey registrado correctamente.",
	})
}

func (ah *AuthHandlers) deletePasskey(w http.ResponseWriter, r *http.Request) {
	am := NewAuthMiddleware(ah.JWTSecret)
	userID, err := am.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}

	passkeyID := chi.URLParam(r, "id")
	if passkeyID == "" {
		writeError(w, 400, "passkey id is required")
		return
	}

	if ah.Pool == nil {
		writeError(w, 500, "database not available")
		return
	}

	// Verificar que el passkey pertenece al usuario antes de borrar
	tag, err := ah.Pool.Exec(r.Context(), `
		DELETE FROM user_passkeys WHERE id = $1 AND user_id = $2`,
		passkeyID, userID)
	if err != nil {
		writeError(w, 500, "error deleting passkey")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, 404, "passkey not found or does not belong to you")
		return
	}

	writeJSON(w, 200, map[string]string{"status": "deleted", "passkey_id": passkeyID})
}

type PasswordLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (ah *AuthHandlers) passwordLogin(w http.ResponseWriter, r *http.Request) {
	var req PasswordLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if req.Username == "" || req.Password == "" {
		writeError(w, 400, "username and password are required")
		return
	}

	// Validar terminal si el POS envia X-Terminal-ID y X-Terminal-Public-Key
	// Esto bloquea el login en terminales no registrados o con clave publica incorrecta
	terminalIDHeader := r.Header.Get("X-Terminal-ID")
	terminalPubKeyHeader := r.Header.Get("X-Terminal-Public-Key")
	if terminalIDHeader != "" && terminalPubKeyHeader != "" {
		var dbPubKey string
		var dbIsRegistered, dbIsActive bool
		err := ah.Pool.QueryRow(r.Context(), `
			SELECT terminal_public_key, is_registered, is_active
			FROM nfc_terminals
			WHERE terminal_id = $1
			ORDER BY updated_at DESC LIMIT 1`,
			terminalIDHeader,
		).Scan(&dbPubKey, &dbIsRegistered, &dbIsActive)
		if err != nil {
			writeError(w, 403, "terminal_not_registered")
			return
		}
		if dbPubKey != terminalPubKeyHeader {
			writeError(w, 403, "terminal_key_mismatch")
			return
		}
		if !dbIsRegistered || !dbIsActive {
			writeError(w, 403, "terminal_not_registered")
			return
		}
		// Verificar expiracion de sesion web (solo terminales web_pos)
		var dbTerminalType string
		var dbWebSessionExpiresAt *time.Time
		_ = ah.Pool.QueryRow(r.Context(), `
			SELECT terminal_type, web_session_expires_at
			FROM nfc_terminals WHERE terminal_id = $1
			ORDER BY updated_at DESC LIMIT 1`,
			terminalIDHeader,
		).Scan(&dbTerminalType, &dbWebSessionExpiresAt)
		if dbTerminalType == "web" || dbTerminalType == "web_pos" {
			if dbWebSessionExpiresAt == nil || time.Now().After(*dbWebSessionExpiresAt) {
				// Marcar como inactivo para forzar re-validacion
				ah.Pool.Exec(r.Context(), `UPDATE nfc_terminals SET is_active = false WHERE terminal_id = $1`, terminalIDHeader)
				writeError(w, 403, "web_session_expired")
				return
			}
		}
	}

	if ah.Pool == nil {
		writeError(w, 500, "database not available")
		return
	}

	// Separar username@domain y resolver el dominio efectivo
	// El username se convierte a minusculas para ser case-insensitive
	// (los moviles suelen poner la primera letra en mayuscula automaticamente)
	username, _ := parseUsernameDomain(req.Username)
	username = strings.ToLower(username)
	nodeDomain := ah.resolveNodeDomain(r, req.Username)

	var userID uuid.UUID
	var passwordHash string
	var userNodeDomain string
	err := ah.Pool.QueryRow(r.Context(), `
		SELECT u.id, uc.password_hash, u.node_domain
		FROM users u
		JOIN user_credentials uc ON uc.user_id = u.id
		WHERE u.username = $1 AND u.node_domain = $2 AND u.membership_status = 'active'
	`, username, nodeDomain).Scan(&userID, &passwordHash, &userNodeDomain)
	if err != nil {
		writeError(w, 401, "invalid credentials")
		return
	}

	// El token JWT usa el dominio real del nodo (para federacion),
	// no LOCAL_NODE_DOMAIN que es solo para datos internos
	jwtDomain := db.ActualNodeDomain(r.Context(), ah.Pool, ah.NodeDomain)
	if jwtDomain == "" {
		jwtDomain = ah.NodeDomain
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeError(w, 401, "invalid credentials")
		return
	}

	am := NewAuthMiddleware(ah.JWTSecret)
	token, err := am.GenerateToken(userID, username, jwtDomain)
	if err != nil {
		writeError(w, 500, "failed to generate token")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"token":    token,
		"username": req.Username,
		"node":     ah.NodeDomain,
		"user_id":  userID.String(),
	})
}
