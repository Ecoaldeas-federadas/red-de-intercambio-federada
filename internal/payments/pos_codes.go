package payments

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================================
// Codigos de barra con peso/cantidad (EAN-13 balanza) y payloads compactos
// QR / NFC NDEF (tq1:...) para productos individuales y canastas completas.
// ============================================================================
//
// 1. Formato EAN-13 de peso/cantidad variable (13 digitos numericos):
//    Prefijo "2" + 5 digitos de item_code (CCCCC) + 5 digitos de cantidad (QQQQQ) + 1 digito verificador (D)
//      - Prefijo "21": cantidad expresada en milesimas (ej: 02500 = 2.500 kg, 2.500 L, 2.500 m)
//      - Prefijo "22": cantidad expresada en centesimas (ej: 01050 = 10.50 kg/L/m/h/unidades)
//      - Prefijo "23": cantidad entera directa (ej: 00012 = 12 unidades)
//      - Prefijo "28": canasta pre-armada identificada por los 10 digitos intermedios
//
// 2. Formato compacto QR / Etiqueta NFC NDEF (cabe en NTAG213 de 144 bytes):
//    - Producto individual (con o sin vendedor):
//        tq1:p:<seller_id_or_empty>:<item_code_or_id>:<qty>
//        Ej: "tq1:p:550e8400-e29b-41d4-a716-446655440000:10023:2.5"
//    - Canasta inline (con vendedor):
//        tq1:b:<seller_id>:<code1>*<qty1>,<code2>*<qty2>
//        Ej: "tq1:b:550e8400-e29b-41d4-a716-446655440000:10023*2.5,90001*1"
//    - Canasta por referencia corta (pos_preset_baskets.short_code):
//        tq1:r:<short_code>
//        Ej: "tq1:r:B8F3K2"

// POSCartItemInput representa una linea enviada en un cobro POS o leida de etiqueta.
type POSCartItemInput struct {
	StoreItemID    string  `json:"store_item_id,omitempty"`
	ProductID      string  `json:"product_id,omitempty"`
	ItemCode       string  `json:"item_code,omitempty"`
	ItemName       string  `json:"item_name,omitempty"`
	Unit           string  `json:"unit,omitempty"`
	Quantity       float64 `json:"quantity"`
	UnitPriceCents int64   `json:"unit_price_cents,omitempty"`
	SubtotalCents  int64   `json:"subtotal_cents,omitempty"`
	IsService      bool    `json:"is_service,omitempty"`
}

// ParsedPOSCode contiene el resultado de decodificar un codigo de barras, QR o etiqueta NFC.
type ParsedPOSCode struct {
	Kind            string             `json:"kind"` // "product" | "basket_inline" | "basket_ref"
	SellerID        string             `json:"seller_id,omitempty"`
	BasketShortCode string             `json:"basket_short_code,omitempty"`
	Items           []POSCartItemInput `json:"items,omitempty"`
	RawCode         string             `json:"raw_code"`
}

// ComputeEAN13CheckDigit calcula el digito verificador EAN-13 para los primeros 12 digitos.
func ComputeEAN13CheckDigit(first12 string) (int, error) {
	if len(first12) != 12 {
		return 0, fmt.Errorf("EAN-13 requires 12 digits before check digit")
	}
	sum := 0
	for i := 0; i < 12; i++ {
		ch := first12[i]
		if ch < '0' || ch > '9' {
			return 0, fmt.Errorf("non-digit in EAN-13")
		}
		d := int(ch - '0')
		if i%2 == 0 {
			sum += d
		} else {
			sum += d * 3
		}
	}
	check := (10 - (sum % 10)) % 10
	return check, nil
}

// GenerateWeightedEAN13 genera un codigo de barras EAN-13 con el item_code (5 digitos)
// y el peso/cantidad incrustado.
//   - Si quantity tiene hasta 3 decimales y <= 99.999 -> prefijo "21" (milesimas: gramos/ml/mm)
//   - Si quantity <= 999.99 -> prefijo "22" (centesimas)
//   - Si quantity > 999.99 -> prefijo "23" (unidades enteras hasta 99999)
func GenerateWeightedEAN13(itemCode string, quantity float64) (string, error) {
	cleanCode := onlyDigits(itemCode)
	if len(cleanCode) == 0 {
		return "", fmt.Errorf("item_code must contain digits")
	}
	if len(cleanCode) > 5 {
		cleanCode = cleanCode[len(cleanCode)-5:]
	}
	for len(cleanCode) < 5 {
		cleanCode = "0" + cleanCode
	}

	if quantity <= 0 {
		quantity = 1
	}

	var prefix string
	var encodedQty int
	// Detectar si conviene milesimas (21), centesimas (22) o entero (23)
	millis := int(math.Round(quantity * 1000))
	cents := int(math.Round(quantity * 100))
	whole := int(math.Round(quantity))

	switch {
	case millis <= 99999 && math.Abs(quantity*1000-float64(millis)) < 0.5 && (millis%10 != 0 || quantity < 100):
		prefix = "21"
		encodedQty = millis
	case cents <= 99999:
		prefix = "22"
		encodedQty = cents
	default:
		if whole > 99999 {
			whole = 99999
		}
		prefix = "23"
		encodedQty = whole
	}

	first12 := fmt.Sprintf("%s%s%05d", prefix, cleanCode, encodedQty)
	check, err := ComputeEAN13CheckDigit(first12)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%d", first12, check), nil
}

// GenerateBasketEAN13 genera un EAN-13 con prefijo "28" a partir de un ID numerico de 10 digitos.
func GenerateBasketEAN13(tenDigits string) (string, error) {
	clean := onlyDigits(tenDigits)
	if len(clean) > 10 {
		clean = clean[len(clean)-10:]
	}
	for len(clean) < 10 {
		clean = "0" + clean
	}
	first12 := "28" + clean
	check, err := ComputeEAN13CheckDigit(first12)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%d", first12, check), nil
}

// FormatProductTagPayload construye el string compacto para QR o etiqueta NFC NDEF de un producto.
func FormatProductTagPayload(sellerID, itemCode string, quantity float64) string {
	qtyStr := strconv.FormatFloat(quantity, 'f', -1, 64)
	return fmt.Sprintf("tq1:p:%s:%s:%s", strings.TrimSpace(sellerID), strings.TrimSpace(itemCode), qtyStr)
}

// FormatBasketTagPayload construye el string compacto para QR o etiqueta NFC NDEF de una canasta.
func FormatBasketTagPayload(sellerID string, items []POSCartItemInput) string {
	parts := make([]string, 0, len(items))
	for _, it := range items {
		code := strings.TrimSpace(it.ItemCode)
		if code == "" {
			code = strings.TrimSpace(it.StoreItemID)
		}
		if code == "" {
			code = strings.TrimSpace(it.ProductID)
		}
		if code == "" {
			continue
		}
		q := it.Quantity
		if q <= 0 {
			q = 1
		}
		parts = append(parts, fmt.Sprintf("%s*%s", code, strconv.FormatFloat(q, 'f', -1, 64)))
	}
	return fmt.Sprintf("tq1:b:%s:%s", strings.TrimSpace(sellerID), strings.Join(parts, ","))
}

// ParsePOSCode interpreta cualquier codigo escaneado en el POS:
//   - Payload NDEF/QR "tq1:p:...", "tq1:b:...", "tq1:r:..."
//   - Codigo de barras EAN-13 con peso/cantidad ("21...", "22...", "23...") o canasta ("28...")
//   - Codigo corto directo de producto (ej. "10023" o "90001")
func ParsePOSCode(raw string) (*ParsedPOSCode, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, fmt.Errorf("empty code")
	}

	// 1. Formato compacto tq1:
	if strings.HasPrefix(s, "tq1:") {
		segs := strings.Split(s, ":")
		if len(segs) < 3 {
			return nil, fmt.Errorf("invalid tq1 payload")
		}
		switch segs[1] {
		case "p":
			// tq1:p:<seller_id>:<item_code>:<qty>
			if len(segs) < 4 {
				return nil, fmt.Errorf("invalid tq1 product payload")
			}
			sellerID := segs[2]
			itemCode := segs[3]
			qty := 1.0
			if len(segs) >= 5 && segs[4] != "" {
				if v, err := strconv.ParseFloat(segs[4], 64); err == nil && v > 0 {
					qty = v
				}
			}
			return &ParsedPOSCode{
				Kind:     "product",
				SellerID: sellerID,
				RawCode:  s,
				Items: []POSCartItemInput{
					{ItemCode: itemCode, Quantity: qty},
				},
			}, nil

		case "b":
			// tq1:b:<seller_id>:<code1>*<qty1>,<code2>*<qty2>
			if len(segs) < 4 {
				return nil, fmt.Errorf("invalid tq1 basket payload")
			}
			sellerID := segs[2]
			entries := strings.Split(segs[3], ",")
			items := make([]POSCartItemInput, 0, len(entries))
			for _, e := range entries {
				e = strings.TrimSpace(e)
				if e == "" {
					continue
				}
				kv := strings.SplitN(e, "*", 2)
				code := strings.TrimSpace(kv[0])
				qty := 1.0
				if len(kv) == 2 {
					if v, err := strconv.ParseFloat(strings.TrimSpace(kv[1]), 64); err == nil && v > 0 {
						qty = v
					}
				}
				items = append(items, POSCartItemInput{ItemCode: code, Quantity: qty})
			}
			if len(items) == 0 {
				return nil, fmt.Errorf("empty basket in tq1 payload")
			}
			return &ParsedPOSCode{
				Kind:     "basket_inline",
				SellerID: sellerID,
				RawCode:  s,
				Items:    items,
			}, nil

		case "r":
			// tq1:r:<short_code>
			shortCode := strings.TrimSpace(segs[2])
			if shortCode == "" {
				return nil, fmt.Errorf("empty basket reference")
			}
			return &ParsedPOSCode{
				Kind:            "basket_ref",
				BasketShortCode: shortCode,
				RawCode:         s,
			}, nil
		}
	}

	// 2. EAN-13 con peso/cantidad incrustado o canasta (13 digitos)
	if len(s) == 13 && isAllDigits(s) {
		prefix := s[:2]
		switch prefix {
		case "21", "22", "23", "20", "24", "25", "26", "27", "29":
			itemCode := strings.TrimLeft(s[2:7], "0")
			if itemCode == "" {
				itemCode = s[2:7]
			}
			// Mantener 5 digitos si los store_items usan 5 digitos (10001..99999)
			rawFive := s[2:7]
			qtyRaw, _ := strconv.Atoi(s[7:12])
			var qty float64
			switch prefix {
			case "22":
				qty = float64(qtyRaw) / 100.0
			case "23":
				qty = float64(qtyRaw)
			default: // "21" y resto de prefijos de balanza 20..29 = milesimas (gramos/ml)
				qty = float64(qtyRaw) / 1000.0
			}
			if qty <= 0 {
				qty = 1
			}
			codeToUse := rawFive
			if strings.HasPrefix(rawFive, "0") {
				codeToUse = itemCode
			}
			return &ParsedPOSCode{
				Kind:    "product",
				RawCode: s,
				Items: []POSCartItemInput{
					{ItemCode: codeToUse, Quantity: qty},
				},
			}, nil

		case "28":
			return &ParsedPOSCode{
				Kind:            "basket_ref",
				BasketShortCode: s,
				RawCode:         s,
			}, nil
		}
	}

	// 3. Codigo corto o SKU directo (ej: "10023", "PAN-001", o "10023*2.5")
	if strings.Contains(s, "*") {
		kv := strings.SplitN(s, "*", 2)
		qty := 1.0
		if v, err := strconv.ParseFloat(strings.TrimSpace(kv[1]), 64); err == nil && v > 0 {
			qty = v
		}
		return &ParsedPOSCode{
			Kind:    "product",
			RawCode: s,
			Items: []POSCartItemInput{
				{ItemCode: strings.TrimSpace(kv[0]), Quantity: qty},
			},
		}, nil
	}

	return &ParsedPOSCode{
		Kind:    "product",
		RawCode: s,
		Items: []POSCartItemInput{
			{ItemCode: s, Quantity: 1},
		},
	}, nil
}

func onlyDigits(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			b.WriteByte(s[i])
		}
	}
	return b.String()
}

func isAllDigits(s string) bool {
	if len(s) == 0 {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// ValidateAndResolveCart verifica en el servidor que la canasta enviada:
//  1. No este vacia (prohibido cobrar monto libre sin productos/servicios reales).
//  2. Cada item pertenezca a la tienda activa del vendedor (store_items) o sea un
//     servicio universal del catalogo federado (__FEDERATION__ con is_universal_service = true).
//  3. Ni el producto ni sus componentes esten desaprobados o prohibidos (is_allowed = false).
//  4. Recalcula el precio unitario en centavos y el subtotal desde la base de datos.
func ValidateAndResolveCart(ctx context.Context, pool *pgxpool.Pool, sellerID uuid.UUID, rawItems []POSCartItemInput) ([]POSCartItemInput, int64, string, error) {
	if len(rawItems) == 0 {
		return nil, 0, "", fmt.Errorf("debe seleccionar al menos un producto o servicio en la canasta (no se permiten cobros de monto libre)")
	}

	resolved := make([]POSCartItemInput, 0, len(rawItems))
	var totalCents int64
	summaryParts := make([]string, 0, len(rawItems))

	for _, in := range rawItems {
		qty := in.Quantity
		if qty <= 0 {
			return nil, 0, "", fmt.Errorf("la cantidad de cada producto o servicio debe ser mayor que cero")
		}

		var item POSCartItemInput
		item.Quantity = qty

		var matched bool
		var linkedProductID *uuid.UUID
		var currentStock int64

		// 1. Buscar primero en store_items del vendedor (por id o por item_code)
		if in.StoreItemID != "" {
			if sid, err := uuid.Parse(in.StoreItemID); err == nil {
				var code, name, unit string
				var finalPrice, priceTrueque float64
				var isService, isActive bool
				var ownerID *uuid.UUID
				err := pool.QueryRow(ctx, `
					SELECT owner_id, product_id, COALESCE(item_code,''), product_name, COALESCE(unit,'unidad'),
					       COALESCE(final_price, 0), COALESCE(price_trueque, 0), stock, COALESCE(is_service, false), is_active
					FROM store_items WHERE id = $1`, sid,
				).Scan(&ownerID, &linkedProductID, &code, &name, &unit, &finalPrice, &priceTrueque, &currentStock, &isService, &isActive)
				if err == nil && isActive && (ownerID == nil || *ownerID == sellerID || sellerID == uuid.Nil) {
					p := finalPrice
					if p <= 0 {
						p = priceTrueque
					}
					unitCents := priceToCents(p)
					item.StoreItemID = sid.String()
					if linkedProductID != nil {
						item.ProductID = linkedProductID.String()
					}
					item.ItemCode = code
					item.ItemName = name
					item.Unit = unit
					item.UnitPriceCents = unitCents
					item.IsService = isService
					matched = true
				}
			}
		}

		if !matched && in.ItemCode != "" && sellerID != uuid.Nil {
			var sid uuid.UUID
			var code, name, unit string
			var finalPrice, priceTrueque float64
			var isService bool
			err := pool.QueryRow(ctx, `
				SELECT id, product_id, COALESCE(item_code,''), product_name, COALESCE(unit,'unidad'),
				       COALESCE(final_price, 0), COALESCE(price_trueque, 0), stock, COALESCE(is_service, false)
				FROM store_items
				WHERE owner_id = $1 AND is_active = true AND item_code = $2
				LIMIT 1`, sellerID, strings.TrimSpace(in.ItemCode),
			).Scan(&sid, &linkedProductID, &code, &name, &unit, &finalPrice, &priceTrueque, &currentStock, &isService)
			if err == nil {
				p := finalPrice
				if p <= 0 {
					p = priceTrueque
				}
				unitCents := priceToCents(p)
				item.StoreItemID = sid.String()
				if linkedProductID != nil {
					item.ProductID = linkedProductID.String()
				}
				item.ItemCode = code
				item.ItemName = name
				item.Unit = unit
				item.UnitPriceCents = unitCents
				item.IsService = isService
				matched = true
			}
		}

		// 2. Buscar en servicios universales o productos por ProductID o ItemCode
		if !matched {
			var pid uuid.UUID
			var code, name, unit, itemType string
			var price float64
			var isApproved, isActive, isUniversal bool
			var isAllowed *bool
			var qErr error
			if in.ProductID != "" {
				if parsedPID, err := uuid.Parse(in.ProductID); err == nil {
					qErr = pool.QueryRow(ctx, `
						SELECT id, COALESCE(item_code,''), name, COALESCE(unit,'hora'), COALESCE(item_type,'service'),
						       price_per_unit, is_approved, is_active, COALESCE(is_universal_service,false), is_allowed
						FROM products WHERE id = $1`, parsedPID,
					).Scan(&pid, &code, &name, &unit, &itemType, &price, &isApproved, &isActive, &isUniversal, &isAllowed)
				} else {
					qErr = fmt.Errorf("invalid product_id")
				}
			} else if in.ItemCode != "" {
				qErr = pool.QueryRow(ctx, `
					SELECT id, COALESCE(item_code,''), name, COALESCE(unit,'hora'), COALESCE(item_type,'service'),
					       price_per_unit, is_approved, is_active, COALESCE(is_universal_service,false), is_allowed
					FROM products
					WHERE (item_code = $1 OR product_code = $1 OR catalog_key = $1) AND is_active = true
					LIMIT 1`, strings.TrimSpace(in.ItemCode),
				).Scan(&pid, &code, &name, &unit, &itemType, &price, &isApproved, &isActive, &isUniversal, &isAllowed)
			} else {
				qErr = fmt.Errorf("missing item identifier")
			}

			if qErr == nil && isActive && isApproved {
				if isAllowed != nil && !*isAllowed {
					return nil, 0, "", fmt.Errorf("el producto o servicio '%s' no esta permitido en este nodo", name)
				}
				linkedProductID = &pid
				item.ProductID = pid.String()
				item.ItemCode = code
				item.ItemName = name
				item.Unit = unit
				item.UnitPriceCents = priceToCents(price)
				item.IsService = (itemType == "service" || isUniversal)
				currentStock = 999999
				matched = true
			}
		}

		if !matched {
			label := in.ItemName
			if label == "" {
				label = in.ItemCode
			}
			return nil, 0, "", fmt.Errorf("producto o servicio no encontrado o inactivo en la tienda del vendedor: %s", label)
		}

		// 3. Verificar que el producto vinculado no este prohibido ni desaprobado
		if linkedProductID != nil {
			var isApproved bool
			var isAllowed *bool
			var pName string
			err := pool.QueryRow(ctx, `
				SELECT name, is_approved, is_allowed FROM products WHERE id = $1`, *linkedProductID,
			).Scan(&pName, &isApproved, &isAllowed)
			if err == nil {
				if !isApproved || (isAllowed != nil && !*isAllowed) {
					return nil, 0, "", fmt.Errorf("el producto '%s' esta bloqueado o no aprobado en este nodo y no puede intercambiarse", pName)
				}
			}
		}

		// 4. Verificar componentes si es un compuesto de tienda
		if item.StoreItemID != "" {
			if sid, err := uuid.Parse(item.StoreItemID); err == nil {
				var blockedComp string
				_ = pool.QueryRow(ctx, `
					SELECT p.name
					FROM product_compositions pc
					JOIN products p ON p.id = pc.component_product_id
					WHERE pc.product_id = $1
					  AND (p.is_approved = false OR COALESCE(p.is_allowed, true) = false)
					LIMIT 1`, sid).Scan(&blockedComp)
				if blockedComp != "" {
					return nil, 0, "", fmt.Errorf("no se puede vender '%s' porque su componente '%s' no esta permitido en este nodo", item.ItemName, blockedComp)
				}
			}
		}

		// 5. Verificar stock para productos fisicos (no servicios)
		if !item.IsService && item.StoreItemID != "" && currentStock > 0 {
			needed := int64(math.Ceil(qty))
			if currentStock < needed {
				return nil, 0, "", fmt.Errorf("stock insuficiente para '%s' (disponible: %d, solicitado: %d)", item.ItemName, currentStock, needed)
			}
		}

		subtotal := int64(math.Round(float64(item.UnitPriceCents) * qty))
		if subtotal <= 0 {
			subtotal = 1
		}
		item.SubtotalCents = subtotal
		totalCents += subtotal
		resolved = append(resolved, item)
		summaryParts = append(summaryParts, fmt.Sprintf("%s x%s %s", item.ItemName, strconv.FormatFloat(qty, 'f', -1, 64), item.Unit))
	}

	return resolved, totalCents, strings.Join(summaryParts, ", "), nil
}

// CommitCartStockAndItems descuenta el inventario de store_items (para bienes fisicos)
// y registra las lineas en pos_transaction_items.
func CommitCartStockAndItems(ctx context.Context, pool *pgxpool.Pool, nodeDomain string, posChargeID, nfcTxID *uuid.UUID, sellerID, buyerID uuid.UUID, items []POSCartItemInput) {
	for _, it := range items {
		var storeItemUUID *uuid.UUID
		if it.StoreItemID != "" {
			if parsed, err := uuid.Parse(it.StoreItemID); err == nil {
				storeItemUUID = &parsed
				if !it.IsService {
					qtyInt := int64(math.Ceil(it.Quantity))
					if qtyInt < 1 {
						qtyInt = 1
					}
					_, _ = pool.Exec(ctx, `
						UPDATE store_items
						SET stock = GREATEST(0, stock - $2), updated_at = NOW()
						WHERE id = $1 AND COALESCE(is_service, false) = false`, parsed, qtyInt)
				}
			}
		}
		var prodUUID *uuid.UUID
		if it.ProductID != "" {
			if parsed, err := uuid.Parse(it.ProductID); err == nil {
				prodUUID = &parsed
			}
		}
		_, _ = pool.Exec(ctx, `
			INSERT INTO pos_transaction_items (
				node_domain, pos_charge_id, nfc_transaction_id, seller_id, buyer_id,
				store_item_id, product_id, item_code, item_name, unit,
				quantity, unit_price_cents, subtotal_cents, is_service
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
			nodeDomain, posChargeID, nfcTxID, sellerID, buyerID,
			storeItemUUID, prodUUID, it.ItemCode, it.ItemName, it.Unit,
			it.Quantity, it.UnitPriceCents, it.SubtotalCents, it.IsService,
		)
	}
}

func priceToCents(p float64) int64 {
	if p <= 0 {
		return 0
	}
	// En store_items y products, algunos precios estan en TQ (ej: 5 o 12.5) y otros ya en centavos (>= 100).
	// Si tiene decimales o es menor a 100, o si coincide con la convencion de centavos:
	// Verificamos: en products, price_per_unit de seed suele ser TQ enteros (1, 5, 8) o centavos (>= 100).
	// Para mantener consistencia con el resto del POS (donde 1 TQ = 100 centavos):
	if p != math.Trunc(p) || p < 50 {
		return int64(math.Round(p * 100))
	}
	return int64(math.Round(p))
}

func MarshalCartItemsJSON(items []POSCartItemInput) []byte {
	b, err := json.Marshal(items)
	if err != nil || len(b) == 0 {
		return []byte("[]")
	}
	return b
}
