package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"federated-credit-node/internal/db"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type contentTranslationSource struct {
	TranslationKey  string                 `json:"translation_key"`
	NodeDomain      string                 `json:"node_domain"`
	EntityType      string                 `json:"entity_type"`
	EntityID        string                 `json:"entity_id"`
	FieldName       string                 `json:"field_name"`
	SourceLanguage  string                 `json:"source_language"`
	SourceText      string                 `json:"source_text"`
	SourceHash      string                 `json:"source_hash"`
	Context         map[string]interface{} `json:"context"`
	Value           string                 `json:"value"`
	TranslationHash string                 `json:"translation_source_hash"`
	Status          string                 `json:"status"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

func normalizeLanguageCode(lang string) string {
	lang = strings.TrimSpace(strings.Split(lang, ",")[0])
	if i := strings.Index(lang, ";"); i >= 0 {
		lang = lang[:i]
	}
	parts := strings.Split(strings.ReplaceAll(lang, "_", "-"), "-")
	if len(parts) == 0 || parts[0] == "" {
		return ""
	}
	parts[0] = strings.ToLower(parts[0])
	for i := 1; i < len(parts); i++ {
		if len(parts[i]) == 2 {
			parts[i] = strings.ToUpper(parts[i])
		} else {
			parts[i] = strings.ToLower(parts[i])
		}
	}
	return strings.Join(parts, "-")
}

func defaultLanguage(ctx context.Context, pool *pgxpool.Pool, nodeDomain string) string {
	var lang string
	if nodeDomain != "" && nodeDomain != "__GLOBAL__" {
		_ = pool.QueryRow(ctx, `SELECT default_language FROM node_config WHERE node_domain = $1 LIMIT 1`, nodeDomain).Scan(&lang)
	}
	if lang == "" {
		_ = pool.QueryRow(ctx, `SELECT code FROM languages WHERE is_default = true AND enabled = true LIMIT 1`).Scan(&lang)
	}
	if lang == "" {
		lang = "es"
	}
	return normalizeLanguageCode(lang)
}

func enabledLanguage(ctx context.Context, pool *pgxpool.Pool, lang string) bool {
	var enabled bool
	_ = pool.QueryRow(ctx, `SELECT enabled FROM languages WHERE LOWER(code) = LOWER($1)`, lang).Scan(&enabled)
	return enabled
}

func resolveRequestLanguages(r *http.Request, pool *pgxpool.Pool, nodeDomain string) (string, string) {
	fallback := defaultLanguage(r.Context(), pool, nodeDomain)
	requested := normalizeLanguageCode(r.URL.Query().Get("lang"))
	if requested == "" {
		requested = normalizeLanguageCode(r.Header.Get("Accept-Language"))
	}
	if requested == "" {
		return fallback, fallback
	}
	if enabledLanguage(r.Context(), pool, requested) {
		return requested, fallback
	}
	if i := strings.Index(requested, "-"); i > 0 {
		primary := requested[:i]
		if enabledLanguage(r.Context(), pool, primary) {
			return primary, fallback
		}
	}
	return fallback, fallback
}

func upsertContentSource(ctx context.Context, pool *pgxpool.Pool, nodeDomain, entityType, entityID, fieldName, sourceText string, metadata map[string]interface{}) (string, error) {
	lang := defaultLanguage(ctx, pool, nodeDomain)
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return "", err
	}
	var key string
	err = pool.QueryRow(ctx, `SELECT upsert_content_translation_source($1, $2, $3, $4, $5, $6, $7::jsonb)`,
		nodeDomain, entityType, entityID, fieldName, lang, sourceText, string(metadataJSON)).Scan(&key)
	return key, err
}

func localizedContentValue(ctx context.Context, pool *pgxpool.Pool, nodeDomain, entityType, entityID, fieldName, sourceText, lang string) (string, string) {
	key, err := upsertContentSource(ctx, pool, nodeDomain, entityType, entityID, fieldName, sourceText, nil)
	if err != nil {
		return sourceText, "fallback"
	}
	fallback := defaultLanguage(ctx, pool, nodeDomain)
	lang = normalizeLanguageCode(lang)
	if lang == "" || strings.EqualFold(lang, fallback) {
		return sourceText, "source"
	}
	var value string
	err = pool.QueryRow(ctx, `
		SELECT ct.value
		FROM content_translations ct
		JOIN content_translation_sources s ON s.translation_key = ct.translation_key
		WHERE ct.translation_key = $1 AND LOWER(ct.language) = LOWER($2)
		  AND ct.value <> '' AND ct.source_hash = s.source_hash`, key, lang).Scan(&value)
	if err != nil {
		return sourceText, "fallback"
	}
	return value, "translated"
}

func localizedContentValues(ctx context.Context, pool *pgxpool.Pool, keys []string, lang string) map[string]string {
	values := map[string]string{}
	if len(keys) == 0 {
		return values
	}
	rows, err := pool.Query(ctx, `
		SELECT ct.translation_key, ct.value
		FROM content_translations ct
		JOIN content_translation_sources s ON s.translation_key = ct.translation_key
		WHERE ct.translation_key = ANY($1) AND LOWER(ct.language) = LOWER($2)
		  AND ct.value <> '' AND ct.source_hash = s.source_hash`, keys, normalizeLanguageCode(lang))
	if err != nil {
		return values
	}
	defer rows.Close()
	for rows.Next() {
		var key, value string
		if rows.Scan(&key, &value) == nil {
			values[key] = value
		}
	}
	return values
}

func registerEntityFields(ctx context.Context, pool *pgxpool.Pool, nodeDomain, entityType, entityID string, fields map[string]string, metadata map[string]interface{}) {
	for field, value := range fields {
		_, _ = upsertContentSource(ctx, pool, nodeDomain, entityType, entityID, field, value, metadata)
	}
}

func saveSubmittedTranslations(ctx context.Context, pool *pgxpool.Pool, nodeDomain, entityType, entityID string, allowedFields map[string]string, translations map[string]map[string]string, userID uuid.UUID) {
	baseLang := defaultLanguage(ctx, pool, nodeDomain)
	for lang, fields := range translations {
		if strings.EqualFold(normalizeLanguageCode(lang), baseLang) || !enabledLanguage(ctx, pool, lang) {
			continue
		}
		for field, value := range fields {
			if _, ok := allowedFields[field]; ok {
				_ = saveContentTranslation(ctx, pool, entityType+":"+entityID+":"+field, lang, value, userID)
			}
		}
	}
}

func ensureProductTaxonomySources(ctx context.Context, pool *pgxpool.Pool, nodeDomain, parent, category, subcategory string) {
	terms := []struct {
		level, parent, value string
	}{
		{"parent", "", parent},
		{"category", parent, category},
		{"subcategory", parent + "|" + category, subcategory},
	}
	for _, term := range terms {
		if strings.TrimSpace(term.value) == "" {
			continue
		}
		var id string
		err := pool.QueryRow(ctx, `
			INSERT INTO product_taxonomy_terms(node_domain, level, parent_source_value, source_value)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT(node_domain, level, parent_source_value, source_value)
			DO UPDATE SET is_active = true, updated_at = NOW()
			RETURNING id::text`, nodeDomain, term.level, term.parent, term.value).Scan(&id)
		if err == nil {
			_, _ = upsertContentSource(ctx, pool, nodeDomain, "product_taxonomy", id, "label", term.value, map[string]interface{}{"level": term.level, "parent": term.parent})
		}
	}
}

func localizeEntityMaps(ctx context.Context, pool *pgxpool.Pool, items []map[string]interface{}, entityType, lang, fallbackLang string, fields ...string) {
	if len(items) == 0 || strings.EqualFold(lang, fallbackLang) {
		return
	}
	keys := make([]string, 0, len(items)*len(fields))
	for _, item := range items {
		id := fmt.Sprint(item["id"])
		for _, field := range fields {
			keys = append(keys, entityType+":"+id+":"+field)
		}
	}
	values := localizedContentValues(ctx, pool, keys, lang)
	for _, item := range items {
		id := fmt.Sprint(item["id"])
		for _, field := range fields {
			if value := values[entityType+":"+id+":"+field]; value != "" {
				item[field] = value
			}
		}
	}
}

func refreshContentTranslationSources(ctx context.Context, pool *pgxpool.Pool, lang string) {
	queries := []string{
		`SELECT upsert_content_translation_source(node_domain, 'public_page', id::text, 'title', $1, title, jsonb_build_object('label', title, 'editor', 'page')) FROM public_pages`,
		`SELECT upsert_content_translation_source(node_domain, 'public_page', id::text, 'subtitle', $1, COALESCE(subtitle, ''), jsonb_build_object('label', title, 'editor', 'page')) FROM public_pages`,
		`SELECT upsert_content_translation_source(node_domain, 'public_page', id::text, 'content', $1, content, jsonb_build_object('label', title, 'editor', 'page')) FROM public_pages`,
		`SELECT upsert_content_translation_source(node_domain, 'product', id::text, 'name', $1, name, jsonb_build_object('label', name)) FROM products`,
		`SELECT upsert_content_translation_source(node_domain, 'product', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', name)) FROM products`,
		`SELECT upsert_content_translation_source(node_domain, 'product', id::text, 'badge', $1, COALESCE(badge, ''), jsonb_build_object('label', name)) FROM products`,
		`SELECT upsert_content_translation_source(node_domain, 'calculator_parameter', id::text, 'name', $1, name, jsonb_build_object('label', name)) FROM calculator_parameters`,
		`SELECT upsert_content_translation_source(node_domain, 'calculator_parameter', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', name)) FROM calculator_parameters`,
		`SELECT upsert_content_translation_source(node_domain, 'calculator_category', id::text, 'name', $1, name, jsonb_build_object('label', name)) FROM calculator_categories`,
		`SELECT upsert_content_translation_source(node_domain, 'governance_rule', id::text, 'title', $1, title, jsonb_build_object('label', title)) FROM governance_rules`,
		`SELECT upsert_content_translation_source(node_domain, 'governance_rule', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', title)) FROM governance_rules`,
		`SELECT upsert_content_translation_source(node_domain, 'member_level', id, 'name', $1, name, jsonb_build_object('label', name)) FROM member_levels`,
		`SELECT upsert_content_translation_source(node_domain, 'member_level', id, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', name)) FROM member_levels`,
		`SELECT upsert_content_translation_source(node_domain, 'organization_level', id::text, 'name', $1, name, jsonb_build_object('label', name)) FROM organization_levels`,
		`SELECT upsert_content_translation_source(node_domain, 'organization_level', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', name)) FROM organization_levels`,
		`SELECT upsert_content_translation_source(node_domain, 'assembly_session', id::text, 'title', $1, title, '{}'::jsonb) FROM assembly_sessions`,
		`SELECT upsert_content_translation_source(node_domain, 'assembly_session', id::text, 'description', $1, COALESCE(description, ''), '{}'::jsonb) FROM assembly_sessions`,
		`SELECT upsert_content_translation_source(node_domain, 'assembly_session', id::text, 'minutes', $1, COALESCE(minutes, ''), '{}'::jsonb) FROM assembly_sessions`,
		`SELECT upsert_content_translation_source(node_domain, 'assembly_session_scoped', id::text, 'title', $1, title, '{}'::jsonb) FROM assembly_sessions_scoped`,
		`SELECT upsert_content_translation_source(node_domain, 'assembly_session_scoped', id::text, 'description', $1, COALESCE(description, ''), '{}'::jsonb) FROM assembly_sessions_scoped`,
		`SELECT upsert_content_translation_source(node_domain, 'assembly_session_scoped', id::text, 'minutes', $1, COALESCE(minutes, ''), '{}'::jsonb) FROM assembly_sessions_scoped`,
		`SELECT upsert_content_translation_source(s.node_domain, 'assembly_decision', d.id::text, 'description', $1, d.description, '{}'::jsonb) FROM assembly_decisions d JOIN assembly_sessions s ON s.id = d.assembly_id`,
		`SELECT upsert_content_translation_source(s.node_domain, 'assembly_decision_scoped', d.id::text, 'description', $1, d.description, '{}'::jsonb) FROM assembly_decisions_scoped d JOIN assembly_sessions_scoped s ON s.id = d.session_id`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'public_proposal', id::text, 'title', $1, title, '{}'::jsonb) FROM public_proposals`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'public_proposal', id::text, 'description', $1, description, '{}'::jsonb) FROM public_proposals`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'public_proposal', id::text, 'admin_notes', $1, COALESCE(admin_notes, ''), '{}'::jsonb) FROM public_proposals`,
		`SELECT upsert_content_translation_source(node_domain, 'notification', id::text, 'title', $1, title, '{}'::jsonb) FROM notifications`,
		`SELECT upsert_content_translation_source(node_domain, 'notification', id::text, 'message', $1, COALESCE(message, ''), '{}'::jsonb) FROM notifications`,
		`SELECT upsert_content_translation_source(node_domain, 'department', id::text, 'name', $1, name, jsonb_build_object('label', name)) FROM departments`,
		`SELECT upsert_content_translation_source(node_domain, 'department', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', name)) FROM departments`,
		`SELECT upsert_content_translation_source(node_domain, 'organization', id::text, 'display_name', $1, COALESCE(display_name, username), jsonb_build_object('label', COALESCE(display_name, username))) FROM users WHERE account_type IN ('organization', 'public_institution')`,
		`SELECT upsert_content_translation_source(d.node_domain, 'department_role', dr.id::text, 'name', $1, dr.name, jsonb_build_object('label', dr.name)) FROM department_roles dr JOIN departments d ON d.id = dr.department_id`,
		`SELECT upsert_content_translation_source(d.node_domain, 'department_role', dr.id::text, 'description', $1, COALESCE(dr.description, ''), jsonb_build_object('label', dr.name)) FROM department_roles dr JOIN departments d ON d.id = dr.department_id`,
		`SELECT upsert_content_translation_source(node_domain, 'organization_service', id::text, 'name', $1, name, jsonb_build_object('label', name)) FROM organization_services`,
		`SELECT upsert_content_translation_source(node_domain, 'organization_service', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', name)) FROM organization_services`,
		`SELECT upsert_content_translation_source(node_domain, 'organization_service', id::text, 'obligations', $1, COALESCE(obligations, ''), jsonb_build_object('label', name)) FROM organization_services`,
		`SELECT upsert_content_translation_source(node_domain, 'organization_service', id::text, 'rights', $1, COALESCE(rights, ''), jsonb_build_object('label', name)) FROM organization_services`,
		`SELECT upsert_content_translation_source(node_domain, 'organization_service', id::text, 'duties', $1, COALESCE(duties, ''), jsonb_build_object('label', name)) FROM organization_services`,
		`SELECT upsert_content_translation_source(node_domain, 'store_item', id::text, 'product_name', $1, product_name, jsonb_build_object('label', product_name)) FROM store_items`,
		`SELECT upsert_content_translation_source(node_domain, 'store_item', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', product_name)) FROM store_items`,
		`SELECT upsert_content_translation_source(node_domain, 'store_item', id::text, 'extra_description', $1, COALESCE(extra_description, ''), jsonb_build_object('label', product_name)) FROM store_items`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'node_faith_profile', id, 'name', $1, name, jsonb_build_object('label', name)) FROM node_faith_profiles`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'node_faith_profile', id, 'description', $1, description, jsonb_build_object('label', name)) FROM node_faith_profiles`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'node_faith_profile', id, 'default_rules', $1, default_rules, jsonb_build_object('label', name)) FROM node_faith_profiles`,
		`SELECT upsert_content_translation_source(node_domain, 'profile_product_prohibition', id::text, 'product_name', $1, product_name, '{}'::jsonb) FROM profile_product_prohibitions`,
		`SELECT upsert_content_translation_source(node_domain, 'profile_product_prohibition', id::text, 'product_category', $1, COALESCE(product_category, ''), '{}'::jsonb) FROM profile_product_prohibitions`,
		`SELECT upsert_content_translation_source(node_domain, 'profile_product_prohibition', id::text, 'reason', $1, COALESCE(reason, ''), '{}'::jsonb) FROM profile_product_prohibitions`,
		`SELECT upsert_content_translation_source(node_domain, 'catalog_label', id::text, 'name', $1, name, jsonb_build_object('label', name)) FROM catalog_labels`,
		`SELECT upsert_content_translation_source(node_domain, 'catalog_label', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', name)) FROM catalog_labels`,
		`SELECT upsert_content_translation_source(node_domain, 'catalog_dietary_rule', id::text, 'category_name', $1, category_name, '{}'::jsonb) FROM catalog_dietary_rules`,
		`SELECT upsert_content_translation_source(node_domain, 'catalog_dietary_rule', id::text, 'reason', $1, COALESCE(reason, ''), '{}'::jsonb) FROM catalog_dietary_rules`,
		`SELECT upsert_content_translation_source(node_domain, 'commerce_schedule', id::text, 'name', $1, name, '{}'::jsonb) FROM commerce_schedule`,
		`SELECT upsert_content_translation_source(node_domain, 'commerce_schedule', id::text, 'block_message', $1, block_message, '{}'::jsonb) FROM commerce_schedule`,
		`SELECT upsert_content_translation_source(node_domain, 'public_settings', node_domain, 'commerce_hours_message', $1, COALESCE(commerce_hours_message, ''), '{}'::jsonb) FROM public_settings`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'nfc_card_driver', id::text, 'display_name', $1, display_name, jsonb_build_object('label', display_name)) FROM nfc_card_drivers`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'nfc_card_driver', id::text, 'description', $1, description, jsonb_build_object('label', display_name)) FROM nfc_card_drivers`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'nfc_card_driver', id::text, 'manufacturer', $1, manufacturer, jsonb_build_object('label', display_name)) FROM nfc_card_drivers`,
		`SELECT upsert_content_translation_source(node_domain, 'community_work_session', id::text, 'name', $1, name, jsonb_build_object('label', name)) FROM community_work_sessions`,
		`SELECT upsert_content_translation_source(node_domain, 'community_work_session', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', name)) FROM community_work_sessions`,
		`SELECT upsert_content_translation_source(node_domain, 'community_work_session', id::text, 'location', $1, COALESCE(location, ''), jsonb_build_object('label', name)) FROM community_work_sessions`,
		`SELECT upsert_content_translation_source(node_domain, 'community_work_session', id::text, 'outputs', $1, COALESCE(outputs, ''), jsonb_build_object('label', name)) FROM community_work_sessions`,
		`SELECT upsert_content_translation_source(s.node_domain, 'community_work_task', t.id::text, 'name', $1, t.name, jsonb_build_object('label', t.name)) FROM community_work_tasks t JOIN community_work_sessions s ON s.id = t.session_id`,
		`SELECT upsert_content_translation_source(s.node_domain, 'community_work_task', t.id::text, 'description', $1, COALESCE(t.description, ''), jsonb_build_object('label', t.name)) FROM community_work_tasks t JOIN community_work_sessions s ON s.id = t.session_id`,
		`SELECT upsert_content_translation_source(s.node_domain, 'community_work_task', t.id::text, 'required_skill', $1, COALESCE(t.required_skill, ''), jsonb_build_object('label', t.name)) FROM community_work_tasks t JOIN community_work_sessions s ON s.id = t.session_id`,
		`SELECT upsert_content_translation_source(node_domain, 'organization_profile', organization_id::text, 'description', $1, COALESCE(description, ''), '{}'::jsonb) FROM organization_profiles`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'federation_constant', key, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', key)) FROM federation_constants`,
		`SELECT upsert_content_translation_source(node_domain, 'assembly_config', id::text, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', proposal_type)) FROM assembly_config`,
		`SELECT upsert_content_translation_source('__GLOBAL__', 'federation_node_info', node_domain, 'description', $1, COALESCE(description, ''), jsonb_build_object('label', node_domain)) FROM federation_node_info`,
	}
	for _, query := range queries {
		_, _ = pool.Exec(ctx, query, lang)
	}
}

func (h *SystemHandler) listContentTranslationSources(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	lang, sourceLang := resolveRequestLanguages(r, h.Pool, nodeDomain)
	refreshContentTranslationSources(r.Context(), h.Pool, sourceLang)
	limit := 100
	offset := 0
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 500 {
		limit = n
	}
	if n, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && n >= 0 {
		offset = n
	}

	args := []interface{}{lang, nodeDomain}
	where := []string{"s.is_active = true", "(s.node_domain = $2 OR s.node_domain = '__GLOBAL__')"}
	if entityType := strings.TrimSpace(r.URL.Query().Get("entity_type")); entityType != "" {
		args = append(args, entityType)
		where = append(where, fmt.Sprintf("s.entity_type = $%d", len(args)))
	}
	if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
		args = append(args, "%"+search+"%")
		where = append(where, fmt.Sprintf("(s.translation_key ILIKE $%d OR s.source_text ILIKE $%d OR COALESCE(ct.value, '') ILIKE $%d)", len(args), len(args), len(args)))
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "missing" {
		where = append(where, "(ct.id IS NULL OR ct.value = '')")
	} else if status == "stale" {
		where = append(where, "ct.id IS NOT NULL AND ct.value <> '' AND ct.source_hash <> s.source_hash")
	} else if status == "translated" {
		where = append(where, "ct.id IS NOT NULL AND ct.value <> '' AND ct.source_hash = s.source_hash")
	}

	countQuery := `SELECT COUNT(*) FROM content_translation_sources s LEFT JOIN content_translations ct ON ct.translation_key = s.translation_key AND LOWER(ct.language) = LOWER($1) WHERE ` + strings.Join(where, " AND ")
	var total int
	if err := h.Pool.QueryRow(r.Context(), countQuery, args...).Scan(&total); err != nil {
		writeError(w, 500, err.Error())
		return
	}

	args = append(args, limit, offset)
	query := `
		SELECT s.translation_key, s.node_domain, s.entity_type, s.entity_id, s.field_name,
		       s.source_language, s.source_text, s.source_hash, s.context,
		       COALESCE(ct.value, ''), COALESCE(ct.source_hash, ''), s.updated_at
		FROM content_translation_sources s
		LEFT JOIN content_translations ct ON ct.translation_key = s.translation_key AND LOWER(ct.language) = LOWER($1)
		WHERE ` + strings.Join(where, " AND ") + fmt.Sprintf(" ORDER BY s.entity_type, s.entity_id, s.field_name LIMIT $%d OFFSET $%d", len(args)-1, len(args))
	rows, err := h.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()

	items := []contentTranslationSource{}
	for rows.Next() {
		var item contentTranslationSource
		var contextJSON []byte
		if err := rows.Scan(&item.TranslationKey, &item.NodeDomain, &item.EntityType, &item.EntityID,
			&item.FieldName, &item.SourceLanguage, &item.SourceText, &item.SourceHash, &contextJSON,
			&item.Value, &item.TranslationHash, &item.UpdatedAt); err != nil {
			continue
		}
		_ = json.Unmarshal(contextJSON, &item.Context)
		switch {
		case item.Value == "":
			item.Status = "missing"
		case item.TranslationHash != item.SourceHash:
			item.Status = "stale"
		default:
			item.Status = "translated"
		}
		items = append(items, item)
	}
	writeJSON(w, 200, map[string]interface{}{"language": lang, "items": items, "total": total, "limit": limit, "offset": offset})
}

func (h *SystemHandler) getContentTranslationSource(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	key := chi.URLParam(r, "key")
	var item contentTranslationSource
	var contextJSON []byte
	err := h.Pool.QueryRow(r.Context(), `
		SELECT translation_key, node_domain, entity_type, entity_id, field_name,
		       source_language, source_text, source_hash, context, updated_at
		FROM content_translation_sources
		WHERE translation_key = $1 AND is_active = true AND (node_domain = $2 OR node_domain = '__GLOBAL__')`, key, nodeDomain).
		Scan(&item.TranslationKey, &item.NodeDomain, &item.EntityType, &item.EntityID, &item.FieldName,
			&item.SourceLanguage, &item.SourceText, &item.SourceHash, &contextJSON, &item.UpdatedAt)
	if err != nil {
		writeError(w, 404, "translation source not found")
		return
	}
	_ = json.Unmarshal(contextJSON, &item.Context)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT language, value, source_hash, translated_by, updated_at
		FROM content_translations WHERE translation_key = $1 ORDER BY language`, key)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	translations := []map[string]interface{}{}
	for rows.Next() {
		var language, value, sourceHash string
		var translatedBy *uuid.UUID
		var updatedAt time.Time
		if err := rows.Scan(&language, &value, &sourceHash, &translatedBy, &updatedAt); err == nil {
			translations = append(translations, map[string]interface{}{
				"language": language, "value": value, "source_hash": sourceHash,
				"status":        map[bool]string{true: "translated", false: "stale"}[sourceHash == item.SourceHash],
				"translated_by": translatedBy, "updated_at": updatedAt,
			})
		}
	}
	historyRows, err := h.Pool.Query(r.Context(), `
		SELECT language, COALESCE(old_value, ''), COALESCE(new_value, ''), source_hash, changed_by, changed_at
		FROM content_translation_history
		WHERE translation_key = $1
		ORDER BY changed_at DESC LIMIT 100`, key)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer historyRows.Close()
	history := []map[string]interface{}{}
	for historyRows.Next() {
		var language, oldValue, newValue, historyHash string
		var changedBy *uuid.UUID
		var changedAt time.Time
		if err := historyRows.Scan(&language, &oldValue, &newValue, &historyHash, &changedBy, &changedAt); err == nil {
			history = append(history, map[string]interface{}{
				"language": language, "old_value": oldValue, "new_value": newValue,
				"source_hash": historyHash, "changed_by": changedBy, "changed_at": changedAt,
			})
		}
	}
	writeJSON(w, 200, map[string]interface{}{"source": item, "translations": translations, "history": history})
}

// getContentTranslationValue returns a safe, ready-to-render value for one
// source and language. Empty or stale translations intentionally fall back to
// the original text instead of leaking an obsolete translation to a consumer.
func (h *SystemHandler) getContentTranslationValue(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	key := chi.URLParam(r, "key")
	requested := normalizeLanguageCode(chi.URLParam(r, "lang"))
	if requested == "" {
		writeError(w, 400, "language is required")
		return
	}
	var sourceText, sourceLanguage, sourceHash string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT source_text, source_language, source_hash
		FROM content_translation_sources
		WHERE translation_key = $1 AND is_active = true
		  AND (node_domain = $2 OR node_domain = '__GLOBAL__')`, key, nodeDomain).
		Scan(&sourceText, &sourceLanguage, &sourceHash)
	if err != nil {
		writeError(w, 404, "translation source not found")
		return
	}

	value, status := sourceText, "source"
	if !strings.EqualFold(requested, sourceLanguage) {
		var translated, translatedHash string
		err = h.Pool.QueryRow(r.Context(), `SELECT value, source_hash FROM content_translations
			WHERE translation_key = $1 AND LOWER(language) = LOWER($2)`, key, requested).Scan(&translated, &translatedHash)
		switch {
		case err != nil || translated == "":
			status = "fallback"
		case translatedHash != sourceHash:
			status = "stale"
		default:
			value, status = translated, "translated"
		}
	}
	writeJSON(w, 200, map[string]interface{}{
		"translation_key": key, "value": value,
		"_i18n": map[string]interface{}{
			"requested_language": requested, "resolved_language": map[bool]string{true: sourceLanguage, false: requested}[status != "translated"],
			"source_language": sourceLanguage, "is_fallback": status == "fallback" || status == "stale", "status": status,
		},
	})
}

func saveContentTranslation(ctx context.Context, pool *pgxpool.Pool, key, lang, value string, userID uuid.UUID) error {
	var sourceHash string
	if err := pool.QueryRow(ctx, `SELECT source_hash FROM content_translation_sources WHERE translation_key = $1 AND is_active = true`, key).Scan(&sourceHash); err != nil {
		return err
	}
	lang = normalizeLanguageCode(lang)
	_, err := pool.Exec(ctx, `
		INSERT INTO content_translations(translation_key, language, value, source_hash, translated_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (translation_key, language) DO UPDATE SET
		  value = EXCLUDED.value, source_hash = EXCLUDED.source_hash,
		  translated_by = EXCLUDED.translated_by, updated_at = NOW()`,
		key, lang, value, sourceHash, userID)
	if err != nil {
		return err
	}
	return mirrorLegacyContentTranslation(ctx, pool, key, lang, value)
}

func mirrorLegacyContentTranslation(ctx context.Context, pool *pgxpool.Pool, key, lang, value string) error {
	parts := strings.SplitN(key, ":", 3)
	if len(parts) != 3 {
		return nil
	}
	entityType, entityID, field := parts[0], parts[1], parts[2]
	var query string
	switch entityType + ":" + field {
	case "public_page:title":
		query = `INSERT INTO public_page_translations(page_id, language, title, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(page_id, language) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()`
	case "public_page:subtitle":
		query = `INSERT INTO public_page_translations(page_id, language, subtitle, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(page_id, language) DO UPDATE SET subtitle = EXCLUDED.subtitle, updated_at = NOW()`
	case "public_page:content":
		query = `INSERT INTO public_page_translations(page_id, language, content, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(page_id, language) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`
	case "public_settings:site_title":
		query = `INSERT INTO public_settings_translations(node_domain, language, site_title, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT(node_domain, language) DO UPDATE SET site_title = EXCLUDED.site_title, updated_at = NOW()`
	case "public_settings:site_subtitle":
		query = `INSERT INTO public_settings_translations(node_domain, language, site_subtitle, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT(node_domain, language) DO UPDATE SET site_subtitle = EXCLUDED.site_subtitle, updated_at = NOW()`
	case "admission_form:title":
		query = `INSERT INTO admission_form_translations(node_domain, language, title, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT(node_domain, language) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()`
	case "admission_form:subtitle":
		query = `INSERT INTO admission_form_translations(node_domain, language, subtitle, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT(node_domain, language) DO UPDATE SET subtitle = EXCLUDED.subtitle, updated_at = NOW()`
	case "admission_form:schema":
		query = `INSERT INTO admission_form_translations(node_domain, language, schema, updated_at) VALUES ($1, $2, $3::jsonb, NOW()) ON CONFLICT(node_domain, language) DO UPDATE SET schema = EXCLUDED.schema, updated_at = NOW()`
	case "member_level:name":
		query = `INSERT INTO member_level_translations(level_id, language, name, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT(level_id, language) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`
	case "member_level:description":
		query = `INSERT INTO member_level_translations(level_id, language, description, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT(level_id, language) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()`
	case "organization_level:name":
		query = `INSERT INTO organization_level_translations(level_id, language, name, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(level_id, language) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`
	case "organization_level:description":
		query = `INSERT INTO organization_level_translations(level_id, language, description, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(level_id, language) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()`
	case "governance_rule:title":
		query = `INSERT INTO governance_rule_translations(rule_id, language, title, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(rule_id, language) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()`
	case "governance_rule:description":
		query = `INSERT INTO governance_rule_translations(rule_id, language, description, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(rule_id, language) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()`
	case "calculator_parameter:name":
		query = `INSERT INTO calculator_parameter_translations(parameter_id, language, name, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(parameter_id, language) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`
	case "calculator_parameter:description":
		query = `INSERT INTO calculator_parameter_translations(parameter_id, language, description, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(parameter_id, language) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()`
	case "calculator_category:name":
		query = `INSERT INTO calculator_category_translations(category_id, language, name, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(category_id, language) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`
	case "calculator_category:description":
		query = `INSERT INTO calculator_category_translations(category_id, language, description, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(category_id, language) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()`
	case "product:name":
		query = `INSERT INTO product_translations(product_id, language, name, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(product_id, language) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`
	case "product:description":
		query = `INSERT INTO product_translations(product_id, language, description, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(product_id, language) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()`
	case "assembly_config:description":
		query = `INSERT INTO assembly_config_translations(config_id, language, description, updated_at) VALUES ($1::uuid, $2, $3, NOW()) ON CONFLICT(config_id, language) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()`
	case "federation_constant:description":
		query = `INSERT INTO federation_constant_translations(constant_key, language, description, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT(constant_key, language) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()`
	default:
		return nil
	}
	_, err := pool.Exec(ctx, query, entityID, lang, value)
	return err
}

func (h *SystemHandler) updateContentTranslation(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	key := chi.URLParam(r, "key")
	lang := normalizeLanguageCode(chi.URLParam(r, "lang"))
	if lang == "" || !enabledLanguage(r.Context(), h.Pool, lang) {
		writeError(w, 400, "language is not enabled")
		return
	}
	var sourceHash, sourceLanguage string
	err := h.Pool.QueryRow(r.Context(), `
		SELECT source_hash, source_language FROM content_translation_sources
		WHERE translation_key = $1 AND is_active = true AND (node_domain = $2 OR node_domain = '__GLOBAL__')`, key, nodeDomain).
		Scan(&sourceHash, &sourceLanguage)
	if err != nil {
		writeError(w, 404, "translation source not found")
		return
	}
	if strings.EqualFold(lang, sourceLanguage) {
		writeError(w, 400, "the source language must be edited in the original entity")
		return
	}
	var req struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if len(req.Value) > 4*1024*1024 {
		writeError(w, 400, "translation is too large")
		return
	}
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	err = saveContentTranslation(r.Context(), h.Pool, key, lang, req.Value, userID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"status": "ok", "translation_key": key, "language": lang})
}

// bulkUpdateContentTranslations saves several explicitly registered sources in
// one request. It never accepts a table or field name, only existing source
// keys scoped to the requesting node.
func (h *SystemHandler) bulkUpdateContentTranslations(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	var req struct {
		Translations []struct {
			TranslationKey string `json:"translation_key"`
			Language       string `json:"language"`
			Value          string `json:"value"`
		} `json:"translations"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024*1024)).Decode(&req); err != nil {
		writeError(w, 400, "invalid request body")
		return
	}
	if len(req.Translations) == 0 || len(req.Translations) > 250 {
		writeError(w, 400, "translations must contain between 1 and 250 items")
		return
	}
	userID, err := h.Auth.GetUserID(r)
	if err != nil {
		writeError(w, 401, "authentication required")
		return
	}
	for _, item := range req.Translations {
		lang := normalizeLanguageCode(item.Language)
		if item.TranslationKey == "" || lang == "" || len(item.Value) > 4*1024*1024 || !enabledLanguage(r.Context(), h.Pool, lang) {
			writeError(w, 400, "invalid translation item")
			return
		}
		var sourceLanguage string
		err := h.Pool.QueryRow(r.Context(), `
			SELECT source_language FROM content_translation_sources
			WHERE translation_key = $1 AND is_active = true
			  AND (node_domain = $2 OR node_domain = '__GLOBAL__')`, item.TranslationKey, nodeDomain).Scan(&sourceLanguage)
		if err != nil {
			writeError(w, 404, "translation source not found")
			return
		}
		if strings.EqualFold(lang, sourceLanguage) {
			writeError(w, 400, "the source language must be edited in the original entity")
			return
		}
	}
	for _, item := range req.Translations {
		if err := saveContentTranslation(r.Context(), h.Pool, item.TranslationKey, normalizeLanguageCode(item.Language), item.Value, userID); err != nil {
			writeError(w, 500, err.Error())
			return
		}
	}
	writeJSON(w, 200, map[string]interface{}{"status": "ok", "saved": len(req.Translations)})
}

func (h *SystemHandler) deleteContentTranslation(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	key := chi.URLParam(r, "key")
	lang := normalizeLanguageCode(chi.URLParam(r, "lang"))
	result, err := h.Pool.Exec(r.Context(), `
		DELETE FROM content_translations ct USING content_translation_sources s
		WHERE ct.translation_key = s.translation_key AND ct.translation_key = $1
		  AND LOWER(ct.language) = LOWER($2) AND (s.node_domain = $3 OR s.node_domain = '__GLOBAL__')`, key, lang, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"status": "ok", "deleted": result.RowsAffected()})
}

func (h *SystemHandler) getContentTranslationStatus(w http.ResponseWriter, r *http.Request) {
	nodeDomain := db.ResolveNodeDomain(r.Context(), h.Pool, r.Header.Get("X-Node-Domain"), h.nodeDomain)
	lang, _ := resolveRequestLanguages(r, h.Pool, nodeDomain)
	rows, err := h.Pool.Query(r.Context(), `
		SELECT s.entity_type, COUNT(*) AS total,
		       COUNT(*) FILTER (WHERE ct.id IS NOT NULL AND ct.value <> '' AND ct.source_hash = s.source_hash) AS translated,
		       COUNT(*) FILTER (WHERE ct.id IS NOT NULL AND ct.value <> '' AND ct.source_hash <> s.source_hash) AS stale
		FROM content_translation_sources s
		LEFT JOIN content_translations ct ON ct.translation_key = s.translation_key AND LOWER(ct.language) = LOWER($1)
		WHERE s.is_active = true AND (s.node_domain = $2 OR s.node_domain = '__GLOBAL__')
		GROUP BY s.entity_type ORDER BY s.entity_type`, lang, nodeDomain)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var entityType string
		var total, translated, stale int
		if err := rows.Scan(&entityType, &total, &translated, &stale); err == nil {
			items = append(items, map[string]interface{}{
				"entity_type": entityType, "total": total, "translated": translated,
				"stale": stale, "missing": total - translated - stale,
			})
		}
	}
	writeJSON(w, 200, map[string]interface{}{"language": lang, "entities": items})
}
