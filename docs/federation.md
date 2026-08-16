# Federacion

## Archivos
- `internal/federation/server.go` - Servidor federado con mTLS
- `internal/federation/helpers.go` - Utilidades JSON
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
- Tipos: transaccion, confirmacion, actualizacion de limites, sync de balance
- Idempotencia: `processed_messages` evita duplicados

### Gossip
- Propagacion de informacion entre nodos
- Descubrimiento de nuevos nodos
- Propagacion de configuracion

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
