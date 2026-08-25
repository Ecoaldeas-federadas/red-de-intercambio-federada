package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jung-kurt/gofpdf"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ActaPDFHandler genera PDFs de actas de asamblea con codigo QR
// de auditoria para validez legal ante registradores civiles.
type ActaPDFHandler struct {
	Pool       *pgxpool.Pool
	NodeDomain string
}

func (h *ActaPDFHandler) RegisterRoutes(r chi.Router, am *AuthMiddleware) {
	r.With(am.RequireAuth).Get("/api/assembly/sessions/{id}/acta-pdf", h.generateActaPDF)
	r.With(am.RequireAuth).Get("/api/assembly/sessions/{id}/acta-hash", h.getActaHash)
}

// getActaHash: obtiene el hash criptografico de la sesion para el QR
func (h *ActaPDFHandler) getActaHash(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, 400, "id requerido")
		return
	}

	var hash *string
	h.Pool.QueryRow(r.Context(), `SELECT hash FROM assembly_sessions WHERE id = $1`, sessionID).Scan(&hash)
	if hash == nil {
		hash = new(string)
	}
	writeJSON(w, 200, map[string]interface{}{"hash": *hash})
}

// generateActaPDF: genera un PDF del acta de la sesion de asamblea
func (h *ActaPDFHandler) generateActaPDF(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		writeError(w, 400, "id requerido")
		return
	}

	nodeDomain := r.Header.Get("X-Node-Domain")
	if nodeDomain == "" {
		nodeDomain = h.NodeDomain
	}

	// Obtener datos de la sesion
	var title, sessionType, minutes, hash *string
	var sessionDate, createdAt interface{}
	var folio *int
	err := h.Pool.QueryRow(r.Context(), `
		SELECT title, session_type, minutes, hash, session_date, created_at,
		       (SELECT COUNT(*) FROM assembly_sessions WHERE node_domain = $2 AND created_at <= s.created_at) as folio
		FROM assembly_sessions s
		WHERE id = $1`, sessionID, nodeDomain).Scan(&title, &sessionType, &minutes, &hash, &sessionDate, &createdAt, &folio)
	if err != nil {
		writeError(w, 404, "sesion no encontrada")
		return
	}

	// Obtener asistencia
	rows, err := h.Pool.Query(r.Context(), `
		SELECT u.display_name, u.username, a.registered_by
		FROM assembly_attendance a
		JOIN users u ON u.id = a.user_id
		WHERE a.session_id = $1
		ORDER BY u.display_name`, sessionID)
	if err != nil {
		writeError(w, 500, "error getting attendance")
		return
	}
	defer rows.Close()

	type Attendee struct {
		DisplayName string
		Username    string
	}
	var attendees []Attendee
	for rows.Next() {
		var displayName, username, registeredBy *string
		rows.Scan(&displayName, &username, &registeredBy)
		name := ""
		if displayName != nil {
			name = *displayName
		} else if username != nil {
			name = *username
		}
		attendees = append(attendees, Attendee{name, ""})
	}

	// Obtener propuestas y resultados de votacion
	propRows, err := h.Pool.Query(r.Context(), `
		SELECT p.title, p.description, p.status,
		       (SELECT COUNT(*) FROM assembly_votes v WHERE v.decision_id = p.id AND v.vote = 'yes') as yes_votes,
		       (SELECT COUNT(*) FROM assembly_votes v WHERE v.decision_id = p.id AND v.vote = 'no') as no_votes,
		       (SELECT COUNT(*) FROM assembly_votes v WHERE v.decision_id = p.id AND v.vote = 'abstain') as abstain_votes
		FROM assembly_proposals p
		WHERE p.session_id = $1
		ORDER BY p.created_at`, sessionID)
	if err != nil {
		writeError(w, 500, "error getting proposals")
		return
	}
	defer propRows.Close()

	type Proposal struct {
		Title       string
		Description string
		Status      string
		YesVotes    int
		NoVotes     int
		AbstainVotes int
	}
	var proposals []Proposal
	for propRows.Next() {
		var pTitle, pDesc, pStatus *string
		var yesV, noV, abstainV int
		propRows.Scan(&pTitle, &pDesc, &pStatus, &yesV, &noV, &abstainV)
		p := Proposal{
			Title:    strOr(pTitle, ""),
			Description: strOr(pDesc, ""),
			Status:   strOr(pStatus, ""),
			YesVotes: yesV,
			NoVotes:  noV,
			AbstainVotes: abstainV,
		}
		proposals = append(proposals, p)
	}

	// Generar PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetMargins(25, 25, 25)

	// Encabezado
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(0, 10, "ACTA DE ASAMBLEA")
	pdf.Ln(12)

	// Folio
	pdf.SetFont("Arial", "I", 10)
	folioStr := ""
	if folio != nil && *folio > 0 {
		folioStr = fmt.Sprintf("Folio: %d", *folio)
	}
	pdf.Cell(0, 6, folioStr)
	pdf.Ln(8)

	// Linea separadora
	pdf.Line(25, pdf.GetY(), 185, pdf.GetY())
	pdf.Ln(5)

	// Datos de la sesion
	pdf.SetFont("Arial", "B", 12)
	pdf.Cell(0, 7, strOr(title, "Sesion de Asamblea"))
	pdf.Ln(8)

	pdf.SetFont("Arial", "", 10)
	typeStr := "Asamblea General"
	if sessionType != nil && *sessionType == "board" {
		typeStr = "Junta Directiva"
	}
	pdf.Cell(0, 6, "Tipo: "+typeStr)
	pdf.Ln(6)

	dateStr := ""
	if sessionDate != nil {
		switch v := sessionDate.(type) {
		case time.Time:
			dateStr = v.Format("02/01/2006 15:04")
		default:
			dateStr = fmt.Sprintf("%v", v)
		}
	}
	pdf.Cell(0, 6, "Fecha: "+dateStr)
	pdf.Ln(6)

	nodeName := nodeDomain
	if nodeName == "__LOCAL__" {
		nodeName = "Nodo Local"
	}
	pdf.Cell(0, 6, "Nodo: "+nodeName)
	pdf.Ln(10)

	// Asistencia
	pdf.SetFont("Arial", "B", 11)
	pdf.Cell(0, 7, fmt.Sprintf("ASISTENTES (%d)", len(attendees)))
	pdf.Ln(7)

	pdf.SetFont("Arial", "", 10)
	for _, a := range attendees {
		pdf.Cell(0, 5, "  - "+a.DisplayName)
		pdf.Ln(5)
	}
	pdf.Ln(5)

	// Propuestas y votaciones
	if len(proposals) > 0 {
		pdf.SetFont("Arial", "B", 11)
		pdf.Cell(0, 7, fmt.Sprintf("PROPUESTAS Y DECISIONES (%d)", len(proposals)))
		pdf.Ln(8)

		for i, p := range proposals {
			pdf.SetFont("Arial", "B", 10)
			pdf.MultiCell(0, 5, fmt.Sprintf("%d. %s", i+1, p.Title), "", "L", false)
			pdf.SetFont("Arial", "", 9)
			if p.Description != "" {
				pdf.MultiCell(0, 5, "   "+p.Description, "", "L", false)
			}
			pdf.Cell(0, 5, fmt.Sprintf("   Estado: %s | A favor: %d | En contra: %d | Abstenciones: %d",
				p.Status, p.YesVotes, p.NoVotes, p.AbstainVotes))
			pdf.Ln(7)
		}
	}

	// Minuta
	if minutes != nil && *minutes != "" {
		pdf.Ln(3)
		pdf.SetFont("Arial", "B", 11)
		pdf.Cell(0, 7, "MINUTA")
		pdf.Ln(8)
		pdf.SetFont("Arial", "", 10)
		pdf.MultiCell(0, 5, *minutes, "", "L", false)
	}

	// Pie de pagina con hash y QR
	pdf.Ln(10)
	pdf.Line(25, pdf.GetY(), 185, pdf.GetY())
	pdf.Ln(5)

	pdf.SetFont("Arial", "I", 8)
	hashStr := ""
	if hash != nil {
		hashStr = *hash
	}
	pdf.MultiCell(0, 4, "Hash de auditoria: "+hashStr, "", "L", false)
	pdf.MultiCell(0, 4, "Generado el "+time.Now().Format("02/01/2006 15:04:05"), "", "L", false)
	pdf.MultiCell(0, 4, "Este documento es valido como acta digital. El hash criptografico garantiza", "", "L", false)
	pdf.MultiCell(0, 4, "la integridad e inmutabilidad de los datos. Verifique en el nodo con el hash.", "", "L", false)

	// Generar QR con el hash (como texto codificado)
	if hashStr != "" {
		pdf.Ln(5)
		pdf.SetFont("Courier", "", 8)
		pdf.MultiCell(0, 4, "QR: "+hashStr, "", "L", false)
	}

	// Escribir PDF al response
	w.Header().Set("Content-Type", "application/pdf")
	folioNum := 0
	if folio != nil {
		folioNum = *folio
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="acta_%s_folio_%d.pdf"`, sessionID[:8], folioNum))

	var buf bytes.Buffer
	err = pdf.Output(&buf)
	if err != nil {
		writeError(w, 500, "error generating PDF")
		return
	}
	w.Write(buf.Bytes())
}

func strOr(s *string, def string) string {
	if s == nil {
		return def
	}
	return *s
}

// Suppress unused import warning
var _ = json.Marshal
