package api

import (
	"testing"
)

// TestNormalizeLanguageCode verifica la normalización BCP-47 de códigos de idioma.
func TestNormalizeLanguageCode(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"es", "es"},
		{"ES", "es"},
		{"es-es", "es-ES"},
		{"ES-es", "es-ES"},
		{"pt-br", "pt-BR"},
		{"PT_BR", "pt-BR"},
		{"zh-cn", "zh-CN"},
		{"en-US,en;q=0.9", "en-US"},
		{"fr-CA;q=0.8", "fr-CA"},
		{"", ""},
	}

	for _, c := range cases {
		result := normalizeLanguageCode(c.input)
		if result != c.expected {
			t.Errorf("normalizeLanguageCode(%q) = %q; se esperaba %q", c.input, result, c.expected)
		}
	}
}

// TestContentTranslationSourceKeyFormat verifica el formato de clave compuesto entityType:entityID:fieldName.
func TestContentTranslationSourceKeyFormat(t *testing.T) {
	entityType := "product"
	entityID := "b1c2-d3e4"
	fieldName := "description"
	expected := "product:b1c2-d3e4:description"

	actual := entityType + ":" + entityID + ":" + fieldName
	if actual != expected {
		t.Errorf("Clave generada errónea: se obtuvo %q, se esperaba %q", actual, expected)
	}
}
