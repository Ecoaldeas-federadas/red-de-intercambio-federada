# Auditoria

## Tabla
- `audit_log`: Registro inmutable de acciones

## Campos
- `actor_id`: Usuario que realizo la accion
- `action`: Tipo de accion
- `target_id`: Objeto afectado (opcional)
- `details`: Detalles en JSONB
- `ip_address`: IP desde donde se realizo
- `user_agent`: User agent del cliente
- `created_at`: Timestamp

## Acciones Auditadas

| Accion | Descripcion |
|--------|-------------|
| `login` | Inicio de sesion |
| `login_failed` | Intento de login fallido |
| `transfer` | Transferencia interna |
| `federation_transfer` | Transferencia federada |
| `admission_approve` | Aprobacion de admision |
| `admission_reject` | Rechazo de admision |
| `org_create` | Creacion de organizacion |
| `org_approve` | Aprobacion de organizacion |
| `limit_change` | Cambio de limites |
| `recovery_request` | Solicitud de recuperacion |
| `recovery_approve` | Aprobacion de recuperacion |
| `recovery_complete` | Completado de recuperacion |
| `assembly_decision` | Decision de asamblea |
| `external_operation` | Operacion de comercio externo |
| `config_change` | Cambio de configuracion |

## Verificacion Hash Chain

### Proceso
1. Recorrer todas las transacciones en orden cronologico
2. Recalcular `current_hash = SHA256(prev_hash + tx_data)`
3. Comparar con hash almacenado
4. Cualquier discrepancia indica manipulacion

### Transparencia
- Cualquier miembro con permiso `can_view_audit` puede ver el log
- El hash chain es publico y verificable
- Las entradas no se modifican ni eliminan

## Filtros de Consulta

- `GET /api/audit?action=transfer`: filtrar por accion
- `GET /api/audit?actor_id={uuid}`: filtrar por actor
- `GET /api/audit?from={date}&to={date}`: filtrar por rango de fechas

## Auditoria Federada de Cadenas de Transacciones

### Tabla `cross_node_tx_chain`

Las transacciones inter-nodos se registran en una cadena independiente con
firma dual (ambos nodos firman) y hashes encadenados (`prev_hash`, `tx_hash`).
Esto permite auditar las transacciones federadas de forma verificable.

### Endpoint de auditoria federada

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/federation/audit/chain` | Auditoria federada de la cadena de transacciones inter-nodos |

Este endpoint se consume via mTLS entre nodos. Permite a un nodo solicitar la
cadena completa de transacciones inter-nodos a otro nodo para verificar:

1. Que los hashes encadenados (`prev_hash` -> `tx_hash`) sean consistentes.
2. Que ambas firmas (Nodo A y Nodo B) sean validas.
3. Que no haya transacciones faltantes o alteradas.

### Reconciliacion de cadenas

Cuando los nodos se reconectan despues de una desconexion, se realiza una
reconciliacion automatica usando los endpoints:

- `POST /federation/reconcile/compare` — Compara los ultimos hashes de las cadenas.
- `POST /federation/reconcile/chain` — Solicita la cadena completa si hay discrepancia.
- `POST /federation/reconcile/import` — Importa transacciones faltantes.

Si se detectan discrepancias, se registra una alerta de auditoria y se notifica
a los administradores de ambos nodos.

### Acciones auditadas adicionales (federacion)

| Accion | Descripcion |
|--------|-------------|
| `federation_pair_init` | Inicio de emparejamiento federado |
| `federation_pair_confirm` | Confirmacion de emparejamiento federado |
| `node_level_upgrade` | Ascenso de nivel de un nodo federado |
| `sponsorship_created` | Creacion de relacion padrino-ahijado |
| `sponsorship_released` | Liberacion de limite del padrino |
| `chain_discrepancy` | Discrepancia detectada en reconciliacion de cadena |
