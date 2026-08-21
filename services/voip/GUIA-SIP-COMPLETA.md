# Guia SIP Completa - Telefonia VoIP para Aldeas Federadas

Documentacion completa del sistema de telefonia VoIP del nodo. Desde la configuracion basica hasta pasarelas PSTN y facturacion.

---

## 1. Que es SIP y como funciona en la red federada

**SIP** (Session Initiation Protocol) es el protocolo estandar para telefonia por Internet. Permite hacer llamadas de voz y video usando la red en lugar de lineas telefonicas tradicionales.

### Como funciona en la red federada

- Cada nodo (aldea) tiene un **numero unico** (100-999) generado automaticamente
- Cada miembro de la aldea tiene una **extension telefonica** (2001, 2002, etc.)
- Las llamadas **dentro de la aldea** son gratis: marcas solo la extension (2001)
- Las llamadas **entre aldeas federadas** son gratis: marcas NUMERO_NODO + EXTENSION (105-2001)
- Las llamadas a **telefonos normales** (PSTN) tienen costo y requieren saldo prepago

### Ejemplo

```
Aldea 101 tiene las extensiones 2001, 2002, 2003
Aldea 105 tiene las extensiones 2001, 2002

Para llamar de la aldea 101 a la 105:
  Marcar: 1052001 (105 = aldea destino, 2001 = extension)

Para llamar dentro de la aldea 101:
  Marcar: 2001

Para llamar a un telefono normal:
  Marcar: 00 + codigo pais + numero (ej: 00582123456789)
```

---

## 2. Numero de nodo

Cada nodo tiene un numero unico que lo identifica en la red SIP federada.

### Como se genera

- El numero se genera automaticamente a partir del dominio del nodo
- Algoritmo: hash del dominio modulo 900 + 100 (rango 100-999)
- El mismo dominio siempre genera el mismo numero
- Se puede regenerar manualmente si es necesario

### Como generar el numero

1. Ve a "Servicios Federados" en el panel del nodo
2. Haz clic en el boton "Telefonia VoIP"
3. En la seccion "Codigo de Aldea", haz clic en "Generar codigo"
4. El numero aparece inmediatamente

### Como verificar que no haya conflictos

- Cuando dos nodos se federan, intercambian sus numeros
- Si dos nodos tienen el mismo numero, el sistema lo notifica
- Para resolver: regenerar el numero de uno de los nodos
- El numero se comparte automaticamente al federar peers

### Donde se guarda el numero

- Tabla `node_config` campo `node_number`
- Tabla `voip_config` campo `village_code` (compatibilidad)
- Se comparte via federacion en `GetNodeInfo()`

---

## 3. Configuracion automatica de rutas

El sistema puede configurar rutas SIP a todos los nodos federados automaticamente.

### Como funciona

1. El sistema lee todos los peers federados activos
2. Para cada peer que tenga un numero de nodo, crea una ruta VoIP
3. La ruta apunta al dominio/endpoint del peer
4. Ya se pueden hacer llamadas a esa aldea marcando NUMERO + EXTENSION

### Como usarlo

1. Ve a "Servicios Federados" -> "Telefonia VoIP"
2. En la seccion "Rutas a otras aldeas"
3. Haz clic en "Auto-configurar rutas desde nodos federados"
4. El sistema muestra cuantas rutas se configuraron

### API

```
POST /api/voip/auto-configure-routes
```

---

## 4. Extensiones telefonicas locales

Cada miembro de la aldea puede tener una extension telefonica.

### Como crear extensiones

1. Ve a "Servicios Federados" -> "Telefonia VoIP"
2. En la seccion "Extensiones telefonicas locales"
3. Completa:
   - **Extension**: numero de 4 digitos (2001, 2002, etc.)
   - **Nombre**: nombre de la persona
   - **Password**: password SIP (si lo dejas vacio, se genera automaticamente)
4. Haz clic en "Agregar"

### Estructura de una extension

| Campo | Descripcion |
|-------|-------------|
| Extension | Numero de 4 digitos (2000-2999) |
| Display name | Nombre de la persona |
| User ID | Referencia al usuario del nodo (opcional) |
| Password | Password SIP para registrar el cliente |

### API

```
GET  /api/voip/extensions          - listar
POST /api/voip/extensions          - crear
DELETE /api/voip/extensions/{ext}  - eliminar
```

---

## 5. Clientes SIP (como usar el telefono)

### Android

#### Linphone (recomendado, gratis)

1. Descargar Linphone desde [Play Store](https://play.google.com/store/apps/details?id=org.linphone) o [F-Droid](https://f-droid.org/packages/org.linphone/)
2. Abrir Linphone
3. Ir a Configuracion -> Cuentas SIP -> Agregar cuenta
4. Configurar:
   - **Usuario**: tu extension (ej: 2001)
   - **Password**: tu password SIP
   - **Dominio**: IP del servidor o dominio del nodo (ej: nodo.aldea1.com)
   - **Transporte**: UDP
5. Guardar y activar la cuenta
6. Para llamar: marcar la extension (2001) o numero federado (1052001)

#### Zoiper (alternativa)

1. Descargar Zoiper desde Play Store
2. Abrir Zoiper -> Settings -> Accounts -> Add account
3. Configurar:
   - **Account name**: Mi Aldea
   - **Host**: IP o dominio del nodo
   - **Username**: extension (2001)
   - **Password**: password SIP
4. Guardar
5. Para llamar: marcar el numero

### iOS

#### Linphone

1. Descargar Linphone desde App Store
2. Misma configuracion que Android

#### Zoiper

1. Descargar Zoiper desde App Store
2. Misma configuracion que Android

### Windows / Mac / Linux

#### Linphone (multiplataforma)

1. Descargar desde [linphone.org](https://www.linphone.org/)
2. Instalar
3. Configuracion igual que movil:
   - Usuario: extension
   - Password: password SIP
   - Dominio: IP o dominio del nodo
   - Transporte: UDP

#### MicroSIP (Windows, ligero)

1. Descargar desde [microsip.org](https://www.microsip.org/)
2. Instalar
3. Configurar:
   - Tools -> Settings -> Account
   - **Username**: extension (2001)
   - **Domain**: IP o dominio del nodo
   - **Password**: password SIP
4. Guardar

#### Zoiper Desktop

1. Descargar desde [zoiper.com](https://www.zoiper.com/)
2. Misma configuracion que movil

#### Telephone (macOS)

1. Descargar desde Mac App Store
2. Agregar cuenta SIP con los mismos datos

### Telefonos IP hardware

Modelos recomendados:
- **Grandstream GXP1625** - economico, 1 linea
- **Yealink SIP-T19P** - economico, 1 linea
- **Cisco SPA303** - 3 lineas
- **Grandstream GXP2160** - 6 lineas

Configuracion (similar en todos):
1. Conectar el telefono a la red
2. Acceder via web (IP del telefono)
3. Configurar cuenta SIP:
   - **SIP Server**: IP o dominio del nodo
   - **User ID**: extension (2001)
   - **Password**: password SIP
4. Guardar y reiniciar

### Adaptadores ATA (para telefonos analogos)

Los adaptadores ATA permiten conectar un telefono analogo tradicional a la red VoIP.

Modelos recomendados:
- **Grandstream HT-503** - 1 puerto FXS, 1 puerto FXO
- **Linksys/Sisco PAP2T** - 2 puertos FXS
- **Obihai OBi200** - 1 puerto FXS

Configuracion:
1. Conectar el ATA a la red
2. Acceder via web
3. Configurar cuenta SIP:
   - **SIP Server**: IP o dominio del nodo
   - **User ID**: extension (2001)
   - **Password**: password SIP
4. Conectar el telefono analogo al puerto FXS
5. Ya se puede hacer y recibir llamadas con el telefono analogo

---

## 6. Pasarelas PSTN (llamadas a telefonos normales)

Las pasarelas PSTN permiten llamar a numeros de telefono normales (fijos y moviles) fuera de la red federada.

### Que se necesita

1. Una cuenta con un proveedor SIP trunk
2. Saldo con el proveedor (se paga en dinero real)
3. Configurar la pasarela en el nodo

### Proveedores SIP trunk recomendados

| Proveedor | Pais | Costo aprox | Notas |
|-----------|------|-------------|-------|
| [VoIP.ms](https://voip.ms) | Internacional | ~$0.005/min | Buenos precios, numeros de muchos paises |
| [Localphone](https://localphone.com) | Internacional | ~$0.01/min | Facil de usar |
| [Callcentric](https://callcentric.com) | USA/Internacional | ~$0.015/min | Numeros DID gratis en algunos casos |
| [Skype Connect](https://skype.com) | Internacional | ~$0.02/min | Integracion con Skype |
| [Twilio](https://twilio.com) | Internacional | ~$0.01/min | API potente, pago por uso |

### Como configurar una pasarela

1. Registrarse con un proveedor SIP trunk
2. Obtener: servidor SIP, usuario, password
3. Opcional: comprar un numero DID (numero telefonico entrante)
4. En el nodo: "Servicios Federados" -> "Telefonia VoIP" -> "Pasarelas PSTN"
5. Completar:
   - **Nombre**: descriptivo (ej: "VoIP.ms")
   - **Proveedor**: nombre del proveedor
   - **Servidor SIP**: direccion del proveedor (ej: newyork.voip.ms)
   - **Usuario SIP**: tu usuario
   - **Password SIP**: tu password
   - **Numero entrante**: tu numero DID (opcional)
   - **Costo/min**: cuanto te cobra el proveedor (en centavos de TQ)
   - **Llamadas simultaneas**: maximo de llamadas concurrentes
6. Guardar

### Como recibir llamadas entrantes

1. El proveedor SIP trunk te asigna un numero DID (ej: +1-555-1234)
2. Cuando alguien llama a ese numero, la llamada entra por la pasarela
3. Se puede enrutar a:
   - Una extension especifica (recepcion)
   - Un menu de voz ("marque la extension o espere")
   - Un grupo de extensiones

### Como enrutar llamadas entrantes

La configuracion de enrutamiento entrante se hace en el archivo `extensions.conf` de Asterisk:

```
[from-pstn]
; Llamada entrante del numero DID +1-555-1234
exten => +15551234,1,Dial(PJSIP/2001,30)
exten => +15551234,n,Voicemail(2001)
exten => +15551234,n,Hangup()
```

### API

```
GET    /api/voip/pstn-gateways          - listar
POST   /api/voip/pstn-gateways          - crear
DELETE /api/voip/pstn-gateways/{id}     - eliminar
```

---

## 7. Saldo prepago y facturacion

### Llamadas gratis vs pagas

| Tipo de llamada | Costo |
|-----------------|-------|
| Interna (misma aldea) | Gratis |
| Federada (otra aldea) | Gratis |
| PSTN (telefono normal) | Con costo (requiere saldo) |

### Como funciona el saldo prepago

1. Cada miembro tiene un **saldo en TQ** (la moneda comunitaria)
2. Para hacer llamadas PSTN, necesita saldo
3. **Recarga saldo** via transferencia o efectivo
4. Un **administrador confirma** la recarga
5. Al hacer llamadas PSTN, se **descuenta automaticamente** del saldo
6. Si no hay saldo, la llamada PSTN se rechaza

### Como recargar saldo

1. Ve a "Servicios Federados" -> "Telefonia VoIP" -> "Saldo prepago"
2. Ingresa:
   - **Monto**: cantidad en centavos de TQ (100 = 1.00 TQ)
   - **Metodo**: transferencia o efectivo
   - **Referencia**: numero de transferencia o comprobante
3. Haz clic en "Solicitar recarga"
4. Un administrador debe confirmar la recarga
5. El saldo se actualiza inmediatamente despues de la confirmacion

### Como confirma un administrador

1. El admin ve las recargas pendientes
2. Verifica que el pago fue recibido
3. Confirma la recarga
4. El saldo del usuario se actualiza

### Tarifas por destino

Las tarifas se configuran por prefijo de pais:

| Prefijo | Descripcion | Tarifa (TQ/min) |
|---------|-------------|-----------------|
| 58 | Venezuela | 0.50 |
| 1 | USA/Canada | 0.20 |
| 34 | Espana | 0.30 |
| 52 | Mexico | 0.25 |
| 57 | Colombia | 0.25 |
| 55 | Brasil | 0.30 |
| 00 | Internacional resto | 1.00 |

### Como se calcula el costo

```
Costo = (duracion_facturada / 60) * tarifa_por_minuto
```

La duracion facturada se redondea al incremento de facturacion (generalmente 60 segundos).

### API

```
GET  /api/voip/balance                  - mi saldo
POST /api/voip/recharge                 - solicitar recarga
GET  /api/voip/recharges                - listar recargas
POST /api/voip/recharges/{id}/confirm   - confirmar (admin)
GET  /api/voip/rates                    - tarifas
GET  /api/voip/cdr                      - registro de llamadas
```

---

## 8. Plan de marcacion

| Marcado | Tipo de llamada | Ejemplo |
|---------|-----------------|---------|
| 2XXX | Extension local | 2001 |
| NUMERO_NODO + 2XXX | Llamada federada | 1052001 (aldea 105, ext 2001) |
| 00 + codigo_pais + numero | Llamada PSTN | 00582123456789 |
| *97 | Buzon de voz | - |
| *98 | Conferencia | - |

### Numeros de emergencia

Configurar segun pais. Ejemplo para Venezuela:
- 911 - Emergencias
- 171 - Bomberos
- Ver `extensions.conf` para configurar

---

## 9. Seguridad

### Cambiar passwords por defecto

- **NUNCA** usar passwords por defecto en produccion
- Generar passwords aleatorios para cada extension
- El sistema genera passwords automaticamente si se deja vacio

### Usar TLS cuando sea posible

- SIP sobre TLS (puerto 5061) cifra la senalizacion
- SRTP cifra el audio
- Requiere certificado (el wildcard de OpenWrt sirve)

### Limitar acceso al puerto SIP

En el firewall (OpenWrt o iptables):
- Permitir SIP (5060/udp) solo desde redes conocidas
- Permitir RTP (10000-20000/udp) solo desde redes conocidas
- Bloquear SIP desde Internet si no se necesita

### Prevenir fraude telefonico

- **Solo usuarios con saldo pueden hacer llamadas PSTN**
- Limitar llamadas internacionales
- Monitorear el CDR para detectar uso anomalo
- Limitar llamadas simultaneas por usuario
- Bloquear destinos costosos si no son necesarios

---

## 10. Resolucion de problemas

### No puedo registrarme (el cliente SIP no conecta)

1. Verificar que el servidor Asterisk esta corriendo:
   ```bash
   docker ps | grep asterisk
   ```
2. Verificar IP/dominio del servidor en el cliente
3. Verificar extension y password
4. Verificar que el puerto 5060/udp esta abierto
5. Verificar firewall

### No tengo audio (la llamada conecta pero no se escucha)

1. Verificar que los puertos RTP (10000-20000/udp) estan abiertos
2. Verificar NAT: si el servidor esta detras de NAT, configurar:
   - `nat=yes` en Asterisk
   - `externip=` o `localnet=` en sip.conf
3. Verificar que el codec es compatible (ulaw, alaw, g722)

### No puedo llamar a otra aldea

1. Verificar que hay una ruta VoIP a esa aldea
2. Verificar que el numero de nodo es correcto
3. Verificar conectividad de red entre aldeas (ping)
4. Verificar que el puerto SIP del nodo remoto es accesible
5. Usar "Auto-configurar rutas" para actualizar

### Calidad mala

1. Verificar ancho de banda (minimo 100kbps por llamada)
2. Usar codec G.722 (mejor calidad) en lugar de G.711
3. Si hay perdida de paquetes, usar G.729 (menor calidad pero mas resistente)
4. Verificar latencia entre aldeas (ideal < 100ms)
5. Si la aldea remota esta lejos, considerar un servidor STUN/TURN

### La llamada PSTN no funciona

1. Verificar que la pasarela PSTN esta activa
2. Verificar credenciales del proveedor SIP trunk
3. Verificar saldo con el proveedor
4. Verificar que el usuario tiene saldo prepago en el nodo
5. Revisar el CDR para ver el error

### Error "403 Forbidden"

- Password SIP incorrecto
- La extension no existe
- El proveedor SIP trunk rechazo la llamada (saldo agotado?)

### Error "404 Not Found"

- El numero marcado no existe
- La ruta no esta configurada
- El dominio del nodo remoto no resuelve

---

## Puertos utilizados

| Puerto | Protocolo | Uso |
|--------|-----------|-----|
| 5060 | UDP/TCP | Senalizacion SIP |
| 5061 | TCP | SIP sobre TLS (opcional) |
| 10000-20000 | UDP | Audio RTP |
| 80 | TCP | Interfaz web FreePBX (si se usa) |

---

## Configuracion de Asterisk

Los archivos de configuracion de Asterisk se generan desde el nodo usando plantillas:

- `services/voip/asterisk/extensions.conf.tpl` - plan de marcacion
- `services/voip/asterisk/pjsip.conf.tpl` - endpoints y trunks SIP
- `services/voip/asterisk/rtp.conf.tpl` - puertos de audio

Las plantillas usan variables que se reemplazan:
- `{{VILLAGE_CODE}}` - numero de aldea
- `{{NODE_DOMAIN}}` - dominio del nodo
- `{{SIP_PORT}}` - puerto SIP
- `{{RTP_START}}` / `{{RTP_END}}` - rango de puertos RTP
- `{{#EXTENSIONS}}` - lista de extensiones
- `{{#ROUTES}}` - lista de rutas federadas
