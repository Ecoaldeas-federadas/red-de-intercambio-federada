# Principios Innegociables para Desarrollar en la Red de Intercambio Federada

Este documento define las reglas basicas que NO se negocian para cualquier desarrollo
que forme parte de la Red de Intercambio Federada (Sistema TQ). Es un documento corto,
claro y directo, pensado para que cualquier programador entienda las reglas antes de
empezar a colaborar.

---

## 1. Todo el codigo es abierto y auditable

Todo codigo desarrollado para la red debe ser **100% de codigo abierto**. Cualquiera
debe poder auditarlo, revisarlo, modificarlo y adaptarlo a su propia aldea. No se
aceptan codigos cerrados, licencias privativas, o dependencias de software que no
sean libres y gratuitos.

**Razon:** Si el codigo no se puede auditar, no se puede confiar en el. La confianza
de la red depende de que todos puedan verificar que el sistema funciona como dice
funcionar.

---

## 2. Un codigo base unico

Todo desarrollo nuevo debe implementarse primero en el **codigo base oficial** del
proyecto (Go, React, Kotlin, C/C++ para ESP32). Ese codigo base es el punto de partida.

Despues, si alguien quiere desarrollar la misma funcionalidad en otro lenguaje porque
le gusta mas, **tiene la libertad de hacerlo**. Pero tiene que garantizar que ese
codigo:

- Implemente **exactamente la misma logica** y el mismo funcionamiento.
- Sea **100% compatible** con el codigo base: pueda conversar correctamente con
  todas las implementaciones que estan en el codigo base.
- Pase las mismas pruebas y validaciones.

**Razon:** Si cada quien desarrolla por su lado sin partir del codigo base,
fragmentamos la red. La idea es que todos trabajemos en un codigo donde todos sepamos
que existe, lo auditemos juntos, y las mejoras beneficien a todos.

---

## 3. Todo codigo debe tener ajustes para cambiar de nodo

Todo codigo desarrollado en cualquier lenguaje debe tener en sus ajustes la opcion de
**cambiar la URL del nodo por defecto**. Aunque un desarrollador cree un codigo con
la URL de su nodo para que la gente de su nodo no tenga que configurar nada, el codigo
debe permitir cambiarlo para usar otro nodo.

**Razon:** Si un codigo solo funciona con un nodo, no es universal. Cualquier aldea
del mundo debe poder usar cualquier implementacion cambiando solo la URL de su nodo
en los ajustes.

---

## 4. Lo que requiere aprobacion de todos los nodos

Estas cosas **no se pueden modificar unilateralmente**. Requieren aprobacion por
votacion de todos los nodos federados:

- **Protocolo de comunicacion entre nodos** (API federada, mTLS, endpoints).
- **Metrica de valor de la moneda trueque** (calculo por energia, 1 TQ = 1 kWh).
- **Protocolo criptografico de tarjetas NFC** (Ed25519, AES-256-GCM, ECDH, formato
  de lectura BIN-style).
- **Estructura del ledger contable** (doble entrada, hash chain, suma cero).
- **Reglas de expulsion de nodos** de la red.

**Razon:** Si un nodo cambia el protocolo de comunicacion, los demas nodos no pueden
entenderlo. Si un nodo cambia la metrica de valor, el comercio inter-nodos se vuelve
injusto. Estas cosas afectan a TODA la red, no a un solo nodo.

---

## 5. Lo que se puede modificar localmente sin aprobacion

Cada nodo es soberano y puede modificar sin pedir permiso:

- Catalogo de productos y precios locales.
- Reglas de gobernanza interna (quorum, niveles de admision, permisos).
- Configuracion del sitio web publico (colores, logo, textos, paginas).
- Moneda de referencia para mostrar precios externos (UYU, VES, ARS, etc.).
- Servicios federados instalados (Matrix, Nextcloud, VoIP, etc.).
- Adaptaciones culturales y de idioma.
- Horarios de comercio, comisiones, tasas locales.

**Razon:** Cada comunidad es independiente y tiene su propia realidad. La federacion
no se entromete en las decisiones internas de cada nodo.

---

## 6. Implementaciones locales vs implementaciones federadas

Si desarrollas algo que **solo afecta a tu nodo local** y no afecta a los demas nodos,
puedes usarlo localmente sin aprobacion. Pero:

- **Siempre piensa en desarrollarlo de forma que pueda ser usado mundialmente.**
- Mientras no se haya probado a nivel federado, solo lo puedes usar en tu nodo local.
- Pero la posibilidad de que se pueda expandir debe estar ahi desde el inicio.
- **Se sugiere no hacer implementaciones que solo sean del nodo local para siempre.**
  Si algo funciona en tu nodo, ponlo a disposicion de los demas para que lo puedan
  usar, probar y aprobar.

**Razon:** Si bien es cierto que algo puede funcionar solo localmente, no ponerlo a
disposicion de los demas es muy diferente a simplemente hacerlo local y nunca
expandirlo. La idea es apoyarnos entre todos.

---

## 7. Las mejoras se comparten con todos

Toda mejora, modulo, o adaptacion que se desarrolle debe ponerse a disposicion de
toda la red mediante el codigo base oficial (Pull Request al repositorio central).

- Si desarrollas una funcion para tu pais, programala de manera **generica y limpia**
  para que cualquier pais la pueda usar.
- Sube la propuesta mediante un Pull Request.
- Una vez auditado y aprobado, se integra al software maestro.
- **Cualquier aldea o pais que descargue o actualice la plataforma tendra acceso a
  esa mejora.**

**Razon:** La idea es compartir, no acapararse las ventajas. Si yo invento algo que
funciona, no me lo guardo para mi nada mas. Lo comparto para que otros no tengan que
inventar desde cero.

---

## 8. Las decisiones se toman en lenguaje humano

Las nuevas implementaciones se explican en **lenguaje humano**, no de computadora.
Los que saben programar escriben el codigo. Los que no saben programar:

- Lo auditan y lo entienden (con explicaciones en lenguaje claro).
- Aceptan o rechazan los cambios en votacion.
- Citan de acuerdo con las nuevas implementaciones.

**Razon:** Si solo los programadores entienden las decisiones, la gobernanza no es
igualitaria. Todos deben poder entender que se esta cambiando y por que.

---

## 9. Copiar modelos que funcionan

La idea es ser 100% transparentes. Viene alguien nuevo, analiza las aldeas existentes:
cual es su gobernanza interna, como funciona, y puede **copiar el modelo** para
implementar en su propia aldea sin arrancar desde cero dandose golpes.

- Compartimos experiencias.
- Compartimos la manera de gobernanza que nos ha dado exito.
- Compartimos los codigos.
- Los codigos se crean completamente limpios para que cualquiera lo pueda adaptar a
  su realidad.

**Razon:** Somos una red que nos apoyamos. Lo que uno inventa, lo pone a disposicion
de los demas. Asi construimos juntos en lugar de duplicar esfuerzos.

---

## 10. La federacion es voluntaria pero el protocolo es unico

Nadie esta obligado a federarse. Un nodo puede funcionar de forma aislada si quiere.
Pero **si decide federarse**, debe usar el mismo protocolo que todos los demas.

- La federacion es voluntaria.
- El protocolo de federacion es unico e innegociable.
- Los limites inter-nodos se negocian bilateralmente entre cada par de nodos.
- La expulsion de un nodo requiere votacion de los demas.

**Razon:** Si la federacion es voluntaria pero cada quien usa su propio protocolo,
no hay federacion. La federacion existe solo si todos hablan el mismo idioma
tecnico.

---

## Resumen en una frase

**Un codigo abierto, auditable y unico para todo el mundo, donde todos participan
en el desarrollo de forma igualitaria. Cada quien es dueño de sus datos y puede
adaptar el software a su realidad, pero la base —comunicacion, moneda y
cripitografia— es la misma para todos.**
