# Federacion

## Archivos
- `internal/federation/server.go` - Servidor federado con mTLS
- `internal/federation/protocol.go` - Protocolo de mensajes
- `internal/federation/helpers.go` - Utilidades JSON
- `internal/federation/gossip.go` - Sincronizacion periodica
- `internal/api/federation.go` - Handlers API REST

## Transporte: mTLS

Cada nodo tiene su propio certificado. La comunicacion entre nodos usa mutual TLS (ambos lados se verifican).

### Certificados
- Tabla `certificates` almacena: public_key, certificate_pem, issued_by, valid_from, valid_until
- Generados al instalar un nuevo nodo

## Limites Federados

### Limites Globales
- `federation_global_config`: limites globales del nodo
  - `node_global_credit_limit` / `node_global_debit_limit`: limite total del nodo
  - `node_bilateral_base_limit`: limite base bilateral por defecto
  - Umbrales de advertencia: 80%, 90%, 95%
  - Umbral de sugerencia de paridad: 80%

### Limites Bilaterales
- `bilateral_limits`: limites especificos entre dos nodos
- Personalizables por asamblea
- Requiere aprobacion local y confirmacion remota
- Historial de cambios en `bilateral_limit_history`

### Piscinas Separadas
- Los limites bilaterales son independientes entre si
- El saldo con el nodo A no afecta el saldo con el nodo B
- Balance multilateral en `node_balance`

## Balance Multilateral

- `node_balance`: saldo con cada nodo remoto
- Actualizado en cada transaccion federada
- Sincronizado via mensajes entre nodos

## Mensajes Entre Nodos

### Inbox
- Cada nodo tiene un inbox para recibir mensajes
- Tipos: transaccion, confirmacion, actualizacion de limites, sync de balance, propuesta de producto
- Idempotencia: `processed_messages` evita duplicados

### Tipos de mensaje
| Tipo | Descripcion |
|------|-------------|
| `Transfer` | Transferencia federada |
| `LimitQuery` | Consulta de limites |
| `BalanceSync` | Sincronizacion de balance |
| `BilateralSync` | Sincronizacion de limites bilaterales |
| `CardLookup` | Busqueda de tarjeta NFC de otro nodo |
| `ProductProposal` | Propuesta de producto base para aprobacion |

### Gossip
- Propagacion de informacion entre nodos
- Descubrimiento de nuevos nodos
- Propagacion de configuracion

## Federacion de Productos

### Concepto

Cuando un nodo crea un producto base nuevo y su asamblea lo aprueba, el producto
se distribuye a todos los nodos federados conocidos. Cada nodo receptor debe
aprobarlo individualmente via su propia asamblea para que este disponible en su
territorio.

### Flujo de aprobacion

```
Nodo A crea producto base (is_approved = false)
    |
    v
Asamblea de Nodo A vota
    |
    +-- Rechaza -> producto no disponible
    |
    +-- Aprueba -> is_approved = true
            |
            v
    Broadcast a nodos federados
            |
            +-> Nodo B recibe propuesta (pending)
            |       |
            |       +-- Asamblea de Nodo B aprueba -> disponible
            |       +-- Asamblea de Nodo B rechaza -> no disponible
            |
            +-> Nodo C recibe propuesta (pending)
                    +-- Asamblea de Nodo C debe votar
```

### Reglas
- Solo productos **base** se federan (materias primas y compuestos aprobados)
- Los productos compuestos personales **no** se federan automaticamente
- Un producto no aprobado en un nodo **no se puede usar** para:
  - Comprar en tienda
  - Como componente de productos compuestos
  - Como materia prima
- Un producto compuesto solo se puede comprar en un nodo si **todos** sus
  componentes estan aprobados en ese nodo

### Tabla `product_federation_proposals`

```sql
CREATE TABLE product_federation_proposals (
  id UUID PRIMARY KEY,
  source_node TEXT NOT NULL,           -- nodo que creo el producto
  source_product_id UUID NOT NULL,     -- id del producto en el nodo origen
  name TEXT NOT NULL,
  parent_category TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  unit TEXT NOT NULL,
  description TEXT,
  badge TEXT,
  image_url TEXT,
  price_per_unit BIGINT NOT NULL,
  is_composite BOOLEAN NOT NULL DEFAULT false,
  composition JSONB,                   -- composicion si es compuesto
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(source_node, source_product_id)
);
```

### Mensaje `ProductProposal`

```go
type ProductProposalPayload struct {
    SourceProductID string      `json:"source_product_id"`
    Name            string      `json:"name"`
    ParentCategory  string      `json:"parent_category"`
    Category        string      `json:"category"`
    Subcategory     string      `json:"subcategory"`
    Unit            string      `json:"unit"`
    Description     string      `json:"description"`
    Badge           string      `json:"badge"`
    ImageURL        string      `json:"image_url"`
    PricePerUnit    int64       `json:"price_per_unit"`
    IsComposite     bool        `json:"is_composite"`
    Composition     interface{} `json:"composition"`
}
```

### Endpoints API

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/federation/products/pending` | Lista productos federados pendientes |
| GET | `/api/federation/products/all` | Historial completo de propuestas |
| POST | `/api/federation/products/{id}/approve` | Aprueba producto federado (lo agrega al catalogo local) |
| POST | `/api/federation/products/{id}/reject` | Rechaza producto federado |

### Broadcast

La funcion `broadcastProductToFederation` en `system.go` se ejecuta despues
de que la asamblea local aprueba un producto. Lista los nodos federados
conocidos desde `node_balance` y registra el intento de broadcast en
`audit_log`.

### Productos federados en el catalogo local

Cuando un nodo aprueba un producto federado, se inserta en la tabla `products`
con:
- `origin = 'federated'`
- `source_node` = nodo origen
- `source_product_id` = id del producto en el nodo origen
- `is_approved = true` (aprobado por asamblea local)

## Reportes de Paridad

- `GET /api/federation/parity`: reportes de paridad entre nodos
- Compara precios internos con precios externos
- Sugiere ajustes cuando paridad < threshold (default 80%)

## Advertencias

- `GET /api/federation/warnings`: advertencias de limites
- Niveles: warning_threshold_1 (80%), warning_threshold_2 (90%), warning_threshold_3 (95%)
- Cuando se exceden umbrales, se notifica a la asamblea

## Nodos Conocidos

- `GET /api/federation/nodes`: lista de nodos conocidos
- Informacion: dominio, nombre, estado, balance, limites

## Peers (Registro mutuo)

Para que dos nodos se comuniquen, **ambos deben registrarse mutuamente**:

1. Cada nodo tiene su clave publica (en `secrets/node_keys.txt`)
2. En el nodo A: registrar la clave publica del nodo B
3. En el nodo B: registrar la clave publica del nodo A
4. Solo cuando ambos se han registrado, la federacion esta activa

### Endpoints
| Metodo | Ruta | Permiso | Descripcion |
|--------|------|---------|-------------|
| GET | `/api/federation/peers` | - | Lista peers registrados |
| POST | `/api/federation/peers` | `federation.change_config` | Registra peer |
| DELETE | `/api/federation/peers/{peerDomain}` | `federation.change_config` | Elimina peer |
