package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewRouter(h *Handler, corsOrigins []string) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(corsMiddleware(corsOrigins))

	h.RegisterRoutes(r)

	return r
}

func NewRouterWithAuth(h *Handler, ah *AuthHandlers, fh *FederationHandler, oh *OrganizationHandler, ph *PaymentsHandler, eh *ExternalHandler, rh *RecoveryHandler, dh *DepartmentsHandler, nh *NFCTerminalHandler, sh *SetupHandler, corsOrigins []string, am *AuthMiddleware, pool *pgxpool.Pool) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(corsMiddleware(corsOrigins))

	// Setup routes (no auth required)
	sh.RegisterRoutes(r)

	r.Group(func(r chi.Router) {
		r.Use(am.RequireAuth)
		r.Get("/api/accounts/me", ah.getMe)
		r.Get("/api/accounts/list", ah.listAccounts)
	})

	ah.RegisterRoutes(r)
	h.RegisterRoutesWithAuth(r, am)
	fh.RegisterRoutesWithAuth(r, am)
	oh.RegisterRoutesWithAuth(r, am)
	ph.RegisterRoutes(r, am)
	eh.RegisterRoutesWithAuth(r, am)
	rh.RegisterRoutesWithAuth(r, am)
	dh.RegisterRoutes(r, am)
	nh.RegisterRoutes(r, am)

	// Assembly y Tax
	asmbH := &AssemblyHandler{Pool: pool, Auth: am}
	asmbH.RegisterRoutes(r, am)
	taxH := &TaxHandler{Pool: pool, Auth: am}
	taxH.RegisterRoutes(r, am)

	// System: auditoria, config, niveles, tarifa, productos
	sysH := &SystemHandler{Pool: pool, Auth: am, nodeDomain: h.nodeDomain}
	sysH.RegisterRoutes(r, am)

	// Servir imagenes subidas desde /uploads/
	r.Get("/uploads/*", func(w http.ResponseWriter, r *http.Request) {
		uploadDir := "/app/uploads"
		if _, err := os.Stat(uploadDir); err != nil {
			uploadDir = "./uploads"
		}
		fileServer := http.FileServer(http.Dir(uploadDir))
		// Cache uploaded images for 1 day
		w.Header().Set("Cache-Control", "public, max-age=86400")
		http.StripPrefix("/uploads/", fileServer).ServeHTTP(w, r)
	})

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
				// index.html: NUNCA cachear (para que cambios de JS/CSS se carguen siempre)
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
				w.Header().Set("Pragma", "no-cache")
				w.Header().Set("Expires", "0")
				http.ServeFile(w, r, filepath.Join(frontendDir, "index.html"))
				return
			}
			// Assets con hash (assets/index-XXXX.js): cachear por 1 hora
			// (cambian el nombre con cada build, asi que es seguro)
			if len(r.URL.Path) > 8 && r.URL.Path[:8] == "/assets/" {
				w.Header().Set("Cache-Control", "public, max-age=3600")
			} else {
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
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
