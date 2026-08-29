# Federacion

## Dos modos de federacion

La federacion entre aldeas puede funcionar de dos formas distintas:

### Modo A: Federacion por Internet (sin OpenWrt)

Las aldeas se comunican por **Internet publico** usando dominios publicos.

- No necesita OpenWrt
- Cada aldea necesita un dominio o IP publica (ej: `aldea1.com`)
- La federacion viaja por HTTPS normal
- Funciona para aldeas en diferentes lugares con Internet normal
- Solo necesitas compartir: el dominio de tu nodo

### Modo B: Federacion por Intranet (con OpenWrt)

Las aldeas se conectan por **tuneles WireGuard** creando un Internet paralelo
que **no depende del Internet publico**.

- Necesita OpenWrt instalado en cada aldea
- Usa direcciones IPv6 ULA propias de la red privada
- Las aldeas se comunican aunque no tengan Internet publico
- Necesitas compartir: dominio intranet, IPv6 ULA, endpoint WireGuard, clave publica WireGuard
- OpenWrt gestiona DNS, dominios, certificados y tuneles

### Modo C: Ambos (Internet + Intranet)

Una aldea puede tener ambos modos activos. Se federan por Internet cuando
estan lejos y por intranet cuando estan cerca.

### Que datos compartir con otra aldea

| Dato | Modo Internet | Modo Intranet |
|------|:---:|:---:|
| Dominio del nodo | Si | Si |
| Dominio publico (OpenWrt) | Opcional | Si |
| IPv6 ULA | No | Si |
| Endpoint WireGuard | No | Si |
| Clave publica WireGuard | No | Si |
| Puerto WireGuard | No | Si |

**Importante:** Las direcciones IPv6 ULA y los datos de WireGuard **solo aplican
para la intranet**. Si federas por Internet normal, no necesitas esos datos.

## Archivos
- `internal/federation/server.go` - Servidor federado con mTLS
- `internal/federation/protocol.go` - Protocolo de mensajes
- `internal/federation/helpers.go` - Utilidades JSON
- `internal/federation/gossip.go` - Sincronizacion periodica
- `internal/federation/reconcile.go` - Reconciliacion de cadena de transacciones (NUEVO)
- `internal/federation/node_levels.go` - Niveles de nodo, padrino, limite promedio (NUEVO)
- `internal/federation/pairing.go` - Verificacion de 4 opciones para federation pairing (NUEVO)
- `internal/api/federation.go` - Handlers API REST
- `internal/api/federation_gov.go` - Gobernanza federada (propuestas, votos, niveles)
- `internal/api/net_sync.go` - Sincronizacion automatica de informacion de red y servicios
- `internal/ledger/transaction.go` - Ledger con piscina global vs bilateral (ACTUALIZADO)
- `internal/ledger/limits.go` - Validacion de limites con piscina global primaria (ACTUALIZADO)
- `internal/payments/pairing.go` - Emparejamiento POS con verificacion de 4 opciones (ACTUALIZADO)

## Sincronizacion Automatica de Informacion de Red

Cuando un nodo actualiza su configuracion de red (dominio, IP, IPv6 ULA,
endpoint WireGuard, clave publica WireGuard) o registra nuevos servicios,
la informacion se sincroniza automaticamente con los peers federados
conocidos.

### Que se sincroniza
- Dominio del nodo y dominio publico (OpenWrt)
- Direccion IP publica
- IPv6 ULA (para intranet)
- Endpoint WireGuard y clave publica
- Puerto WireGuard
- Lista de servicios disponibles con sus direcciones
- Ultima actualizacion

### Como funciona
1. El nodo actualiza su configuracion de red o registra un servicio
2. Se dispara una sincronizacion en segundo plano (`net_sync.go`)
3. El nodo envia su informacion a todos los peers federados conocidos
4. Los peers reciben y almacenan la informacion en `federation_node_info`
5. Los usuarios pueden ver las direcciones y servicios de otros nodos

### Endpoints

> **Nota:** Los endpoints de node-info federados no están implementados como handlers HTTP dedicados en `internal/api/`. La tabla `federation_node_info` existe (migración 079) pero el intercambio de info de red entre nodos se hace via endpoints mTLS de reconciliación. Ver sección de endpoints mTLS más abajo.

### Tabla `federation_node_info`

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| node_domain | VARCHAR(128) PK | Dominio del nodo |
| node_name | VARCHAR(128) | Nombre descriptivo |
| public_domain | VARCHAR(128) | Dominio o IP publica |
| ipv6_ula | VARCHAR(64) | IPv6 ULA (fdXX:XXXX:XXXX::/48) |
| wireguard_endpoint | VARCHAR(128) | Endpoint WireGuard (direccion:puerto) |
| wireguard_public_key | TEXT | Clave publica WireGuard |
| wireguard_port | INT | Puerto WireGuard |
| network_mode | VARCHAR(20) | `internet`, `intranet`, `both` |
| services | JSONB | Lista de servicios disponibles |
| last_updated | TIMESTAMPTZ | Ultima actualizacion |
| is_active | BOOLEAN | Si el nodo esta activo |

### Pagina de Federacion (Frontend)
La pagina `/app/federation` tiene tres tabs:
- **Red del Nodo**: configuracion de OpenWrt, WireGuard, IPv6 ULA
- **Federar Aldeas**: registrar peers, ver nodos federados, sincronizar
- **Gobernanza**: propuestas federadas, constantes, expulsion

## Transporte: mTLS

Cada nodo tiene su propio certificado. La comunicacion entre nodos usa mutual TLS (ambos lados se verifican).

### Certificados
- Tabla `certificates` almacena: public_key, certificate_pem, issued_by, valid_from, valid_until
- Generados al instalar un nuevo nodo

## Limites Federados

### Piscina Global Multilateral (NUEVO)

La federacion tiene una **piscina global real** compartida entre todos los nodos.
Esto es diferente del sistema anterior donde el "global" era solo un limite secundario.

- Las transacciones sin acuerdo bilateral van a `node_bridge_global`
- El saldo global **no se filtra por `counterpart_node`**
- Un saldo ganado con el nodo B **se puede gastar con el nodo C**
- El limite depende del **nivel del nodo** (ver `docs/federation_governance.md`)

### Piscinas Bilaterales

- Las transacciones con acuerdo bilateral van a `node_bridge_bilateral`
- El saldo bilateral **se filtra por `counterpart_node`**
- **No afecta la piscina global**
- Solo aplica entre los dos nodos del acuerdo

### Routing de transacciones

```
Transaccion cross-node:
  ¿Existe acuerdo bilateral activo?
    SI → piscina bilateral (node_bridge_bilateral)
    NO → piscina global (node_bridge_global)
```

### Limites Globales (configuracion heredada)
- `federation_global_config`: limites globales del nodo (usado como fallback)
  - `node_global_credit_limit` / `node_global_debit_limit`: limite total del nodo
  - `node_bilateral_base_limit`: limite base bilateral por defecto
  - Umbrales de advertencia: 80%, 90%, 95%
  - Umbral de sugerencia de paridad: 80%

### Limites Bilaterales
- `bilateral_limits`: limites especificos entre dos nodos
- Personalizables por asamblea
- Requiere aprobacion local y confirmacion remota
- Historial de cambios en `bilateral_limit_history`

## Integridad Distribuida (NUEVO)

### Firma Dual
Cada transaccion cross-node debe ser firmada por **AMBOS nodos**:
1. Nodo A crea y firma la transaccion
2. Nodo B verifica la firma de A, firma tambien
3. Ambos nodos almacenan la transaccion dual-firmada
4. Sin ambas firmas, la transaccion **no es valida**

### Hash Encadenado
- Cada transaccion incluye `prev_hash` y `tx_hash`
- Crea una cadena por par de nodos
- Cualquier modificacion rompe la cadena

### Reconciliacion
Al reconectar dos nodos:
1. Comparan los `last_hash` de cada par
2. Si coinciden → sincronizados
3. Si no → intercambian la cadena divergente
4. Cada entrada se verifica (firmas + hash)
5. Entradas validas se incorporan, invalidas se auditan

### Tabla `cross_node_tx_chain`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| tx_id | UUID PK | ID de la transaccion |
| pool_type | TEXT | global o bilateral |
| sender_node | TEXT | Nodo que envia |
| receiver_node | TEXT | Nodo que recibe |
| amount | BIGINT | Monto |
| sender_signature | TEXT | Firma del nodo emisor |
| receiver_signature | TEXT | Firma del nodo receptor |
| prev_hash | TEXT | Hash de la transaccion anterior |
| tx_hash | TEXT | Hash de esta transaccion |
| synced | BOOLEAN | Si se sincronizo con el peer |

## Balance Bilateral

- `node_balance`: saldo bilateral con cada nodo remoto
- Actualizado en cada transaccion federada
- Sincronizado via mensajes entre nodos

## Piscina Global (NUEVO)

- El saldo global se calcula sumando `node_bridge_global` sin filtrar por `counterpart_node`
- Es un saldo compartido entre todos los nodos federados
- Un saldo ganado con el nodo B se puede gastar con el nodo C
- Ver `GetGlobalPoolBalance` en `internal/ledger/transaction.go`

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
