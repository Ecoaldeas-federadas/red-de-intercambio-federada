// export-catalog extrae el catalogo completo de productos desde las fuentes
// canonicas (internal/db/seed.go + migraciones SQL) y lo exporta en tres
// formatos: JSON, SQL (dump) y Markdown. Sirve como referencia historica
// antes de la limpieza del catalogo (reestructuracion a catalogo federado).
//
// Uso: go run ./cmd/export-catalog [-out exports]
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type Product struct {
	Name             string  `json:"name"`
	ParentCategory   string  `json:"parent_category"`
	Category         string  `json:"category"`
	Subcategory      string  `json:"subcategory"`
	Origin           string  `json:"origin"`
	Unit             string  `json:"unit"`
	Description      string  `json:"description"`
	Badge            string  `json:"badge"`
	ImageURL         string  `json:"image_url"`
	ProductCode      string  `json:"product_code"`
	PricePerUnit     float64 `json:"price_per_unit"`
	BasePrice        float64 `json:"base_price"` // price_per_kg
	BaseUnit         string  `json:"base_unit"`
	WeightKg         float64 `json:"weight_kg"`
	EnergyDirect     float64 `json:"energy_direct"`
	EnergyHuman      float64 `json:"energy_human"`
	EnergyInputs     float64 `json:"energy_inputs"`
	EnergyAmort      float64 `json:"energy_amortization"`
	EnergyTotal      float64 `json:"energy_total"`
	IsApproved       bool    `json:"is_approved"`
	IsSystem         bool    `json:"is_system"`
	IsComposite      bool    `json:"is_composite"`
	Source           string  `json:"source"` // archivo de origen
}

// ---------- utilidades de parsing ----------

// splitTopLevel divide una lista de valores SQL/Go por comas al nivel superior,
// respetando strings ('...' o "..."), parentesis y comentarios --.
func splitTopLevel(s string, quote byte) []string {
	var out []string
	depth := 0
	var cur strings.Builder
	inStr := false
	i := 0
	for i < len(s) {
		c := s[i]
		if inStr {
			cur.WriteByte(c)
			if c == quote {
				// escape: comilla duplicada ('' o "") o backslash
				if i+1 < len(s) && s[i+1] == quote {
					cur.WriteByte(s[i+1])
					i++
				} else {
					inStr = false
				}
			} else if c == '\\' && quote == '"' && i+1 < len(s) {
				cur.WriteByte(s[i+1])
				i++
			}
			i++
			continue
		}
		switch {
		case c == quote:
			inStr = true
			cur.WriteByte(c)
		case c == '(':
			depth++
			cur.WriteByte(c)
		case c == ')':
			depth--
			cur.WriteByte(c)
		case c == '-' && i+1 < len(s) && s[i+1] == '-':
			// comentario SQL: saltar hasta fin de linea
			for i < len(s) && s[i] != '\n' {
				i++
			}
			continue
		case c == ',' && depth == 0:
			out = append(out, strings.TrimSpace(cur.String()))
			cur.Reset()
		default:
			cur.WriteByte(c)
		}
		i++
	}
	if t := strings.TrimSpace(cur.String()); t != "" {
		out = append(out, t)
	}
	return out
}

// unquoteSQL convierte un literal SQL 'x' a su valor; '' → '.
func unquoteSQL(v string) string {
	v = strings.TrimSpace(v)
	if len(v) >= 2 && v[0] == '\'' && v[len(v)-1] == '\'' {
		return strings.ReplaceAll(v[1:len(v)-1], "''", "'")
	}
	return v
}

// unquoteGo convierte un literal Go "x" a su valor.
func unquoteGo(v string) string {
	v = strings.TrimSpace(v)
	if len(v) >= 2 && v[0] == '"' && v[len(v)-1] == '"' {
		if u, err := strconv.Unquote(v); err == nil {
			return u
		}
		return v[1 : len(v)-1]
	}
	return v
}

func toFloat(v string) float64 {
	f, _ := strconv.ParseFloat(strings.TrimSpace(v), 64)
	return f
}

func toBool(v string) bool {
	return strings.EqualFold(strings.TrimSpace(v), "true")
}

// ---------- parsing de seed.go ----------

// extractSliceLiteral extrae el cuerpo de `name := []T{ ... }` en codigo Go.
func extractSliceLiteral(src, varDecl string) string {
	idx := strings.Index(src, varDecl)
	if idx < 0 {
		return ""
	}
	start := strings.Index(src[idx:], "}{")
	if start < 0 {
		return ""
	}
	start += idx + 1 // posicion de la primera '{'
	depth := 0
	for i := start; i < len(src); i++ {
		switch src[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return src[start+1 : i]
			}
		}
	}
	return ""
}

// splitGoEntries divide el cuerpo de un slice literal en sus elementos {...}.
func splitGoEntries(body string) []string {
	var out []string
	depth := 0
	inStr := false
	start := -1
	for i := 0; i < len(body); i++ {
		c := body[i]
		if inStr {
			if c == '\\' {
				i++
				continue
			}
			if c == '"' {
				inStr = false
			}
			continue
		}
		switch c {
		case '"':
			inStr = true
		case '{':
			if depth == 0 {
				start = i
			}
			depth++
		case '}':
			depth--
			if depth == 0 && start >= 0 {
				out = append(out, body[start+1:i])
				start = -1
			}
		}
	}
	return out
}

func parseSeedProducts(path string) ([]Product, []Product, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, err
	}
	src := string(data)

	// products := []struct { ... }{ {...}, ... }
	body := extractSliceLiteral(src, "products := []struct")
	var products []Product
	for _, e := range splitGoEntries(body) {
		f := splitTopLevel(e, '"')
		if len(f) < 13 {
			continue
		}
		p := Product{
			Name:           unquoteGo(f[0]),
			ParentCategory: unquoteGo(f[1]),
			Category:       unquoteGo(f[2]),
			Subcategory:    unquoteGo(f[3]),
			Unit:           unquoteGo(f[4]),
			Description:    unquoteGo(f[5]),
			Badge:          unquoteGo(f[6]),
			ImageURL:       unquoteGo(f[7]),
			PricePerUnit:   toFloat(f[8]),
			EnergyDirect:   toFloat(f[9]),
			EnergyHuman:    toFloat(f[10]),
			EnergyInputs:   toFloat(f[11]),
			EnergyAmort:    toFloat(f[12]),
			Origin:         "internal",
			BaseUnit:       "kg",
			IsApproved:     true,
			IsSystem:       true,
			Source:         "seed.go",
		}
		if p.Name != "" {
			products = append(products, p)
		}
	}

	// corrections := []correction{ {name, pricePerKg, baseUnit, weightKg, pricePerUnit, energyInputs}, ... }
	var corrections []Product
	cbody := extractSliceLiteral(src, "corrections := []correction")
	for _, e := range splitGoEntries(cbody) {
		f := splitTopLevel(e, '"')
		if len(f) < 6 {
			continue
		}
		corrections = append(corrections, Product{
			Name:         unquoteGo(f[0]),
			BasePrice:    toFloat(f[1]),
			BaseUnit:     unquoteGo(f[2]),
			WeightKg:     toFloat(f[3]),
			PricePerUnit: toFloat(f[4]),
			EnergyInputs: toFloat(f[5]),
		})
	}
	return products, corrections, nil
}

// ---------- parsing de migraciones SQL ----------

var insertRe = regexp.MustCompile(`(?is)INSERT\s+INTO\s+(?:public\.)?products\s*\(([^)]*)\)\s*`)

func parseMigrations(dir string) ([]Product, error) {
	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		return nil, err
	}
	sort.Strings(files)

	var out []Product
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		base := filepath.Base(f)
		prods := parseMigrationFile(string(data), base)
		out = append(out, prods...)
	}
	return out, nil
}

func parseMigrationFile(src, fname string) []Product {
	var out []Product
	matches := insertRe.FindAllStringSubmatchIndex(src, -1)
	for _, m := range matches {
		cols := strings.Split(strings.ToLower(src[m[2]:m[3]]), ",")
		for i := range cols {
			cols[i] = strings.TrimSpace(cols[i])
		}
		// El statement termina en el proximo ';' a nivel superior
		rest := src[m[1]:]
		end := statementEnd(rest)
		stmt := rest[:end]
		out = append(out, parseInsert(stmt, cols, fname)...)
	}
	return out
}

func statementEnd(s string) int {
	depth := 0
	inStr := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if inStr {
			if c == '\'' {
				if i+1 < len(s) && s[i+1] == '\'' {
					i++
					continue
				}
				inStr = false
			}
			continue
		}
		switch c {
		case '\'':
			inStr = true
		case '(':
			depth++
		case ')':
			depth--
		case ';':
			if depth == 0 {
				return i
			}
		}
	}
	return len(s)
}

func parseInsert(stmt string, cols []string, fname string) []Product {
	upper := strings.ToUpper(stmt)

	// Forma A: VALUES (...) AS p(alias,...) — CROSS JOIN
	if strings.Contains(upper, "CROSS JOIN") && strings.Contains(upper, "VALUES") {
		return parseCrossJoinValues(stmt, cols, fname)
	}

	// Forma B: SELECT literal (SELECT node_domain, 'val', ... FROM)
	if strings.HasPrefix(strings.TrimSpace(upper), "SELECT") {
		return parseSelectLiteral(stmt, cols, fname)
	}

	// Forma C: VALUES (...) directo
	if strings.HasPrefix(strings.TrimSpace(upper), "VALUES") {
		return parsePlainValues(stmt, cols, fname)
	}
	return nil
}

// valuesTuples extrae las tuplas (...) de una lista VALUES.
func valuesTuples(s string) [][]string {
	var tuples [][]string
	depth := 0
	inStr := false
	start := -1
	for i := 0; i < len(s); i++ {
		c := s[i]
		if inStr {
			if c == '\'' {
				if i+1 < len(s) && s[i+1] == '\'' {
					i++
					continue
				}
				inStr = false
			}
			continue
		}
		if c == '-' && i+1 < len(s) && s[i+1] == '-' {
			for i < len(s) && s[i] != '\n' {
				i++
			}
			continue
		}
		switch c {
		case '\'':
			inStr = true
		case '(':
			if depth == 0 {
				start = i + 1
			}
			depth++
		case ')':
			depth--
			if depth == 0 && start >= 0 {
				tuples = append(tuples, splitTopLevel(s[start:i], '\''))
				start = -1
			}
		}
	}
	return tuples
}

func applyValues(p *Product, cols []string, vals []string, aliasCols map[string]int) {
	for i, col := range cols {
		if i >= len(vals) {
			break
		}
		v := strings.TrimSpace(vals[i])
		// referencia a alias p.x → tomar el valor de la tupla
		if strings.HasPrefix(v, "p.") {
			continue // resuelto por el llamador
		}
		setField(p, col, v)
	}
}

func setField(p *Product, col, raw string) {
	switch col {
	case "name":
		p.Name = unquoteSQL(raw)
	case "parent_category":
		p.ParentCategory = unquoteSQL(raw)
	case "category":
		p.Category = unquoteSQL(raw)
	case "subcategory":
		p.Subcategory = unquoteSQL(raw)
	case "origin":
		p.Origin = unquoteSQL(raw)
	case "unit":
		p.Unit = unquoteSQL(raw)
	case "description":
		p.Description = unquoteSQL(raw)
	case "badge":
		p.Badge = unquoteSQL(raw)
	case "image_url":
		p.ImageURL = unquoteSQL(raw)
	case "product_code":
		p.ProductCode = unquoteSQL(raw)
	case "price_per_unit":
		p.PricePerUnit = toFloat(raw)
	case "price_per_kg":
		p.BasePrice = toFloat(raw)
	case "base_unit":
		p.BaseUnit = unquoteSQL(raw)
	case "weight_kg":
		p.WeightKg = toFloat(raw)
	case "energy_direct":
		p.EnergyDirect = toFloat(raw)
	case "energy_human":
		p.EnergyHuman = toFloat(raw)
	case "energy_inputs":
		p.EnergyInputs = toFloat(raw)
	case "energy_amortization":
		p.EnergyAmort = toFloat(raw)
	case "is_approved":
		p.IsApproved = toBool(raw)
	case "is_system":
		p.IsSystem = toBool(raw)
	case "is_composite":
		p.IsComposite = toBool(raw)
	}
}

// Forma B: INSERT INTO products (cols) SELECT node_domain, 'lit', 'lit', ... FROM ...
func parseSelectLiteral(stmt string, cols []string, fname string) []Product {
	// extraer la lista del SELECT (entre SELECT y FROM a nivel superior)
	upper := strings.ToUpper(stmt)
	selIdx := strings.Index(upper, "SELECT")
	if selIdx < 0 {
		return nil
	}
	// encontrar FROM a nivel superior
	depth := 0
	inStr := false
	fromIdx := -1
	for i := selIdx + 6; i < len(stmt)-4; i++ {
		c := stmt[i]
		if inStr {
			if c == '\'' {
				if i+1 < len(stmt) && stmt[i+1] == '\'' {
					i++
					continue
				}
				inStr = false
			}
			continue
		}
		switch c {
		case '\'':
			inStr = true
		case '(':
			depth++
		case ')':
			depth--
		default:
			if depth == 0 && strings.HasPrefix(upper[i:], "FROM") && (i == 0 || stmt[i-1] == ' ' || stmt[i-1] == '\n') {
				fromIdx = i
				i = len(stmt)
			}
		}
		if fromIdx >= 0 {
			break
		}
	}
	if fromIdx < 0 {
		return nil
	}
	selList := stmt[selIdx+6 : fromIdx]
	vals := splitTopLevel(selList, '\'')

	p := &Product{Origin: "internal", BaseUnit: "kg", Source: fname}
	for i, col := range cols {
		if i >= len(vals) {
			break
		}
		setField(p, col, vals[i])
	}
	if p.Name == "" {
		return nil
	}
	return []Product{*p}
}

// Forma C: INSERT INTO products (cols) VALUES (row), (row), ...
func parsePlainValues(stmt string, cols []string, fname string) []Product {
	upper := strings.ToUpper(stmt)
	idx := strings.Index(upper, "VALUES")
	if idx < 0 {
		return nil
	}
	tuples := valuesTuples(stmt[idx+6:])
	var out []Product
	for _, t := range tuples {
		p := &Product{Origin: "internal", BaseUnit: "kg", Source: fname}
		for i, col := range cols {
			if i >= len(t) {
				break
			}
			setField(p, col, t[i])
		}
		if p.Name != "" {
			out = append(out, *p)
		}
	}
	return out
}

// Forma A: SELECT nd.node_domain, p.name, ... CROSS JOIN (VALUES ...) AS p(a,b,...)
func parseCrossJoinValues(stmt string, cols []string, fname string) []Product {
	upper := strings.ToUpper(stmt)
	vIdx := strings.Index(upper, "VALUES")
	if vIdx < 0 {
		return nil
	}
	// alias: AS p(col1, col2, ...)
	aliasRe := regexp.MustCompile(`(?i)\)\s+(?:AS\s+)?p\s*\(([^)]*)\)`)
	am := aliasRe.FindStringSubmatch(stmt[vIdx:])
	if am == nil {
		return nil
	}
	aliasCols := strings.Split(am[1], ",")
	for i := range aliasCols {
		aliasCols[i] = strings.TrimSpace(aliasCols[i])
	}
	valsEnd := strings.Index(stmt[vIdx:], am[0])
	tuples := valuesTuples(stmt[vIdx : vIdx+valsEnd])

	// lista del SELECT entre SELECT y FROM
	selIdx := strings.Index(upper, "SELECT")
	fromIdx := strings.Index(upper, "FROM")
	if selIdx < 0 || fromIdx < 0 {
		return nil
	}
	selItems := splitTopLevel(stmt[selIdx+6:fromIdx], '\'')

	var out []Product
	for _, t := range tuples {
		p := &Product{Origin: "internal", BaseUnit: "kg", Source: fname}
		for i, col := range cols {
			if i >= len(selItems) {
				break
			}
			v := strings.TrimSpace(selItems[i])
			if strings.HasPrefix(v, "p.") {
				// resolver contra la tupla por nombre de alias
				field := v[2:]
				pos := -1
				for j, ac := range aliasCols {
					if ac == field {
						pos = j
						break
					}
				}
				if pos >= 0 && pos < len(t) {
					setField(p, col, t[pos])
				}
			} else {
				setField(p, col, v)
			}
		}
		if p.Name != "" {
			out = append(out, *p)
		}
	}
	return out
}

// ---------- salida ----------

func sqlEscape(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}

func main() {
	outDir := flag.String("out", "exports", "directorio de salida")
	flag.Parse()

	seedProducts, corrections, err := parseSeedProducts("internal/db/seed.go")
	if err != nil {
		fmt.Fprintln(os.Stderr, "error leyendo seed.go:", err)
		os.Exit(1)
	}
	migProducts, err := parseMigrations("internal/db/migrations")
	if err != nil {
		fmt.Fprintln(os.Stderr, "error leyendo migraciones:", err)
		os.Exit(1)
	}

	// Dedup por nombre (primero gana, como WHERE NOT EXISTS); seed.go primero
	// porque es el seed permanente mas reciente.
	seen := map[string]bool{}
	var catalog []Product
	dupes := 0
	for _, p := range append(seedProducts, migProducts...) {
		key := strings.ToLower(strings.TrimSpace(p.Name))
		if key == "" || seen[key] {
			if key != "" {
				dupes++
			}
			continue
		}
		seen[key] = true
		catalog = append(catalog, p)
	}

	// Aplicar correcciones de seed.go (precio/kg, peso, etc.)
	corrByName := map[string]Product{}
	for _, c := range corrections {
		corrByName[strings.ToLower(c.Name)] = c
	}
	for i := range catalog {
		if c, ok := corrByName[strings.ToLower(catalog[i].Name)]; ok {
			catalog[i].BasePrice = c.BasePrice
			catalog[i].BaseUnit = c.BaseUnit
			catalog[i].WeightKg = c.WeightKg
			catalog[i].PricePerUnit = c.PricePerUnit
			if c.EnergyInputs > 0 {
				catalog[i].EnergyInputs = c.EnergyInputs
			}
		}
		catalog[i].EnergyTotal = catalog[i].EnergyDirect + catalog[i].EnergyHuman + catalog[i].EnergyInputs + catalog[i].EnergyAmort
	}

	sort.Slice(catalog, func(i, j int) bool {
		if catalog[i].ParentCategory != catalog[j].ParentCategory {
			return catalog[i].ParentCategory < catalog[j].ParentCategory
		}
		if catalog[i].Category != catalog[j].Category {
			return catalog[i].Category < catalog[j].Category
		}
		return catalog[i].Name < catalog[j].Name
	})

	if err := os.MkdirAll(*outDir, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	// JSON
	jb, _ := json.MarshalIndent(catalog, "", "  ")
	if err := os.WriteFile(filepath.Join(*outDir, "catalogo-productos.json"), jb, 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	// SQL dump
	var sb strings.Builder
	sb.WriteString("-- Dump del catalogo de productos (pre-reestructuracion)\n")
	sb.WriteString("-- Generado por cmd/export-catalog desde seed.go + migraciones\n")
	sb.WriteString("-- Fecha: 2026-09-24 | Total: " + strconv.Itoa(len(catalog)) + " productos\n\n")
	sb.WriteString("BEGIN;\n\n")
	for _, p := range catalog {
		fmt.Fprintf(&sb,
			"INSERT INTO products (node_domain, name, parent_category, category, subcategory, origin, unit, description, badge, image_url, product_code, price_per_unit, price_per_kg, base_unit, weight_kg, energy_direct, energy_human, energy_inputs, energy_amortization, is_approved, is_system, is_composite) VALUES\n  ('__NODE__', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %t, %t, %t);\n\n",
			sqlEscape(p.Name), sqlEscape(p.ParentCategory), sqlEscape(p.Category), sqlEscape(p.Subcategory),
			sqlEscape(p.Origin), sqlEscape(p.Unit), sqlEscape(p.Description), sqlEscape(p.Badge), sqlEscape(p.ImageURL),
			sqlEscape(p.ProductCode), fnum(p.PricePerUnit), fnum(p.BasePrice), sqlEscape(p.BaseUnit), fnum(p.WeightKg),
			fnum(p.EnergyDirect), fnum(p.EnergyHuman), fnum(p.EnergyInputs), fnum(p.EnergyAmort),
			p.IsApproved, p.IsSystem, p.IsComposite)
	}
	sb.WriteString("COMMIT;\n")
	if err := os.WriteFile(filepath.Join(*outDir, "catalogo-productos.sql"), []byte(sb.String()), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	// Markdown
	var mb strings.Builder
	mb.WriteString("# Catalogo de Productos — Referencia Historica\n\n")
	mb.WriteString("Exportado antes de la reestructuracion al catalogo federado de materia prima.\n\n")
	fmt.Fprintf(&mb, "**Total: %d productos unicos** (duplicados omitidos: %d)\n\n", len(catalog), dupes)
	curParent, curCat := "", ""
	for _, p := range catalog {
		if p.ParentCategory != curParent {
			curParent = p.ParentCategory
			curCat = ""
			fmt.Fprintf(&mb, "\n## %s\n", orDash(curParent))
		}
		if p.Category != curCat {
			curCat = p.Category
			fmt.Fprintf(&mb, "\n### %s\n\n", orDash(curCat))
		}
		fmt.Fprintf(&mb, "- **%s**", p.Name)
		var meta []string
		if p.Subcategory != "" {
			meta = append(meta, p.Subcategory)
		}
		if p.Unit != "" {
			meta = append(meta, "unidad: "+p.Unit)
		}
		if p.PricePerUnit > 0 {
			meta = append(meta, fmt.Sprintf("%.2f TQ", p.PricePerUnit))
		}
		if p.BasePrice > 0 {
			meta = append(meta, fmt.Sprintf("base %.2f TQ/%s", p.BasePrice, p.BaseUnit))
		}
		if p.WeightKg > 0 {
			meta = append(meta, fmt.Sprintf("%.3f %s", p.WeightKg, p.BaseUnit))
		}
		if p.EnergyTotal > 0 {
			meta = append(meta, fmt.Sprintf("E=%.2f kWh", p.EnergyTotal))
		}
		if p.IsComposite {
			meta = append(meta, "compuesto")
		}
		if len(meta) > 0 {
			mb.WriteString(" — " + strings.Join(meta, " · "))
		}
		mb.WriteString("\n")
		if p.Description != "" {
			fmt.Fprintf(&mb, "  - %s\n", p.Description)
		}
	}
	if err := os.WriteFile(filepath.Join(*outDir, "catalogo-productos.md"), []byte(mb.String()), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	fmt.Printf("Exportados %d productos (duplicados omitidos: %d) → %s/\n", len(catalog), dupes, *outDir)
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "(sin categoria)"
	}
	return s
}

func fnum(f float64) string {
	if f == float64(int64(f)) {
		return strconv.FormatInt(int64(f), 10)
	}
	return strconv.FormatFloat(f, 'f', -1, 64)
}
