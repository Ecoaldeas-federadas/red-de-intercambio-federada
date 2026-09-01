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
- `internal/federation/transport.go` - Transporte cifrado E2E con Ed25519 + ECDH + AES-256-GCM (NUEVO)
- `internal/federation/propagation.go` - Propagacion en cadena de credenciales y expulsion (NUEVO)
- `internal/api/federation.go` - Handlers API REST
- `internal/api/federation_gov.go` - Gobernanza federada (propuestas, votos, niveles)
- `internal/api/net_sync.go` - Sincronizacion automatica de informacion de red y servicios
- `internal/ledger/transaction.go` - Ledger con piscina global vs bilateral (ACTUALIZADO)
- `internal/ledger/limits.go` - Validacion de limites con piscina global primaria + bloqueo unilateral (ACTUALIZADO)
- `internal/payments/pairing.go` - Emparejamiento POS con verificacion de 4 opciones (ACTUALIZADO)

## Federacion Automatica Global (NUEVO)

### Problema anterior

Antes, cada nodo debia federarse manualmente con cada otro nodo. Para una red
de N nodos, habia que configurar N*(N-1) relaciones manuales. Esto no escalaba.

### Solucion: Sponsor + Propagacion en Cadena

Ahora un nodo nuevo solo se federa con **un sponsor** via verificacion de 4
opciones. El sponsor propaga automaticamente la identidad del nuevo nodo a
toda la red federada en cadena exponencial.

### Flujo de admision

1. El nodo nuevo inicia el emparejamiento con el sponsor
2. El sponsor confirma con la verificacion de 4 opciones (codigo de 6 digitos)
3. El nodo nuevo se registra localmente como **Nivel 1** (sin voto, limite 1.000 TQ)
4. El sponsor crea una relacion de patrocinio y retiene parte de su limite
5. El sponsor crea un **evento de propagacion** firmado
6. El evento se envia a todos los peers del sponsor
7. Cada peer que recibe el evento:
   - Verifica la firma Ed25519 del originador
   - Verifica la autorizacion del sponsor
   - Almacena la credencial del nuevo nodo localmente
   - Reenvia el evento a sus propios peers (con TTL decrementado)
8. Los nodos que estan offline reciben el evento al reconectar (catch-up)
9. No se requiere aprobacion humana adicional de otros nodos

### Transporte cifrado E2E

La propagacion viaja por el mismo reverse proxy publico (HTTPS) pero el
payload esta **cifrado extremo a extremo**:

- **Firma Ed25519**: cada mensaje esta firmado por el nodo originador
- **ECDH + AES-256-GCM**: el payload se cifra con una clave derivada por ECDH
  entre el originador y el destinatario
- **Replay protection**: timestamp + nonce + deduplicacion por message_id
- **El reverse proxy no puede leer el contenido** de los mensajes federados

### Claves individuales (no compartidas)

- **Cada nodo tiene su propia clave privada Ed25519**
- **No existe una clave privada compartida de la federacion**
- Comprometer un nodo solo afecta a ese nodo y sus relaciones pairwise
- La revocacion es individual: un nodo puede revocar a un peer sin afectar a otros
- La expulsion federada es una orden firmada ejecutada independientemente por cada nodo

### Bloqueo unilateral de comercio

Un nodo puede **bloquear unilateralmente** el comercio con otro nodo especifico:

- El bloqueo es **local**: solo afecta al nodo que bloquea
- Los demas nodos siguen comerciando normalmente con el nodo bloqueado
- El bloqueo impide transacciones cross-node con ese peer
- El bloqueo es **auditable y revocable**
- El bloqueo **no es expulsion federada**

### Expulsion federada

La expulsion federada es una decision de gobernanza que afecta a toda la red:

1. Se propone una expulsion en la gobernanza federada
2. Los nodos con derecho a voto votan
3. Si se aprueba, se genera una **orden firmada de expulsion**
4. La orden se propaga a todos los nodos (mismo mecanismo que la admision)
5. Cada nodo **independientemente** verifica la orden y la ejecuta localmente
6. La ejecucion local deshabilita/revoca las credenciales del nodo expulsado
7. Los nodos offline aplican la orden al reconectar
8. **No depende de una clave global compartida**

### Diferencias clave

| Concepto | Alcance | Mecanismo |
|----------|---------|-----------|
| Propagacion de credenciales | Toda la red | Sponsor propaga en cadena |
| Gossip de transacciones | Toda la red | Sincronizacion periodica |
| Acuerdo bilateral | Un par | Configuracion opcional |
| Bloqueo unilateral | Un nodo (local) | Decision local auditada |
| Expulsion federada | Toda la red | Votacion + orden firmada |

### Endpoints de propagacion

- `POST /api/federation/propagation/receive` - Recibir evento de propagacion
- `GET /api/federation/propagation/pending` - Eventos pendientes de envio
- `POST /api/federation/propagation/{id}/retry` - Reintentar envio
- `POST /api/federation/block/{peerDomain}` - Bloquear comercio unilateral
- `DELETE /api/federation/block/{peerDomain}` - Desbloquear comercio
- `GET /api/federation/blocks` - Listar bloqueos activos

### Migracion

La migracion `137_federation_propagation.sql` crea las tablas:
- `federation_propagation_events` - Eventos de propagacion (admission/expulsion)
- `federation_propagation_deliveries` - Estado de entrega por peer
- `federation_node_blocks` - Bloqueos unilaterales de comercio
- `federation_expulsion_orders` - Ordenes de expulsion firmadas

**Nota sobre numeracion:** La migracion `130_pos_web_sessions.sql` fue renombrada
a `133_pos_web_sessions.sql` para resolver un conflicto de numeracion con
`130_federation_pairing.sql`. Si un deployment ya aplico el nombre antiguo,
debe marcar manualmente el nuevo nombre como aplicado en `schema_migrations`.


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

---

## Nodo Satelite (Ferias Offline)

### Diferencia con la federacion normal

La federacion normal conecta **nodos autonomos** que tienen su propia base de datos, asamblea, miembros y gobernanza. Intercambian **mensajes firmados** (transferencias, productos, perfiles) pero **no replican la base de datos**. Cada nodo es soberano.

El **nodo satelite** es diferente:
- **No es soberano**: no tiene asamblea, miembros, ni gobernanza propia.
- **Cachea datos** de uno o mas nodos origen (usuarios, saldos, tarjetas NFC).
- **Procesa pagos offline** contra el cache local.
- **Encola transacciones** y las sincroniza al reconectar.
- **No es una replica de base de datos**: es un cache temporal + cola de eventos.

### Arquitectura

```
[Nodo Origen] <--mTLS--> [Nodo Satelite]
  - DB autoritativa         - Cache local (PostgreSQL)
  - Usuarios reales         - satellite_cached_users
  - Ledger TQ               - satellite_cached_cards
  - NFC cards               - satellite_pending_tx
                            - Procesa pagos offline
                            - Firma transacciones con Ed25519
```

### Flujo de operacion

1. **Antes de la feria** (con internet):
   - Iniciar el nodo satelite: `docker compose -f docker-compose.satellite.yml up -d`
   - Abrir la web: `http://localhost:8080`
   - Ir a **Federacion > Satelite > Descargar Snapshot**
   - Ingresar la URL del nodo origen (ej: `https://nodo1.com:8443`)
   - El satelite descarga usuarios activos, saldos actuales y tarjetas NFC
   - Desconectar y llevar el equipo a la feria

2. **Durante la feria** (sin internet):
   - El satelite sirve la web y la API localmente
   - Los POS se conectan al satelite via Wi-Fi local
   - Los pagos NFC se validan contra el cache local
   - Las transacciones se registran en `satellite_pending_tx`
   - El balance en cache se actualiza inmediatamente

3. **Despues de la feria** (al reconectar):
   - Ir a **Federacion > Satelite > Sincronizar Transacciones**
   - Ingresar la URL del nodo origen
   - El satelite envia todas las transacciones pendientes firmadas
   - El nodo origen las registra sin validar limites (son hechos consumados)
   - Si un usuario quedo sobre su limite, se activa `is_over_limit`

### Seguridad

- **mTLS**: el satelite se conecta al nodo origen via mTLS con certificados mutuos.
- **Firma Ed25519**: cada transaccion del satelite va firmada con la clave privada del nodo satelite.
- **Verificacion**: el nodo origen verifica la firma antes de aceptar la transaccion.
- **Idempotencia**: cada transaccion tiene un UUID unico. El nodo origen no la procesa dos veces.
- **Autorizacion**: el satelite debe estar registrado en `node_federation_keys` con `is_satellite = true`.

### Limitaciones y responsabilidades

- **Doble gasto offline**: si dos satelites desconectados procesan pagos del mismo usuario, ambos pueden aprobar basandose en saldo stale. Al sincronizar, el usuario puede quedar sobre su limite.
- **Responsabilidad del usuario**: el usuario es responsable de no exceder su limite. Si lo excede por actividad offline concurrente, su cuenta se marca como `is_over_limit` y no puede hacer nuevas compras hasta regularizar.
- **Cache stale**: mientras el satelite este desconectado, los saldos en cache pueden estar desactualizados. No hay forma de evitarlo sin conexion.
- **No es autoritativo**: el satelite nunca es la fuente de verdad. El nodo origen siempre tiene el saldo real despues de la sincronizacion.

### Endpoints del satelite

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/satellite/snapshot/pull` | Descarga snapshot del nodo origen |
| GET | `/api/satellite/snapshot/status` | Estado del cache local |
| GET | `/api/satellite/pending-tx` | Lista transacciones pendientes |
| POST | `/api/satellite/sync-all` | Envia transacciones al nodo origen |
| GET | `/api/satellite/cached-users` | Lista usuarios en cache |

### Endpoints federados (nodo origen)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/federation/satellite/snapshot` | Devuelve usuarios + tarjetas para el satelite |
| POST | `/federation/satellite/sync` | Recibe transacciones offline del satelite |

### Migraciones

| Numero | Nombre | Descripcion |
|--------|--------|-------------|
| 160 | `satellite_node_type` | `node_type` en `node_config` (standard/satellite) |
| 161 | `satellite_cache_tables` | Tablas `satellite_cached_users`, `satellite_cached_cards`, `satellite_pending_tx` |
| 162 | `satellite_federation_flag` | `is_satellite` en `node_federation_keys` |

