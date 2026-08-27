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

## 4. Tres niveles de gobernanza

El sistema tiene tres niveles de gobernanza, cada uno independiente internamente pero
sujeto al nivel superior:

### Nivel 1: Federacion (mundial)
Decisiones que afectan a **TODOS los nodos del mundo**. Se deciden por votacion
igualitaria de todos los nodos federados.

- **Canasta basica TQ:** Es la misma en todos los nodos. La moneda trueque no tiene
  inflacion, asi que la canasta basica tiene que ser exactamente la misma en todas
  partes. Si un pais tiene una canasta mas alta y otro mas baja, se crea riqueza en
  un lado y pobreza en el otro, rompiendo el principio de igualdad.
- **Limite de credito global** para todos los nodos.
- **Expulsion de un nodo** que perjudica la red.
- **Protocolo de comunicacion** entre nodos (API federada, mTLS, endpoints).
- **Metrica de valor de la moneda trueque** (calculo por energia, 1 TQ = 1 kWh).
- **Protocolo criptografico de tarjetas NFC** (Ed25519, AES-256-GCM, ECDH).
- **Estructura del ledger contable** (doble entrada, hash chain, suma cero).
- **Umbral de aprobacion** (por defecto 100%).

**Importante:** La canasta basica federada **no tiene nada que ver** con el comercio
exterior. El comercio exterior es directo, en cada nodo, con su moneda local. El Factor
de Conversion (FC) calcula el equivalente entre TQ y la moneda local para comercio
externo, pero eso es interno de cada nodo y no afecta la canasta basica federada.

### Nivel 2: Aldea / Nodo (local)
Decisiones que afectan a **toda la comunidad local**. Se deciden por asamblea del nodo.

- Horas de trabajo y sueldos (cuanto necesita una persona para comer, cuantas horas
  trabaja, cuanto gana).
- Catalogo de productos y precios locales.
- Reglas de gobernanza interna (quorum, niveles de admision, permisos).
- Configuracion del sitio web publico (colores, logo, textos, paginas).
- Moneda de referencia para comercio exterior (UYU, VES, ARS, etc.).
- Servicios federados instalados (Matrix, Nextcloud, VoIP, etc.).
- Adaptaciones culturales y de idioma.
- Horarios de comercio, comisiones, tasas locales.

**Lo que decide la aldea no puede afectar la canasta basica federada.**

### Nivel 3: Organizaciones (dentro de la aldea)
Decisiones que afectan **solo dentro de la organizacion**. Se deciden por la asamblea
de la organizacion.

- Un nodo puede tener varias organizaciones (cooperativas, parcelas, comisiones).
- Cada organizacion es independiente dentro de su propio terreno.
- Cada organizacion puede tener departamentos para dividirse internamente.
- Esta sujeta a las reglas generales de la aldea.

### Resumen

| Nivel | Que decide | Quien decide |
|-------|-----------|-------------|
| Federacion | Cosas que afectan a todo el mundo | Todos los nodos por votacion |
| Aldea/Nodo | Cosas que afectan a toda la comunidad | Asamblea del nodo |
| Organizacion | Cosas que afectan solo a la organizacion | Asamblea de la organizacion |

Las reglas mas grandes (las de la aldea) engloban las cosas mas comunes entre todos.
Las reglas de cada organizacion solo afectan dentro de su terreno. Las reglas
universales afectan al mundo entero.

---

## 5. Lo que se puede modificar localmente sin aprobacion

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

## 11. Piscina global compartida

La federacion tiene una **piscina global multilateral real**. El balance que un
miembro gana con el Nodo B se puede gastar con el Nodo C. Esto no es solo una
verificacion de limites bilaterales, sino un pool compartido real y separado de
los pools bilaterales.

- La piscina global es distinta de los limites bilaterales entre cada par de nodos.
- Las transacciones inter-nodos se registran con `pool_type = 'global'` o
  `pool_type = 'bilateral'` en el ledger.
- Las categorias del ledger son `node_bridge_global` y `node_bridge_bilateral`
  (ademas de `node_bridge` existente).

**Razon:** Si solo existen limites bilaterales, el intercambio se fragmenta en
parejas de nodos y no hay una red real. La piscina global permite que la
reciprocidad fluya entre todos los nodos federados.

---

## 12. Responsabilidad del padrino

Cuando un nodo nivel 2 o superior apadrina a un nodo nuevo, el padrino asume
responsabilidad:

- El limite del padrino se reduce por el monto del limite del nodo apadrinado.
- Si el nodo apadrinado entra en default, la deuda se transfiere al padrino.
- Cuando el nodo apadrinado alcanza el nivel 2, el limite del padrino se libera.

**Razon:** Nadie debe apadrinar a un nodo sin asumir responsabilidad. El sistema
de padrinos asegura que los nodos nuevos tengan respaldo real y que los nodos
establecidos evaluen con cuidado a quienes apadrinan.

---

## 13. Integridad criptografica

Las transacciones inter-nodos usan **firma dual** (ambos nodos firman) y
**hashes encadenados** (`prev_hash`, `tx_hash` en `cross_node_tx_chain`). Cuando
los nodos se reconectan, se realiza una reconciliacion automatica para detectar
discrepancias en la cadena.

**Razon:** Sin firma dual y hashes encadenados, un nodo podria alterar
transacciones unilateralmente. La integridad distribuida asegura que ambos nodos
tengan la misma cadena verificable.

---

## 14. Separacion trueque / comercio

El trueque interno (intercambio TQ entre miembros) y el comercio exterior (ventas
al publico en moneda local) **nunca se mezclan**. Las ventas al publico son
externas al ledger interno y a las piscinas de federacion (global y bilateral).

- El ledger interno solo registra transacciones TQ entre miembros.
- Las ventas al publico se manejan por separado, en moneda local del pais.
- El Factor de Conversion (FC) calcula el equivalente entre TQ y moneda local
  para comercio externo, pero eso es interno de cada nodo.

**Razon:** Mezclar el trueque interno con el comercio exterior destruiria la
economia de credito mutuo. El trueque es reciprocidad entre miembros; el comercio
exterior es intercambio con el mercado convencional. Son cosas distintas con
reglas distintas.

---

## Resumen en una frase

**Un codigo abierto, auditable y unico para todo el mundo, donde todos participan
en el desarrollo de forma igualitaria. Cada quien es dueño de sus datos y puede
adaptar el software a su realidad, pero la base —comunicacion, moneda y
cripitografia— es la misma para todos. La piscina global es compartida, el
padrino responde por su ahijado, las transacciones inter-nodos tienen firma dual
e integridad criptografica, y el trueque interno nunca se mezcla con el comercio
exterior.**
