# Nodo Satelite - Guia de Operacion

El nodo satelite es un nodo portatil que se lleva a ferias o eventos en lugares sin internet. Cachea usuarios y saldos de uno o mas nodos origen, procesa pagos NFC offline, y sincroniza las transacciones al reconectar.

## Requisitos

- Docker y Docker Compose instalados
- Una laptop o mini-PC que se llevara a la feria
- Conexion a internet **antes** de ir a la feria (para descargar el snapshot)
- Conexion al nodo origen via mTLS (certificados configurados)
- Wi-Fi local para que los POS y telefonos se conecten al satelite

## Configuracion inicial

### 1. Preparar el nodo origen

En el nodo origen (nodo principal), registrar el satelite como peer federado:

1. Ir a **Federacion > Federar Aldeas > Agregar**
2. Ingresar el dominio del satelite (ej: `satellite.feria`)
3. Marcar la opcion **"Es satelite"** (is_satellite)
4. Intercambiar certificados mTLS

### 2. Preparar el equipo satelite

1. Copiar el repositorio a la laptop que se llevara a la feria
2. Copiar `.env.satellite.example` a `.env` y editar:
   - `JWT_SECRET`: secreto unico del satelite
   - `NODE_PRIVATE_KEY`: clave Ed25519 del satelite (hex)
   - `PARENT_NODE`: dominio del nodo origen
3. Copiar los certificados mTLS a `./secrets/`
4. Verificar `config.satellite.yaml` con el dominio correcto

### 3. Iniciar el satelite

**Windows:**
```cmd
start-satellite.bat
```

**Linux/Mac:**
```bash
chmod +x start-satellite.sh
./start-satellite.sh
```

Esto inicia:
- PostgreSQL local (puerto 5433)
- App del satelite (puerto 8080 web, 8443 federation)

## Operacion en la feria

### Antes de desconectar (con internet)

1. Abrir `http://localhost:8080`
2. Iniciar sesion con la cuenta admin del satelite
3. Ir a **Federacion > Satelite**
4. En "Descargar Snapshot", ingresar la URL del nodo origen:
   - Ej: `https://nodo1.com:8443`
5. Clic en "Descargar Snapshot"
6. Verificar que se cachearon usuarios y tarjetas
7. **Desconectar** el equipo de internet

### Durante la feria (sin internet)

1. Conectar el equipo a un router Wi-Fi local (sin internet)
2. Los POS se conectan al satelite via Wi-Fi:
   - URL del POS: `http://[IP-del-satelite]:8080`
3. Los usuarios pueden ver su saldo desde el telefono:
   - Abrir `http://[IP-del-satelite]:8080` en el navegador
4. Los pagos NFC se procesan contra el cache local
5. Las transacciones se guardan en `satellite_pending_tx`

### Al volver (con internet)

1. Reconectar el equipo a internet
2. Abrir `http://localhost:8080`
3. Ir a **Federacion > Satelite**
4. En "Sincronizar Transacciones", ingresar la URL del nodo origen
5. Clic en "Sincronizar"
6. Verificar que todas las transacciones se enviaron correctamente
7. Si alguna fallo, revisar el error y reintentar

## Doble gasto y limite de credito

### Que pasa si dos satelites procesan pagos del mismo usuario?

Si dos satelites desconectados procesan pagos del mismo usuario al mismo tiempo, ambos pueden aprobar las transacciones basandose en saldos stale. Al sincronizar, el saldo resultante puede quedar por debajo del limite de credito del usuario.

### Que hace el sistema?

1. El nodo origen acepta ambas transacciones (son hechos consumidos firmados)
2. Verifica si el saldo quedo por debajo del limite de credito
3. Si es asi, marca al usuario con `is_over_limit = true`
4. El usuario ve un **banner rojo** en la web: "Tu cuenta esta sobre el limite de credito"
5. El usuario **no puede hacer nuevas compras** hasta regularizar
6. El usuario puede **recibir TQ** (vendiendo, recibiendo transferencias) para volver dentro del limite
7. Cuando el saldo vuelve a estar dentro del limite, el flag se desactiva automaticamente

### Responsabilidad del usuario

El usuario es **responsable** de no exceder su limite de credito, incluso cuando la actividad offline concurrente causa un exceso accidental. La asamblea puede aplicar penalizaciones segun las reglas de la comunidad.

## Detalles tecnicos

### Base de datos

El satelite usa **PostgreSQL** (no YugabyteDB) por ser mas liviano y facil de desplegar en una laptop. Las tablas del satelite son:

- `satellite_cached_users`: usuarios cacheados con saldo y password_hash
- `satellite_cached_cards`: tarjetas NFC cacheadas
- `satellite_pending_tx`: transacciones offline pendientes de sincronizar

### Firmas

Cada transaccion del satelite se firma con la clave privada Ed25519 del nodo satelite. El nodo origen verifica la firma antes de aceptar la transaccion.

Datos firmados: `transaction_id|sender_node|receiver_node|amount|created_at_unix_nano`

### Idempotencia

Cada transaccion tiene un UUID unico. El nodo origen usa la tabla `processed_messages` para evitar procesar la misma transaccion dos veces.

### Autenticacion offline

El satelite guarda el `password_hash` de cada usuario en el cache. Los usuarios pueden iniciar sesion en el satelite sin conexion al nodo origen. **Limitacion**: si el usuario cambia su password en el nodo origen despues del snapshot, el satelite tendra el hash viejo. Se recomienda hacer un snapshot fresco antes de cada feria.

## Backup

Para hacer backup del satelite:

```bash
docker compose -f docker-compose.satellite.yml exec satellite-db pg_dump -U fmc fmc_satellite > backup.sql
```

Para restaurar:

```bash
docker compose -f docker-compose.satellite.yml exec -T satellite-db psql -U fmc fmc_satellite < backup.sql
```

## Limpieza

Para resetear el satelite (borrar cache y transacciones):

```bash
docker compose -f docker-compose.satellite.yml down -v
docker compose -f docker-compose.satellite.yml up -d
```

Esto borra todos los datos del satelite. Util despues de cada feria para empezar limpio.
