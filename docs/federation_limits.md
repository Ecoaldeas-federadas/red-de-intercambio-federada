# Limites Federados

## Tablas
- `federation_global_config`: Configuracion global del nodo
- `bilateral_limits`: Limites bilaterales entre nodos
- `bilateral_limit_history`: Historial de cambios
- `node_balance`: Balance bilateral por nodo
- `federation_node_levels`: Niveles de nodo federado (configurables por votacion)
- `federation_node_membership`: Membresia de cada nodo (nivel, metricas, padrino)
- `federation_sponsorships`: Patrocinios (retencion de limite del padrino)
- `cross_node_tx_chain`: Cadena de transacciones cross-node con firma dual y hash encadenado

## Piscina Global Multilateral (NUEVO)

### Como funciona

La piscina global es un saldo **compartido entre todos los nodos federados**. A diferencia del sistema anterior (donde el "global" era solo un limite/check secundario), ahora existe una piscina real:

- Las transacciones cross-node sin acuerdo bilateral se registran como `node_bridge_global`
- El saldo global se calcula sumando TODOS los `node_bridge_global` **sin filtrar por `counterpart_node`**
- Un saldo ganado comerciando con el nodo B **se puede gastar con el nodo C**
- El limite de la piscina global depende del **nivel del nodo** (ver mas abajo)

### Routing de transacciones

```
Transaccion cross-node:
  ¿Existe acuerdo bilateral activo (is_customized=true, local_approved=true, remote_confirmed=true)?
    SI → va a la piscina bilateral (node_bridge_bilateral)
    NO → va a la piscina global (node_bridge_global)
```

### Limite de la piscina global

El limite depende del nivel del nodo federado:
- Nivel 1 (Nodo Nuevo): 1000 TQ
- Nivel 2 (Nodo Aceptado): 5000 TQ
- Nivel 3 (Nodo Pleno): 20000 TQ

Ademas, el limite efectivo se reduce por patrocinios activos:
```
limite_efectivo = limite_del_nivel - SUM(amount_held WHERE sponsor = este_nodo AND status = 'active')
```

## Piscinas Bilaterales

### Estructura
- `local_node` / `remote_node`: nodos involucrados
- `credit_limit` / `debit_limit`: limites especificos
- `is_customized`: true si es personalizado (no default)
- `local_approved` / `remote_confirmed`: aprobacion bilateral

### Como funciona

- Las transacciones entre dos nodos con acuerdo bilateral van a `node_bridge_bilateral`
- El saldo bilateral se calcula filtrando por `counterpart_node`
- **No afecta la piscina global**
- Solo aplica entre los dos nodos del acuerdo
- Los mismos nodos pueden seguir usando la piscina global con otros nodos

### Aprobacion Bilateral
1. Nodo local propone/modifica limite: `POST /api/federation/bilateral/propose`
2. `local_approved = true` tras aprobacion local
3. Nodo remoto debe confirmar: `remote_confirmed = true`
4. Solo activo cuando ambos lados aprueban

### Historial
- `bilateral_limit_history`: registra todos los cambios
- old_credit_limit, new_credit_limit, old_debit_limit, new_debit_limit
- change_reason, approved_by

## Integridad Distribuida (NUEVO)

### Firma dual

Cada transaccion cross-node debe ser firmada por **AMBOS nodos** antes de ser valida:
1. Nodo A (comprador) crea la transaccion y la firma con su clave Ed25519
2. Nodo B (vendedor) verifica la firma de A, firma tambien, y devuelve la transaccion dual-firmada
3. Ambos nodos almacenan la transaccion dual-firmada
4. Una transaccion sin la firma de ambos nodos **no es valida**

### Hash encadenado

Cada transaccion cross-node incluye:
- `prev_hash`: hash de la transaccion anterior con ese counterpart
- `tx_hash`: hash de esta transaccion (incluyendo prev_hash, amount, sender, receiver, timestamp, ambas firmas)

Esto crea una cadena por par de nodos. Si alguien intenta insertar o modificar una transaccion, la cadena se rompe.

### Reconciliacion

Cuando un nodo se conecta a internet o a otro nodo:
1. Intercambian los `last_hash` de cada par de nodos
2. Si los hashes coinciden → estan sincronizados
3. Si no coinciden → intercambian la cadena de transacciones desde el punto de divergencia
4. Cada transaccion se verifica: ambas firmas validas, hash encadenado correcto
5. Transacciones con ambas firmas → validas, se incorporan
6. Transacciones con una sola firma → invalidas, se rechazan y auditan

### Endpoints de reconciliacion
- `GET /federation/reconcile/compare?node=peerDomain` - compara hashes
- `GET /federation/reconcile/chain?node=peerDomain&since=hash` - obtiene cadena divergente
- `POST /federation/reconcile/import` - importa entradas de cadena
- `GET /federation/audit/chain?node=peerDomain` - auditoria completa

### Operacion offline
- Las transacciones **internas** (dentro del nodo) funcionan offline
- Las transacciones **cross-node** requieren conectividad entre los dos nodos
- Al reconectar, se sincroniza via gossip

## Limites Globales (configuracion heredada)

### Configuracion
- `node_global_credit_limit`: Limite total de credito del nodo (usado como fallback)
- `node_global_debit_limit`: Limite total de debito del nodo
- `node_bilateral_base_limit`: Limite base bilateral por defecto

### Umbrales de Advertencia
| Umbral | Default | Descripcion |
|--------|---------|-------------|
| `warning_threshold_1` | 80% | Advertencia temprana |
| `warning_threshold_2` | 90% | Advertencia urgente |
| `warning_threshold_3` | 95% | Advertencia critica |
| `parity_suggestion_threshold` | 80% | Sugerencia de ajuste de paridad |

### Actualizacion
- Solo actualizable por asamblea
- `PUT /api/federation/config`: requiere decision de asamblea

## Balance Bilateral

- `node_balance`: tabla con saldo por nodo remoto
- `balance`: saldo actual (positivo = deudor, negativo = acreedor)
- `last_sync`: ultima sincronizacion
- `last_hash`: ultimo hash de sincronizacion

## Reportes de Paridad

- `GET /api/federation/parity`: reportes de paridad
- Compara precios internos vs externos por nodo
- Sugiere ajustes cuando paridad < threshold
- FC (factor de conversion) como referencia
