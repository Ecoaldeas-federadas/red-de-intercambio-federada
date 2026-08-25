package db

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Preset representa una preconfiguracion de nodo.
type Preset struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Category    string          `json:"category"`
	Icon        string          `json:"icon"`
	HasDemoData bool            `json:"has_demo_data"`
	Config      json.RawMessage `json:"config"`
}

// PresetConfig es la estructura JSON dentro de un preset.
type PresetConfig struct {
	NodeName             string                   `json:"node_name"`
	CommerceSchedule     []map[string]interface{} `json:"commerce_schedule"`
	CommerceHoursEnabled bool                     `json:"commerce_hours_enabled"`
	CatalogRules         []map[string]interface{} `json:"catalog_rules"`
	PublicSettings       map[string]interface{}   `json:"public_settings"`
	Colors               map[string]interface{}   `json:"colors"`
}

// ListPresets devuelve todos los presets activos.
func ListPresets(ctx context.Context, pool *pgxpool.Pool) ([]Preset, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, name, description, category, icon, has_demo_data, config
		FROM node_presets WHERE is_active = true ORDER BY category, name`)
	if err != nil {
		return nil, fmt.Errorf("querying presets: %w", err)
	}
	defer rows.Close()

	var presets []Preset
	for rows.Next() {
		var p Preset
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Category, &p.Icon, &p.HasDemoData, &p.Config); err != nil {
			continue
		}
		presets = append(presets, p)
	}
	return presets, nil
}

// GetPreset devuelve un preset por ID.
func GetPreset(ctx context.Context, pool *pgxpool.Pool, id string) (*Preset, error) {
	var p Preset
	err := pool.QueryRow(ctx, `
		SELECT id, name, description, category, icon, has_demo_data, config
		FROM node_presets WHERE id = $1 AND is_active = true`, id).
		Scan(&p.ID, &p.Name, &p.Description, &p.Category, &p.Icon, &p.HasDemoData, &p.Config)
	if err != nil {
		return nil, fmt.Errorf("preset not found: %w", err)
	}
	return &p, nil
}

// ApplyPreset aplica una preconfiguracion a un nodo.
// Solo aplica si el nodo esta vacio (no tiene datos existentes).
// No sobrescribe datos existentes.
func ApplyPreset(ctx context.Context, pool *pgxpool.Pool, nodeDomain, presetID string) error {
	preset, err := GetPreset(ctx, pool, presetID)
	if err != nil {
		return err
	}

	var cfg PresetConfig
	if err := json.Unmarshal(preset.Config, &cfg); err != nil {
		return fmt.Errorf("invalid preset config: %w", err)
	}

	// 1. Aplicar commerce_schedule si hay reglas
	if cfg.CommerceHoursEnabled {
		_, err = pool.Exec(ctx, `
			UPDATE public_settings SET commerce_hours_enabled = true
			WHERE node_domain = $1`, nodeDomain)
		if err != nil {
			return fmt.Errorf("enabling commerce hours: %w", err)
		}

		for _, rule := range cfg.CommerceSchedule {
			name, _ := rule["name"].(string)
			blockType, _ := rule["block_type"].(string)
			blockMsg, _ := rule["block_message"].(string)
			crossesMidnight, _ := rule["crosses_midnight"].(bool)

			var dayOfWeek, endDayOfWeek *int
			if dow, ok := rule["day_of_week"].(float64); ok {
				d := int(dow)
				dayOfWeek = &d
			}
			if edow, ok := rule["end_day_of_week"].(float64); ok {
				e := int(edow)
				endDayOfWeek = &e
			}

			var startTime, endTime *string
			if st, ok := rule["start_time"].(string); ok && st != "" {
				startTime = &st
			}
			if et, ok := rule["end_time"].(string); ok && et != "" {
				endTime = &et
			}

			_, err = pool.Exec(ctx, `
				INSERT INTO commerce_schedule (node_domain, name, is_active, day_of_week, start_time, end_time,
					crosses_midnight, end_day_of_week, block_type, block_message)
				VALUES ($1, $2, true, $3, $4, $5, $6, $7, $8, $9)
				ON CONFLICT DO NOTHING`,
				nodeDomain, name, dayOfWeek, startTime, endTime,
				crossesMidnight, endDayOfWeek, blockType, blockMsg)
			if err != nil {
				return fmt.Errorf("inserting commerce schedule: %w", err)
			}
		}
	}

	// 2. Aplicar catalog_rules si hay (tabla puede no existir aun)
	for _, rule := range cfg.CatalogRules {
		category, _ := rule["category"].(string)
		prohibited, _ := rule["is_prohibited"].(bool)
		reason, _ := rule["reason"].(string)

		if category == "" {
			continue
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO catalog_dietary_rules (node_domain, category_name, is_prohibited, reason)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (node_domain, category_name) DO UPDATE SET is_prohibited = $3, reason = $4`,
			nodeDomain, category, prohibited, reason)
		if err != nil {
			continue // tabla puede no existir aun
		}
	}

	// 3. Aplicar public_settings si hay
	if footerSchedule, ok := cfg.PublicSettings["footer_schedule"].(string); ok && footerSchedule != "" {
		_, err = pool.Exec(ctx, `
			UPDATE public_settings SET footer_schedule = $2
			WHERE node_domain = $1`, nodeDomain, footerSchedule)
		if err != nil {
			return fmt.Errorf("updating footer schedule: %w", err)
		}
	}

	// 4. Aplicar nombre del nodo si hay
	if cfg.NodeName != "" {
		_, err = pool.Exec(ctx, `
			UPDATE node_config SET node_name = $2
			WHERE node_domain = $1`, nodeDomain, cfg.NodeName)
		if err != nil {
			return fmt.Errorf("updating node name: %w", err)
		}
	}

	return nil
}
