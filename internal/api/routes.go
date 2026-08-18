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

	// sitemap.xml: lista todas las paginas publicas (versiones SPA y HTML)
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
		// Indice HTML
		sb.WriteString(fmt.Sprintf("  <url><loc>%s/html</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n", baseURL))
		for rows.Next() {
			var slug string
			_ = rows.Scan(&slug)
			// Version SPA
			sb.WriteString(fmt.Sprintf("  <url><loc>%s/p/%s</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n", baseURL, slug))
			// Version HTML estatica
			sb.WriteString(fmt.Sprintf("  <url><loc>%s/html/%s</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n", baseURL, slug))
		}
		sb.WriteString("</urlset>\n")
		w.Header().Set("Content-Type", "application/xml")
		w.Write([]byte(sb.String()))
	})

	// ===== DIRECTORIO /html/ - Paginas publicas en HTML estatico =====
	// Sirve todas las paginas publicas como HTML completo para que
	// crawlers (Google, NotebookLM, etc.) puedan leer el contenido
	// sin ejecutar JavaScript. Se genera dinamicamente desde la BD.
	r.Get("/html", func(w http.ResponseWriter, r *http.Request) {
		html := buildHTMLIndex(pool)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Write([]byte(html))
	})
	r.Get("/html/", func(w http.ResponseWriter, r *http.Request) {
		html := buildHTMLIndex(pool)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Write([]byte(html))
	})
	r.Get("/html/{slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")
		html := buildHTMLPage(pool, slug)
		if html == "" {
			w.WriteHeader(404)
			w.Write([]byte("<html><body><h1>Pagina no encontrada</h1></body></html>"))
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Write([]byte(html))
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

// buildHTMLIndex genera una pagina HTML estatica con el indice de todas
// las paginas publicas. Es la pagina principal del directorio /html/.
func buildHTMLIndex(pool *pgxpool.Pool) string {
	rows, err := pool.Query(context.Background(), `
		SELECT slug, title, subtitle, icon
		FROM public_pages
		WHERE node_domain = 'localhost' AND is_published = true AND show_in_menu = true
		ORDER BY menu_order`)
	if err != nil {
		return "<html><body><h1>Error</h1></html>"
	}
	defer rows.Close()

	var sb strings.Builder
	sb.WriteString(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Indice de Paginas - Sitio Publico</title>
<meta name="description" content="Indice de todas las paginas del sitio">
<meta name="robots" content="index, follow">
<style>
body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
h1 { color: #16a34a; }
ul { list-style: none; padding: 0; }
li { margin: 12px 0; padding: 12px; background: #f5f5f5; border-radius: 8px; }
li a { text-decoration: none; color: #16a34a; font-weight: 600; font-size: 1.1em; }
li a:hover { text-decoration: underline; }
.subtitle { color: #666; font-size: 0.9em; margin-top: 4px; }
.note { background: #e7f5ec; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 0.9em; }
</style>
</head>
<body>
<h1>Indice de Paginas</h1>
<div class="note">Esta es la version HTML estatica del sitio para lectores externos y motores de busqueda. Cada pagina contiene el contenido completo en HTML.</div>
<ul>
`)

	for rows.Next() {
		var slug, title string
		var subtitle, icon *string
		_ = rows.Scan(&slug, &title, &subtitle, &icon)
		subtitleStr := ""
		if subtitle != nil {
			subtitleStr = *subtitle
		}
		iconStr := ""
		if icon != nil {
			iconStr = *icon + " "
		}
		sb.WriteString(fmt.Sprintf("  <li><a href=\"/html/%s\">%s%s</a><div class=\"subtitle\">%s</div></li>\n",
			slug, iconStr, htmlEscape(title), htmlEscape(subtitleStr)))
	}
	sb.WriteString("</ul>\n</body>\n</html>\n")
	return sb.String()
}

// buildHTMLPage genera una pagina HTML estatica completa para una pagina
// publica especifica. Incluye el contenido completo y enlaces a las demas.
func buildHTMLPage(pool *pgxpool.Pool, slug string) string {
	var title, content string
	var subtitle *string
	err := pool.QueryRow(context.Background(), `
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

	htmlContent := jsonContentToHTML(content)
	navHTML := buildHTMLNavigation(pool, slug)

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%s - %s</title>
<meta name="description" content="%s">
<meta name="robots" content="index, follow">
<style>
body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
h1 { color: #16a34a; }
h2 { color: #16a34a; margin-top: 32px; }
h3 { color: #333; margin-top: 24px; }
.subtitle { font-size: 1.2em; color: #666; margin-bottom: 24px; }
.badge { display: inline-block; background: #e7f5ec; color: #16a34a; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; margin-left: 8px; }
nav { margin-top: 48px; padding-top: 24px; border-top: 2px solid #e7f5ec; }
nav h2 { font-size: 1.1em; }
nav ul { list-style: none; padding: 0; }
nav li { margin: 8px 0; }
nav a { color: #16a34a; text-decoration: none; }
nav a:hover { text-decoration: underline; }
.back { margin-bottom: 24px; }
.back a { color: #16a34a; text-decoration: none; }
</style>
</head>
<body>
<div class="back"><a href="/html">&larr; Volver al indice</a></div>
<h1>%s</h1>
<p class="subtitle">%s</p>
%s
<nav>
<h2>Otras paginas</h2>
<ul>
%s
</ul>
</nav>
</body>
</html>
`, htmlEscape(title), htmlEscape(subtitleStr), htmlEscape(subtitleStr),
		htmlEscape(title), htmlEscape(subtitleStr),
		htmlContent, navHTML)
}

// buildHTMLNavigation genera enlaces HTML a todas las paginas excepto la actual
func buildHTMLNavigation(pool *pgxpool.Pool, currentSlug string) string {
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
		if slug == currentSlug {
			continue
		}
		sb.WriteString(fmt.Sprintf("  <li><a href=\"/html/%s\">%s</a></li>\n", slug, htmlEscape(title)))
	}
	return sb.String()
}

// htmlEscape escapa caracteres especiales de HTML para evitar romper el documento
func htmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
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
