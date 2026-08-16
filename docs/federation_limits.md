# Limites Federados

## Tablas
- `federation_global_config`: Configuracion global del nodo
- `bilateral_limits`: Limites bilaterales entre nodos
- `bilateral_limit_history`: Historial de cambios
- `node_balance`: Balance multilateral

## Limites Globales

### Configuracion
- `node_global_credit_limit`: Limite total de credito del nodo (negativo)
- `node_global_debit_limit`: Limite total de debito del nodo (positivo)
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

## Limites Bilaterales

### Estructura
- `local_node` / `remote_node`: nodos involucrados
- `credit_limit` / `debit_limit`: limites especificos
- `is_customized`: true si es personalizado (no default)
- `local_approved` / `remote_confirmed`: aprobacion bilateral

### Aprobacion Bilateral
1. Nodo local propone/modifica limite: `POST /api/federation/limits`
2. `local_approved = true` tras aprobacion local
3. Nodo remoto debe confirmar: `remote_confirmed = true`
4. Solo activo cuando ambos lados aprueban

### Historial
- `bilateral_limit_history`: registra todos los cambios
- old_credit_limit, new_credit_limit, old_debit_limit, new_debit_limit
- change_reason, approved_by

## Piscinas Separadas

Cada relacion bilateral tiene su propia piscina de limites:
- El saldo con nodo A no afecta el saldo con nodo B
- Permite relaciones comerciales independientes
- `node_balance`: saldo individual con cada nodo

## Balance Multilateral

- `node_balance`: tabla con saldo por nodo remoto
- `balance`: saldo actual (positivo = deudor, negativo = acreedor)
- `last_sync`: ultima sincronizacion
- `last_hash`: ultimo hash de sincronizacion

## Reportes de Paridad

- `GET /api/federation/parity`: reportes de paridad
- Compara precios internos vs externos por nodo
- Sugiere ajustes cuando paridad < threshold
- FC (factor de conversion) como referencia
