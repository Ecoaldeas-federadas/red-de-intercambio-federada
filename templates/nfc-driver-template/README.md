# Plantilla de Driver NFC (.nfcpkg)

Esta plantilla contiene todos los archivos necesarios para crear un driver
NFC auto-instalable. Copia este directorio, modifica los archivos, y usa
la herramienta `nfc-pkg` para construir y firmar el paquete.

## Archivos

| Archivo | Descripcion |
|---------|-------------|
| `manifest.json` | Metadatos y specs de la tarjeta |
| `driver.js` | Logica del servidor (JavaScript ES5.1, Goja sandbox) |
| `reader.json` | Logica del POS Android (declarativo) |
| `migration.sql` | Migracion DB (solo DDL, en transaccion) |
| `protocol.md` | Documento del protocolo (opcional) |
| `icon.svg` | Icono para UI (opcional) |

## Pasos para crear un driver

1. Copia este directorio:
   ```
   cp -r templates/nfc-driver-template ./mi-driver
   ```

2. Edita `manifest.json`:
   - Cambia `type` a tu tipo de tarjeta (ej. "ntag216")
   - Cambia `display_name`, `description`, etc.
   - Ajusta `memory`, `security`, `protocol` segun la tarjeta

3. Edita `driver.js`:
   - Cambia `type: "MIDRIVER"` a tu tipo
   - Ajusta `provision`, `preAuth`, `confirm`, `cleanupExpired`
   - Usa `ctx.db`, `ctx.crypto`, `ctx.bcrypt` (ver comentarios)

4. Edita `reader.json`:
   - Cambia `type` y `display_name`
   - Ajusta `detection`, `auth`, `read_certificate`, `write_certificate`
   - Ajusta `memory_layout` y `slots`

5. Edita `migration.sql`:
   - Cambia `MIDRIVER` por tu tipo en los nombres de tablas
   - Ajusta columnas segun lo que necesita `driver.js`

6. Genera un par de claves Ed25519:
   ```
   go run ./cmd/nfc-pkg genkey --out mykey
   ```

7. Construye el paquete:
   ```
   go run ./cmd/nfc-pkg build ./mi-driver
   ```

8. Firma el paquete:
   ```
   go run ./cmd/nfc-pkg sign mi-driver-MIDRIVER-1.0.0.nfcpkg --key mykey.key
   ```

9. Verifica la firma:
   ```
   go run ./cmd/nfc-pkg verify mi-driver-MIDRIVER-1.0.0.nfcpkg --pubkey mykey.pub
   ```

10. Inspecciona el paquete:
    ```
    go run ./cmd/nfc-pkg inspect mi-driver-MIDRIVER-1.0.0.nfcpkg
    ```

11. Sube el `.nfcpkg` desde la web admin:
    - Entra a NFC > Drivers NFC > Subir Driver
    - Selecciona el archivo
    - Click "Instalar Driver"

## Importante

- **driver.js** usa ES5.1 (`var`, no `let`/`const`)
- **migration.sql** solo permite DDL (CREATE/ALTER/INDEX)
- **reader.json** es declarativo — el POS Android lo interpreta sin ejecutar JS
- La clave privada `.key` NO se sube al servidor — solo se usa para firmar
- La clave publica `.pub` se puede compartir para que otros verifiquen tus paquetes
