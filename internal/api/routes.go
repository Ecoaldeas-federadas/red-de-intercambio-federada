package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func NewRouter(h *Handler, corsOrigins []string) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(corsMiddleware(corsOrigins))

	h.RegisterRoutes(r)

	return r
}

func NewRouterWithAuth(h *Handler, ah *AuthHandlers, fh *FederationHandler, oh *OrganizationHandler, ph *PaymentsHandler, eh *ExternalHandler, rh *RecoveryHandler, dh *DepartmentsHandler, nh *NFCTerminalHandler, sh *SetupHandler, corsOrigins []string, am *AuthMiddleware) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(corsMiddleware(corsOrigins))

	// Setup routes (no auth required)
	sh.RegisterRoutes(r)

	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.Get("/api/accounts/me", ah.getMe)
	})

	ah.RegisterRoutes(r)
	h.RegisterRoutesWithAuth(r, am)
	fh.RegisterRoutesWithAuth(r, am)
	oh.RegisterRoutesWithAuth(r, am)
	ph.RegisterRoutes(r)
	eh.RegisterRoutesWithAuth(r, am)
	rh.RegisterRoutesWithAuth(r, am)
	dh.RegisterRoutes(r, am)
	nh.RegisterRoutes(r, am)

	// Servir el frontend compilado (React/Vite) desde /app/web/dist
	// En desarrollo, el frontend corre separado en npm run dev (puerto 3000)
	// En produccion/Docker, el backend sirve los archivos estaticos
	frontendDir := "/app/web/dist"
	if _, err := os.Stat(frontendDir); err != nil {
		// Fallback para desarrollo local
		frontendDir = "./web/dist"
	}
	if _, err := os.Stat(frontendDir); err == nil {
		// Servir archivos estaticos
		fileServer := http.FileServer(http.Dir(frontendDir))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Si la ruta no es un archivo, servir index.html (SPA routing)
			path := filepath.Join(frontendDir, r.URL.Path)
			if _, err := os.Stat(path); err != nil {
				http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
				return
			}
			fileServer.ServeHTTP(w, r)
		})
	}

	return r
}

func corsMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool)
	for _, o := range allowedOrigins {
		allowed[strings.TrimSpace(o)] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if allowed[origin] || len(allowedOrigins) == 0 {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-ID, Authorization")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
