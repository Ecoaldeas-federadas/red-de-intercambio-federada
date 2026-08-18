package api

import (
	"context"
	"fmt"
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

	// robots.txt: permitir que todos los crawlers indexen el sitio
	r.Get("/robots.txt", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Write([]byte("User-agent: *\nAllow: /\n\n# Sitemap\nSitemap: " + getScheme(r) + "://" + r.Host + "/sitemap.xml\n"))
	})

	// sitemap.xml: lista todas las paginas publicas
	r.Get("/sitemap.xml", func(w http.ResponseWriter, r *http.Request) {
		baseURL := getScheme(r) + "://" + r.Host
		// Listar paginas publicas desde la BD
		nodeDomain := "localhost"
		rows, err := pool.Query(r.Context(), `SELECT slug FROM public_pages WHERE node_domain = $1 AND is_published = true ORDER BY menu_order`, nodeDomain)
		if err != nil {
			w.Header().Set("Content-Type", "application/xml")
			w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`))
			return
		}
		defer rows.Close()
		var sb strings.Builder
		sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
		sb.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
		// Pagina principal
		sb.WriteString(fmt.Sprintf("  <url><loc>%s/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n", baseURL))
		for rows.Next() {
			var slug string
			_ = rows.Scan(&slug)
			sb.WriteString(fmt.Sprintf("  <url><loc>%s/p/%s</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n", baseURL, slug))
		}
		sb.WriteString("</urlset>\n")
		w.Header().Set("Content-Type", "application/xml")
		w.Write([]byte(sb.String()))
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

				// Inyectar contenido para crawlers:
				// - Raiz /: pagina de inicio + indice de todas las paginas
				// - /p/{slug}: contenido de la pagina + enlaces a las demas
				var slug string
				if r.URL.Path == "/" || r.URL.Path == "" {
					slug = "inicio"
				} else if len(r.URL.Path) > 3 && r.URL.Path[:3] == "/p/" {
					slug = r.URL.Path[3:]
					if idx := strings.Index(slug, "?"); idx >= 0 {
						slug = slug[:idx]
					}
				}
				if slug != "" {
					if html := renderPageWithContent(frontendDir, pool, slug); html != "" {
						w.Header().Set("Content-Type", "text/html; charset=utf-8")
						w.Write([]byte(html))
						return
					}
				}

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

// renderPageWithContent lee el index.html del frontend, busca el contenido
// de la pagina en la BD y lo inyecta dentro del HTML para que crawlers
// puedan leerlo sin ejecutar JavaScript. Tambien incluye un indice con
// enlaces a todas las paginas publicas para que los crawlers puedan navegar.
func renderPageWithContent(frontendDir string, pool *pgxpool.Pool, slug string) string {
	// Leer el index.html base
	indexBytes, err := os.ReadFile(filepath.Join(frontendDir, "index.html"))
	if err != nil {
		return ""
	}
	indexHTML := string(indexBytes)

	// Buscar la pagina en la BD
	var title, content string
	var subtitle *string
	err = pool.QueryRow(context.Background(), `
		SELECT title, subtitle, content
		FROM public_pages
		WHERE node_domain = 'localhost' AND slug = $1 AND is_published = true`,
		slug).Scan(&title, &subtitle, &content)
	if err != nil {
		return ""
	}

	subtitleStr := ""
	if subtitle != nil {
		subtitleStr = *subtitle
	}

	// Convertir el contenido JSON a HTML
	htmlContent := jsonContentToHTML(content)

	// Obtener lista de todas las paginas publicas para el indice de navegacion
	navHTML := buildNavigationIndex(pool, slug)

	// Crear el bloque de contenido para inyectar
	// Se inserta dentro de <div id="root"> para que React lo reemplace al cargar
	noscriptBlock := fmt.Sprintf(`
<noscript>
  <article style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: system-ui, sans-serif; line-height: 1.6;">
    <h1>%s</h1>
    <p style="font-size: 1.2em; color: #666;">%s</p>
    %s
    <nav style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
      <h2 style="font-size: 1.1em;">Paginas del sitio</h2>
      <ul style="list-style: none; padding: 0;">
%s
      </ul>
    </nav>
  </article>
</noscript>`, title, subtitleStr, htmlContent, navHTML)

	// Tambien actualizar el title y meta description del head
	indexHTML = strings.Replace(indexHTML,
		"<title>Trueque - Credito Mutuo Federado</title>",
		fmt.Sprintf("<title>%s - %s</title>\n    <meta name=\"description\" content=\"%s\" />", title, subtitleStr, subtitleStr),
		1)

	// Inyectar el contenido dentro del div#root
	indexHTML = strings.Replace(indexHTML,
		`<div id="root"></div>`,
		fmt.Sprintf(`<div id="root">%s</div>`, noscriptBlock),
		1)

	return indexHTML
}

// buildNavigationIndex genera una lista HTML <li> con enlaces a todas las
// paginas publicas, para que los crawlers puedan navegar el sitio completo.
func buildNavigationIndex(pool *pgxpool.Pool, currentSlug string) string {
	rows, err := pool.Query(context.Background(), `
		SELECT slug, title FROM public_pages
		WHERE node_domain = 'localhost' AND is_published = true AND show_in_menu = true
		ORDER BY menu_order`)
	if err != nil {
		return ""
	}
	defer rows.Close()

	var sb strings.Builder
	for rows.Next() {
		var slug, title string
		_ = rows.Scan(&slug, &title)
		// Marcar la pagina actual como activa
		if slug == currentSlug {
			sb.WriteString(fmt.Sprintf("        <li style="+"\""+"margin: 4px 0;"+"\""+"><strong>%s (pagina actual)</strong></li>\n", title))
		} else {
			sb.WriteString(fmt.Sprintf("        <li style="+"\""+"margin: 4px 0;"+"\""+"><a href="+"\""+"/p/%s"+"\""+">%s</a></li>\n", slug, title))
		}
	}
	return sb.String()
}

func getScheme(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}
	if scheme := r.Header.Get("X-Forwarded-Proto"); scheme != "" {
		return scheme
	}
	return "http"
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
