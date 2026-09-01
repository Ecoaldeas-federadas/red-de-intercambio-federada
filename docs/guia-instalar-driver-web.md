# Guia: Como Instalar un Driver NFC desde la Web

> Para **administradores de comunidad** que no saben programar.
> Si quieres crear un driver nuevo, ver [guia-crear-paquete-nfcpkg.md](guia-crear-paquete-nfcpkg.md).

## Que es un driver NFC

Un "driver" es lo que permite que el sistema reconozca y use un tipo de
tarjeta NFC. Por ejemplo, el driver "NTAG215" permite leer y escribir
tarjetas NTAG215.

El sistema ya viene con drivers para las tarjetas mas comunes:
- MIFARE Classic
- NTAG215
- Ultralight C

Si consigues un tipo de tarjeta que no esta soportado, necesitas instalar
un driver nuevo. Esto se hace subiendo un archivo `.nfcpkg`.

## De donde conseguir un .nfcpkg

1. **Del proyecto:** Los programadores del proyecto publican drivers
   para tarjetas comunes. Descargalos del repositorio o preguntando.

2. **De otro nodo federado:** Si otro nodo ya tiene el driver, aparece
   automaticamente en tu lista de "Disponibles". Solo click "Instalar".

3. **De un programador externo:** Si alguien creo un driver para una
   tarjeta especial, te puede dar el archivo `.nfcpkg`.

## Como instalar

### Paso 1: Entrar a la pagina

1. Entra a la web admin del nodo
2. Inicia sesion con tu cuenta de admin
3. En el menu lateral, click **"Drivers NFC"**

### Paso 2: Subir el driver

1. Click el boton **"+ Subir Driver"**
2. Aparece una ventana de upload
3. Arrastra el archivo `.nfcpkg` o click para seleccionarlo
4. Click **"Instalar Driver"**
5. Espera unos segundos mientras el servidor:
   - Verifica la firma
   - Ejecuta la migracion DB
   - Compila el driver
6. Aparece "Driver instalado correctamente"

### Paso 3: Verificar

El driver aparece en la lista de "Instalados" con estado "Activo".

A partir de ahora, las tarjetas de ese tipo funcionan en:
- El POS Android (despues de sincronizar)
- El provisionamiento de tarjetas
- Los pagos NFC

## Instalar desde un nodo federado

Si otro nodo federado comparte un driver, aparece automaticamente en
la pestana "Disponibles":

1. Ve a **Drivers NFC** > pestana **"Disponibles"**
2. Veras drivers compartidos por otros nodos
3. Click **"Instalar"** en el que quieres
4. El servidor descarga el paquete del otro nodo y lo instala

## Compartir con otros nodos

Para que tu driver este disponible para otros nodos federados:

1. Ve a **Drivers NFC** > pestana **"Instalados"**
2. Click **"Compartir"** en el driver que quieres compartir
3. El driver se marca como "Compartido"
4. En el proximo ciclo de gossip (60 segundos), los otros nodos reciben
   la notificacion
5. Aparece en su lista de "Disponibles"

## Activar / Desactivar / Desinstalar

- **Desactivar:** El driver deja de funcionar pero no se borra. Las
  tarjetas ya provisionadas siguen existiendo.
- **Activar:** Reactiva un driver desactivado.
- **Desinstalar:** Remueve el driver. Las tarjetas ya provisionadas
  NO se borran (pero no funcionaran hasta reinstalar el driver).

## Claves de firma

Cada `.nfcpkg` esta firmado criptograficamente. El servidor verifica
la firma antes de instalar.

Si el paquete fue firmado por:
- **Este nodo** — se instala sin preguntas (auto-confianza)
- **Un nodo federado** — se instala sin preguntas (confianza federada)
- **Una clave manual** — se instala sin preguntas si el admin agrego la clave
- **Una clave desconocida** — NO se instala. Error "firma no reconocida"

Para agregar una clave de confianza:

1. Ve a **Drivers NFC** > pestana **"Claves de Firma"**
2. Click **"+ Agregar Clave"**
3. Ingresa el label (nombre) y la clave publica (hex, 128 chars)
4. Click "Agregar"

## Preguntas frecuentes

### ¿Necesito recompilar el servidor?

No. El driver se instala en caliente. El servidor sigue funcionando.

### ¿Necesito actualizar el POS Android?

Si, pero solo la primera vez. La primera actualizacion del POS incluye
el motor declarativo (`CardReaderEngine`). Despues de eso, los drivers
nuevos se descargan automaticamente al sincronizar, sin actualizar el APK.

### ¿Funciona sin internet?

Si. Una vez instalado, el driver funciona offline. El POS Android
descarga el `reader.json` una vez y lo guarda localmente.

### ¿Puedo tener dos versiones del mismo driver?

No. Instalar una version nueva reemplaza la vieja. La migracion SQL
debe ser idempotente (usar `CREATE TABLE IF NOT EXISTS`).

### ¿Que pasa si el driver tiene un bug?

- El sandbox tiene timeout de 5 segundos — un loop infinito no cuelga el servidor
- Si el driver lanza una excepcion, la transaccion falla y se muestra error
- Puedes desactivar el driver desde la UI
- Puedes instalar una version nueva que reemplaza la vieja

### ¿Es seguro instalar drivers de otros nodos?

Si. El sistema verifica:
1. La firma Ed25519 del paquete
2. Que la firma sea de una clave confiable (self, federated, o manual)
3. Que la migracion SQL solo tenga DDL (no DML)
4. Que el driver.js sea sintacticamente valido
5. El sandbox limita lo que el driver puede hacer (sin I/O, sin red, timeout 5s)
