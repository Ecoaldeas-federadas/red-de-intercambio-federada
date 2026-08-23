package api

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"federated-credit-node/internal/config"
	"fmt"
	"log"
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
	return NewRouterWithAuthAndBasePath(h, ah, fh, oh, ph, eh, rh, dh, nh, sh, nil, nil, corsOrigins, am, pool, "", nil)
}

// NewRouterWithAuthAndBasePath crea el router con un prefijo de ruta opcional
// para el frontend (ej: "/demo" para el nodo demo). Las API routes quedan en /api/*.
func NewRouterWithAuthAndBasePath(h *Handler, ah *AuthHandlers, fh *FederationHandler, oh *OrganizationHandler, ph *PaymentsHandler, eh *ExternalHandler, rh *RecoveryHandler, dh *DepartmentsHandler, nh *NFCTerminalHandler, sh *SetupHandler, nwh *NetworkHandler, fsvh *FederatedServicesHandler, corsOrigins []string, am *AuthMiddleware, pool *pgxpool.Pool, basePath string, appCfg *config.Config) http.Handler {
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
		r.Use(am.BlockDemo) // Bloquear escritura para usuarios demo
		r.Get("/api/accounts/me", ah.getMe)
		r.Put("/api/accounts/me/contacts", ah.updateMyContacts)
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

	// POS Web handler (cargos QR para punto de venta web)
	posH := NewPOSHandler(pool, nh.NFC, nh.NodeDomain)
	posH.RegisterRoutes(r, am)

	// Network handler (red privada federada con OpenWrt - opcional)
	if nwh != nil {
		nwh.RegisterRoutesWithAuth(r, am)
	}

	// Net sync handler (sincronizacion automatica de info de red entre nodos federados)
	if nwh != nil {
		netSync := NewNetSyncHandler(pool, nwh.NodeDomain)
		netSync.RegisterRoutes(r)
	}

	// Services handler (catalogo de servicios federados/autohospedados)
	if fsvh != nil {
		fsvh.RegisterRoutesWithAuth(r, am)
	}

	// Update handler (actualizar nodo y servicios con un clic)
	updateH := NewUpdateHandler(pool, fh.NodeDomain)
	updateH.RegisterRoutes(r, am)

	// Federation governance handler (propuestas y votacion entre nodos)
	fedGovH := NewFederationGovHandler(pool, fh.NodeDomain)
	fedGovH.RegisterRoutesWithAuth(r, am)

	// Node discovery handler (descubrimiento de nodos por gossip + solicitudes de federacion)
	nodeDiscH := NewNodeDiscoveryHandler(pool, fh.NodeDomain)
	nodeDiscH.RegisterRoutes(r, am)

	// Cluster YugabyteDB handler (monitoreo de tabletas y nodos)
	clusterH := NewClusterHandler(pool, appCfg)
	clusterH.RegisterRoutesWithAuth(r, am)

	// Assembly y Tax
	asmbH := &AssemblyHandler{Pool: pool, Auth: am}
	asmbH.RegisterRoutes(r, am)
	taxH := &TaxHandler{Pool: pool, Auth: am}
	taxH.RegisterRoutes(r, am)

	// Asambleas de organizaciones y departamentos
	scopedAsmbH := NewScopedAssemblyHandler(pool, am)
	scopedAsmbH.RegisterRoutes(r, am)

	// Mis organizaciones y departamentos (acceso con sesion personal)
	myH := NewMyMembershipHandler(pool, am)
	myH.RegisterRoutes(r, am)

	// Notificaciones
	notifH := &NotificationHandler{Pool: pool, Auth: am}
	notifH.RegisterRoutes(r, am)

	// System: auditoria, config, niveles, tarifa, productos
	sysH := &SystemHandler{Pool: pool, Auth: am, nodeDomain: h.nodeDomain}
	sysH.RegisterRoutes(r, am)

	// Merge conflicts: conflictos de fusion entre nodos
	mergeH := &MergeConflictHandler{Pool: pool, Auth: am, nodeDomain: h.nodeDomain}
	mergeH.RegisterRoutes(r, am)

	// Documents: documentos de usuario y paises
	docH := &DocumentsHandler{Pool: pool, Auth: am, JWTSecret: ah.JWTSecret}
	docH.RegisterRoutes(r, am)

	// Public proposals + demo user
	ppH := &PublicProposalsHandler{Pool: pool, Auth: am, JWTSecret: ah.JWTSecret}
	ppH.RegisterRoutes(r, am)

	// Backups + YugabyteDB nodes
	backupH := NewBackupsHandler(pool)
	backupH.RegisterRoutes(r, am)
	ybH := NewYugabyteNodesHandler(pool)
	ybH.RegisterRoutes(r, am)

	// Servicios y mensualidades de organizaciones
	servicesH := NewServicesHandler(pool)
	servicesH.RegisterRoutes(r, am)

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

	// Servir imagenes estaticas del frontend desde /images/
	// (web/public/images/ se copia a web/dist/images/ tras el build de Vite)
	r.Get("/images/*", func(w http.ResponseWriter, r *http.Request) {
		imgDir := "/app/web/dist/images"
		if _, err := os.Stat(imgDir); err != nil {
			imgDir = "./web/dist/images"
		}
		if _, err := os.Stat(imgDir); err != nil {
			imgDir = "./web/public/images"
		}
		fileServer := http.FileServer(http.Dir(imgDir))
		w.Header().Set("Cache-Control", "public, max-age=86400")
		http.StripPrefix("/images/", fileServer).ServeHTTP(w, r)
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
		nodeDomain := h.nodeDomain
		if nodeDomain == "" {
			nodeDomain = "localhost"
		}
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

	// ===== DIRECTORIO /html/ - Archivos HTML estaticos reales en disco =====
	// Los archivos se generan fisicamente en /app/web/html/ (o ./html/)
	// cada vez que se actualiza una pagina publica. Los crawlers pueden
	// leerlos directamente porque son archivos estaticos reales.
	htmlDir := "/app/web/html"
	if _, err := os.Stat(htmlDir); err != nil {
		htmlDir = "./html"
	}
	os.MkdirAll(htmlDir, 0755)

	// Servir archivos estaticos HTML reales desde el directorio
	htmlFileServer := http.FileServer(http.Dir(htmlDir))
	r.Get("/html", func(w http.ResponseWriter, r *http.Request) {
		// Servir index.html del directorio html
		indexPath := filepath.Join(htmlDir, "index.html")
		if _, err := os.Stat(indexPath); err != nil {
			w.WriteHeader(404)
			w.Write([]byte("<html><body><h1>No hay paginas HTML generadas</h1></body></html>"))
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeFile(w, r, indexPath)
	})
	r.Get("/html/", func(w http.ResponseWriter, r *http.Request) {
		indexPath := filepath.Join(htmlDir, "index.html")
		if _, err := os.Stat(indexPath); err != nil {
			w.WriteHeader(404)
			w.Write([]byte("<html><body><h1>No hay paginas HTML generadas</h1></body></html>"))
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeFile(w, r, indexPath)
	})
	r.Get("/html/*", func(w http.ResponseWriter, r *http.Request) {
		// Servir archivo estatico real desde el directorio html
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		htmlFileServer.ServeHTTP(w, r)
	})

	// Descargar todos los archivos HTML como ZIP
	// Publico: cualquiera puede descargar el contenido del sitio
	r.Get("/html.zip", func(w http.ResponseWriter, r *http.Request) {
		// Asegurar que los archivos esten actualizados antes de comprimir
		GenerateStaticHTMLFiles(pool)

		// Crear ZIP en memoria
		var buf bytes.Buffer
		zipWriter := zip.NewWriter(&buf)

		// Recorrer todos los archivos del directorio html
		entries, err := os.ReadDir(htmlDir)
		if err != nil {
			w.WriteHeader(500)
			w.Write([]byte("Error leyendo archivos HTML"))
			return
		}

		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			filePath := filepath.Join(htmlDir, entry.Name())
			data, err := os.ReadFile(filePath)
			if err != nil {
				continue
			}
			writer, err := zipWriter.Create(entry.Name())
			if err != nil {
				continue
			}
			writer.Write(data)
		}
		zipWriter.Close()

		// Servir el ZIP
		w.Header().Set("Content-Type", "application/zip")
		w.Header().Set("Content-Disposition", "attachment; filename=sitio-html.zip")
		w.Header().Set("Content-Length", fmt.Sprintf("%d", buf.Len()))
		w.Write(buf.Bytes())
	})

	// Descargar todo el contenido del sitio como un solo archivo de texto
	// Util para alimentar sistemas de IA (NotebookLM, ChatGPT, etc.)
	r.Get("/html.txt", func(w http.ResponseWriter, r *http.Request) {
		// Asegurar que los archivos esten actualizados
		GenerateStaticHTMLFiles(pool)

		// Obtener todas las paginas de la BD (todos los dominios)
		rows, err := pool.Query(context.Background(), `
			SELECT slug, title, subtitle, content
			FROM public_pages
			WHERE is_published = true
			ORDER BY menu_order`)
		if err != nil {
			w.WriteHeader(500)
			w.Write([]byte("Error leyendo paginas"))
			return
		}
		defer rows.Close()

		var sb strings.Builder
		sb.WriteString("=== SITIO PUBLICO COMPLETO ===\n\n")

		for rows.Next() {
			var slug, title, content string
			var subtitle *string
			_ = rows.Scan(&slug, &title, &subtitle, &content)

			subtitleStr := ""
			if subtitle != nil {
				subtitleStr = *subtitle
			}

			sb.WriteString("========================================\n")
			sb.WriteString(fmt.Sprintf("PAGINA: %s\n", title))
			if subtitleStr != "" {
				sb.WriteString(fmt.Sprintf("SUBTITULO: %s\n", subtitleStr))
			}
			sb.WriteString(fmt.Sprintf("URL: /html/%s.html\n", slug))
			sb.WriteString("========================================\n\n")

			// Convertir contenido JSON a texto plano
			sb.WriteString(jsonContentToText(content))
			sb.WriteString("\n\n")
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=sitio-completo.txt")
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
		// Si hay basePath (ej: "/demo"), servir el frontend bajo ese prefijo
		// y redirigir / al basePath. Las API routes quedan en /api/* sin prefijo.
		if basePath != "" {
			// Redirect / -> /demo/
			r.Get("/", func(w http.ResponseWriter, r *http.Request) {
				http.Redirect(w, r, basePath+"/", http.StatusFound)
			})

			// Redirect /demo -> /demo/ (chi no coincide /demo con /demo/*)
			r.Get(basePath, func(w http.ResponseWriter, r *http.Request) {
				http.Redirect(w, r, basePath+"/", http.StatusFound)
			})

			// Servir frontend bajo /demo/* (incluye /demo/ que sirve index.html)
			r.Get(basePath+"/*", func(w http.ResponseWriter, r *http.Request) {
				serveFrontendFile(w, r, frontendDir, pool, basePath)
			})
		} else {
			// Sin basePath: servir frontend en /* (comportamiento normal)
			r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
				serveFrontendFile(w, r, frontendDir, pool, "")
			})
		}
	}

	return r
}

// serveFrontendFile sirve un archivo del frontend o index.html (SPA fallback).
// Si basePath no es vacio, inyecta <base href> y window.__BASE_PATH__ en index.html.
func serveFrontendFile(w http.ResponseWriter, r *http.Request, frontendDir string, pool *pgxpool.Pool, basePath string) {
	// Calcular la ruta del archivo quitando el basePath si existe
	urlPath := r.URL.Path
	if basePath != "" && strings.HasPrefix(urlPath, basePath) {
		urlPath = strings.TrimPrefix(urlPath, basePath)
		if urlPath == "" {
			urlPath = "/"
		}
	}

	// Si la ruta es un archivo real, servirlo
	filePath := filepath.Join(frontendDir, urlPath)
	if _, err := os.Stat(filePath); err == nil && urlPath != "/" {
		// Assets con hash: cachear por 1 hora
		if strings.HasPrefix(urlPath, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		} else {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		}
		http.ServeFile(w, r, filePath)
		return
	}

	// No es archivo: servir index.html (SPA routing)
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	// Para rutas /p/{slug}: inyectar meta tags Open Graph
	slugPath := urlPath
	if strings.HasPrefix(slugPath, "/p/") {
		slug := slugPath[3:]
		if idx := strings.Index(slug, "?"); idx >= 0 {
			slug = slug[:idx]
		}
		if html := injectMetaTags(frontendDir, pool, slug); html != "" {
			if basePath != "" {
				html = injectBasePath(html, basePath)
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(html))
			return
		}
	}

	// Servir index.html, inyectando basePath si es necesario
	indexPath := filepath.Join(frontendDir, "index.html")
	indexBytes, err := os.ReadFile(indexPath)
	if err != nil {
		w.WriteHeader(404)
		return
	}
	html := string(indexBytes)
	if basePath != "" {
		html = injectBasePath(html, basePath)
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

// injectBasePath inyecta <base href="/demo/"> y window.__BASE_PATH__ en el HTML
// para que el frontend se sirva bajo un prefijo de ruta.
// Tambien reescribe las rutas absolutas de assets a relativas para que
// se resuelvan contra el <base href>.
func injectBasePath(html, basePath string) string {
	// Reescribir rutas absolutas a relativas para que <base href> las resuelva
	// ej: /assets/index-XXXX.js -> assets/index-XXXX.js
	// ej: /icon.svg -> icon.svg
	// ej: /manifest.webmanifest -> manifest.webmanifest
	html = strings.ReplaceAll(html, `src="/assets/`, `src="assets/`)
	html = strings.ReplaceAll(html, `href="/assets/`, `href="assets/`)
	html = strings.ReplaceAll(html, `href="/icon.svg`, `href="icon.svg`)
	html = strings.ReplaceAll(html, `href="/manifest.webmanifest`, `href="manifest.webmanifest`)
	html = strings.ReplaceAll(html, `href="/favicon`, `href="favicon`)

	// Inyectar <base href> al inicio del <head>
	baseTag := `<base href="` + basePath + `/">`
	html = strings.Replace(html, "<head>", "<head>"+baseTag, 1)

	// Inyectar script con window.__BASE_PATH__ antes de </head>
	scriptTag := `<script>window.__BASE_PATH__="` + basePath + `";</script>`
	html = strings.Replace(html, "</head>", scriptTag+"</head>", 1)

	return html
}

// injectMetaTags lee el index.html, busca la pagina en la BD y reemplaza
// los meta tags del head con el titulo y descripcion de esa pagina especifica.
// Solo modifica el <head>, no toca el <body>, asi que React funciona normal.
func injectMetaTags(frontendDir string, pool *pgxpool.Pool, slug string) string {
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
		WHERE is_published = true AND slug = $1`,
		slug).Scan(&title, &subtitle, &content)
	if err != nil {
		return ""
	}

	subtitleStr := ""
	if subtitle != nil {
		subtitleStr = *subtitle
	}

	// Extraer una descripcion del contenido (primer bloque de texto)
	description := subtitleStr
	if description == "" {
		description = extractFirstText(content)
	}
	if len(description) > 160 {
		description = description[:160] + "..."
	}

	// Escapar para HTML
	title = htmlEscape(title)
	subtitleStr = htmlEscape(subtitleStr)
	description = htmlEscape(description)

	// 1. Reemplazar el contenido entre <title> y </title>
	// Buscar <title> y </title> y reemplazar lo que hay entre ellos
	if startIdx := strings.Index(indexHTML, "<title>"); startIdx >= 0 {
		endTag := "</title>"
		if endIdx := strings.Index(indexHTML[startIdx:], endTag); endIdx >= 0 {
			// startIdx es donde empieza <title>
			// endIdx es donde empieza </title> relativo a startIdx
			// Reemplazar el contenido entre <title> y </title>
			before := indexHTML[:startIdx+len("<title>")]
			after := indexHTML[startIdx+endIdx:]
			indexHTML = before + title + " - " + subtitleStr + after
		}
	}

	// 2. Insertar meta tags Open Graph justo antes de </head>
	// Esto es seguro porque no depende del formato exacto del HTML existente
	ogTags := fmt.Sprintf(`
    <meta name="description" content="%s" />
    <meta property="og:title" content="%s" />
    <meta property="og:description" content="%s" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="/p/%s" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="%s" />
    <meta name="twitter:description" content="%s" />
  `, description, title, description, slug, title, description)

	indexHTML = strings.Replace(indexHTML, "</head>", ogTags+"</head>", 1)

	return indexHTML
}

// extractFirstText extrae el primer texto del contenido JSON de la pagina
// para usarlo como descripcion si no hay subtitulo.
func extractFirstText(jsonStr string) string {
	var blocks []map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &blocks); err != nil {
		return ""
	}
	for _, block := range blocks {
		// Buscar el primer campo de texto significativo
		if desc, ok := block["description"].(string); ok && len(desc) > 20 {
			return desc
		}
		if subtitle, ok := block["subtitle"].(string); ok && len(subtitle) > 20 {
			return subtitle
		}
		if title, ok := block["title"].(string); ok && len(title) > 10 {
			return title
		}
	}
	return ""
}

// pageInfo holds the data needed to generate a static HTML page.
type pageInfo struct {
	slug, title, content string
	subtitle, icon       *string
}

// GenerateStaticHTMLFiles genera archivos HTML estaticos reales en disco
// para todas las paginas publicas. Se llama al iniciar el backend y
// cada vez que se actualiza una pagina. Los crawlers pueden leer estos
// archivos directamente porque existen fisicamente en disco.
func GenerateStaticHTMLFiles(pool *pgxpool.Pool) {
	htmlDir := "/app/web/html"
	if _, err := os.Stat(htmlDir); err != nil {
		htmlDir = "./html"
	}
	os.MkdirAll(htmlDir, 0755)

	// Obtener todas las paginas publicas
	rows, err := pool.Query(context.Background(), `
		SELECT slug, title, subtitle, content, icon, menu_order
		FROM public_pages
		WHERE is_published = true
		ORDER BY menu_order`)
	if err != nil {
		log.Printf("GenerateStaticHTMLFiles: error querying pages: %v", err)
		return
	}
	defer rows.Close()

	var pages []pageInfo
	for rows.Next() {
		var p pageInfo
		_ = rows.Scan(&p.slug, &p.title, &p.subtitle, &p.content, &p.icon, new(int))
		pages = append(pages, p)
	}

	// 1. Generar index.html (indice de todas las paginas)
	indexHTML := generateHTMLIndex(pages)
	indexPath := filepath.Join(htmlDir, "index.html")
	if err := os.WriteFile(indexPath, []byte(indexHTML), 0644); err != nil {
		log.Printf("GenerateStaticHTMLFiles: error writing index: %v", err)
	} else {
		log.Printf("GenerateStaticHTMLFiles: index.html generado (%d paginas)", len(pages))
	}

	// 2. Generar cada pagina individual como {slug}.html
	for _, p := range pages {
		pageHTML := generateHTMLPage(pool, p.slug, p.title, p.subtitle, p.content, pages)
		pagePath := filepath.Join(htmlDir, p.slug+".html")
		if err := os.WriteFile(pagePath, []byte(pageHTML), 0644); err != nil {
			log.Printf("GenerateStaticHTMLFiles: error writing %s: %v", p.slug, err)
		}
	}

	// 3. Generar sitemap.html (mapa del sitio completo)
	sitemapHTML := generateSitemapHTML(pages)
	sitemapPath := filepath.Join(htmlDir, "sitemap.html")
	os.WriteFile(sitemapPath, []byte(sitemapHTML), 0644)
}

// generateHTMLIndex genera el HTML del indice de paginas
func generateHTMLIndex(pages []pageInfo) string {
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
	for _, p := range pages {
		subtitleStr := ""
		if p.subtitle != nil {
			subtitleStr = *p.subtitle
		}
		sb.WriteString(fmt.Sprintf("  <li><a href=\"%s.html\">%s</a><div class=\"subtitle\">%s</div></li>\n",
			p.slug, htmlEscape(p.title), htmlEscape(subtitleStr)))
	}
	sb.WriteString("</ul>\n</body>\n</html>\n")
	return sb.String()
}

// generateHTMLPage genera el HTML completo de una pagina individual
func generateHTMLPage(pool *pgxpool.Pool, slug, title string, subtitle *string, content string, allPages []pageInfo) string {
	_ = pool // pool se usa en otras funciones del mismo archivo
	subtitleStr := ""
	if subtitle != nil {
		subtitleStr = *subtitle
	}

	htmlContent := jsonContentToHTML(content)

	// Generar navegacion a las demas paginas
	var navSB strings.Builder
	for _, p := range allPages {
		if p.slug == slug {
			continue
		}
		navSB.WriteString(fmt.Sprintf("  <li><a href=\"%s.html\">%s</a></li>\n", p.slug, htmlEscape(p.title)))
	}

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
<div class="back"><a href="index.html">&larr; Volver al indice</a></div>
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
		htmlContent, navSB.String())
}

// generateSitemapHTML genera un mapa del sitio en HTML
func generateSitemapHTML(pages []pageInfo) string {
	var sb strings.Builder
	sb.WriteString(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mapa del Sitio</title>
<meta name="robots" content="index, follow">
<style>
body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
h1 { color: #16a34a; }
ul { list-style: none; padding: 0; }
li { margin: 8px 0; }
a { color: #16a34a; text-decoration: none; }
a:hover { text-decoration: underline; }
</style>
</head>
<body>
<h1>Mapa del Sitio</h1>
<ul>
<li><a href="index.html">Indice</a></li>
`)
	for _, p := range pages {
		sb.WriteString(fmt.Sprintf("<li><a href=\"%s.html\">%s</a></li>\n", p.slug, htmlEscape(p.title)))
	}
	sb.WriteString("</ul>\n</body>\n</html>\n")
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
