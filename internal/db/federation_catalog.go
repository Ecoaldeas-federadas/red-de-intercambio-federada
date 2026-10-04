package db

import (
	"regexp"
	"strings"
)

// FEDERATION_NODE_DOMAIN es el dominio reservado del catalogo federado global.
// Los items con este dominio son identicos en todos los nodos (materia prima,
// productos base aprobados, servicios, embalaje y envio) y solo cambian por
// votacion de la federacion (federation_proposals: catalog_item_upsert/remove).
const FEDERATION_NODE_DOMAIN = "__FEDERATION__"

var nonAlnumDash = regexp.MustCompile(`[^a-z0-9]+`)

// CatalogItemSlug genera el identificador estable de un item del catalogo
// federado a partir de su nombre (ej: "fed-tomate-fresco").
// Replica federation_catalog_slug() de la migracion 182.
func CatalogItemSlug(name string) string {
	r := strings.NewReplacer(
		"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u", "ñ", "n",
		"Á", "a", "É", "e", "Í", "i", "Ó", "o", "Ú", "u", "Ü", "u", "Ñ", "n")
	slug := nonAlnumDash.ReplaceAllString(strings.ToLower(r.Replace(name)), "-")
	return "fed-" + strings.Trim(slug, "-")
}

var serviceUnits = map[string]bool{
	"hora": true, "jornada": true, "sesion": true, "clase": true, "dia": true,
	"visita": true, "viaje": true, "consulta": true, "servicio": true,
	"evento": true, "taller": true, "curso": true, "turno": true, "mes": true,
	"semana": true, "anio": true, "tratamiento": true, "ajuste": true,
	"diagnostico": true, "diseno": true, "alojamiento": true, "corte": true,
	"poda": true, "asesoria": true, "traduccion": true, "copia": true,
	"lavado": true, "entrega": true, "dia-persona": true, "instalacion": true,
	"mantenimiento": true, "reparacion": true, "paseo": true, "excursion": true,
	"inscripcion": true, "alquiler": true, "arriendo": true, "capacitacion": true,
	"charla": true, "presentacion": true, "funcion": true, "avaluo": true,
	"inspeccion": true, "evaluacion": true, "licencia": true, "suscripcion": true,
	"noche": true, "pasaje": true, "km": true,
}

var serviceParents = map[string]bool{
	"Servicios": true, "Educacion": true,
}

var serviceCategories = map[string]bool{
	"Trabajo Agricola": true, "Trabajo Tecnico": true, "Trabajo General": true,
	"Reparaciones": true, "Oficina": true, "Limpieza": true, "Talleres": true,
	"Alfabetizacion": true, "Terapias": true, "servicios": true, "Salud": true,
	"Entrega": true, "Eventos": true, "Educacion": true, "Transporte": true,
	"Construccion": true, "Mecanica": true, "Electricidad": true,
	"Plomeria": true, "Albanileria": true, "Carpinteria": true,
	"Estetica": true, "Jardineria": true, "Herreria": true, "Veterinaria": true,
	"Consultoria": true, "Soporte Tecnico": true, "Diseno": true,
	"Instalacion": true, "Mantenimiento": true, "Reparacion": true,
	"Costura": true, "Sastreria": true, "Turismo": true, "Hospedaje": true,
	"Comunicacion": true, "Belleza": true, "Barberia": true, "Peluqueria": true,
	"Cuidado": true, "Guarderia": true, "Entrenamiento": true, "Idiomas": true,
}

var packagingCategories = map[string]bool{
	"Envases": true, "Contenedores": true, "Envolturas": true, "Bolsas": true,
	"Empaque": true, "Embalaje": true,
}

var shippingCategories = map[string]bool{
	"Entrega": true, "Envio": true, "Envios": true, "Flete": true, "Logistica": true,
}

var rawMaterialCategories = map[string]bool{
	"Cosecha Fresca": true, "Granos y Cereales": true, "Carnes y Pescados": true,
	"Fibras": true, "Materiales": true, "Metales": true, "Metal": true,
	"Agregados": true, "Minerales": true, "Tierra y Compost": true, "Agua": true,
	"Combustibles": true, "energeticos": true, "Lena": true, "Cuero": true,
	"Caucho": true, "Vidrio": true, "Papel": true, "Carton": true,
	"Animales": true, "Vivero": true, "Semillas": true, "Semillas y Plantulas": true,
	"Semillas & Plantulas": true, "Plantulas": true, "Esquejes": true,
	"Frutos Secos": true, "Insumos Agricolas": true, "Insumos Agroecologicos": true,
	"Miel y Apicultura": true, "Huevos": true, "alimentos": true,
	"Aromaticas": true, "Especias": true, "Cafe": true, "Cacao": true,
	"Hongos": true, "Hierbas": true, "Plantas": true, "Pesca": true,
	"Legumbres": true, "Tuberculos": true, "Frutas": true, "Hortalizas": true,
	"Cereales": true, "Oleaginosas": true, "Raices": true, "Abonos": true,
	"Forraje": true, "Carbon": true, "Gas": true, "Biomasa": true,
	"Componentes": true, "Resinas": true, "Recursos Basicos": true,
	"Miel": true, "Sal": true, "Insumos": true, "Mineria": true,
	"Petroleo": true, "Madera": true, "Construccion": true, "Acabados": true,
}

var baseProductCategories = map[string]bool{
	"Dulces": true, "Bebidas": true, "Salsas": true, "Conservas": true,
	"Fermentados": true, "Lacteos": true, "Extractos": true, "Aceites": true,
	"Endulzantes": true, "Condimentos": true, "Harinas": true, "Embutidos": true,
	"Deshidratados": true, "Medicina Botanica": true, "Primeros Auxilios": true,
	"Herramientas": true, "Manuales": true, "Hilos y Materiales": true,
	"Textiles": true, "textiles": true, "Tintes": true, "Pinturas": true,
	"Barnices": true, "Adhesivos": true, "Repuestos": true, "Utensilios": true,
	"Riego": true, "Solar": true, "Eolica": true, "Hidraulica": true,
	"Electricas": true, "Higiene": true, "Chocolate": true,
	"Componentes Electronicos": true,
}

var finishedProductNames = []*regexp.Regexp{
	regexp.MustCompile(`(?i)mesa|silla|mueble|banco |cama|estante|puerta|ventana|ropero|gabinete|mortero|tabla de picar`),
}

// ClassifyCatalogItemType clasifica un item del catalogo segun las mismas
// reglas de la migracion 182. Devuelve:
//
//	raw_material | base_product | service | packaging | shipping | composite | product
//
// 'product' significa bien final (no pertenece al catalogo federado).
func ClassifyCatalogItemType(name, parent, category, subcategory, unit string, isComposite bool) string {
	if isComposite {
		return "composite"
	}
	if parent == "Embalaje" || packagingCategories[category] {
		return "packaging"
	}
	if parent == "Envio" || shippingCategories[category] {
		return "shipping"
	}
	if serviceUnits[strings.ToLower(unit)] || serviceParents[parent] || serviceCategories[category] {
		return "service"
	}
	if rawMaterialCategories[category] {
		for _, re := range finishedProductNames {
			if re.MatchString(name) {
				return "product"
			}
		}
		return "raw_material"
	}
	if baseProductCategories[category] {
		return "base_product"
	}
	return "product"
}
