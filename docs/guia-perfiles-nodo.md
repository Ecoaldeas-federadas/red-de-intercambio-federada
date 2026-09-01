# Guia: Perfiles de Nodo y Productos Prohibidos

> Para **administradores de comunidad**. Explica como configurar el perfil
> religioso/filosofico del nodo, marcar productos como prohibidos, y compartir
> prohibiciones con otros nodos federados.

## Que es un perfil de nodo

Un perfil de nodo define que productos se permiten o prohiben en toda la
comunidad. Por ejemplo:

- **Adventista:** sin alcohol, tabaco, cerdo, cafe
- **ISKCON:** sin carne, huevo, ajo, cebolla, cafe, alcohol
- **Halal Islamico:** sin alcohol, cerdo, carne no-halal
- **Kosher Judio:** sin cerdo, mariscos, mezcla carne+leche

El sistema ya viene con 8 perfiles oficiales. Ademas, puedes **crear perfiles
nuevos** si tu comunidad tiene necesidades especificas.

## Configurar el perfil del nodo

1. Entra a la web admin del nodo
2. Inicia sesion con tu cuenta de admin
3. Ve a **Configuracion del Nodo** (engranaje en el menu)
4. Pestaña **"Perfil del Nodo"**

Ahi veras:

### Perfil actual

Muestra el perfil seleccionado actualmente. Si no hay perfil, todos los
productos estan permitidos.

### Seleccionar perfil

Lista todos los perfiles disponibles (oficiales + custom + recibidos de otros
nodos). Click en un perfil para aplicarlo al nodo.

### Crear nuevo perfil

Si tu comunidad tiene un perfil que no esta en la lista, puedes crearlo:

1. Click **"+ Crear nuevo perfil"**
2. Completa el formulario:
   - **ID:** identificador unico (ej: `adventista_reforma`)
   - **Nombre:** nombre para mostrar (ej: "Adventista Reforma")
   - **Categoria:** cristiana, hindu, islamica, judia, budista, rastafari, secular, custom
   - **Icono:** nombre del icono (ej: `book-open`, `leaf`, `moon`)
   - **Descripcion:** breve descripcion
   - **Reglas base:** que se prohibe (ej: "sin carne, sin alcohol, sin cafe")
3. Click **"Crear"**

El perfil se guarda en la base de datos y se **comparte automaticamente** con
todos los nodos federados via gossip. Otros nodos podran seleccionarlo desde
su UI.

### Quitar perfil

Si quieres que todos los productos esten permitidos, click **"Quitar perfil
del nodo"**.

## Configuracion de sharing federado

Cuando tu nodo tiene un perfil configurado, aparece una seccion de
configuracion de sharing:

### Recibir prohibiciones de nodos federados

- **Activado** (por defecto): recibes prohibiciones de productos de otros
  nodos que tienen tu mismo perfil.
- **Desactivado:** no recibes nada de otros nodos. Eres completamente
  independiente.

### Auto-aprobar prohibiciones recibidas

- **Desactivado** (por defecto): las prohibiciones recibidas aparecen en una
  **cola de aprobacion** para que las revises manualmente.
- **Activado:** las prohibiciones se aplican automaticamente sin revision.

## Prohibiciones de productos

Ademas de las reglas base del perfil (que son por categoria: "carne",
"alcohol"), puedes marcar **productos especificos** como prohibidos.

### Agregar una prohibicion

1. En la seccion "Prohibiciones de productos", completa el formulario:
   - **Nombre del producto:** ej: "Salchicha de cerdo"
   - **Categoria (opcional):** ej: "carne"
   - **Razon (opcional):** ej: "contiene cerdo"
2. Click **"Agregar prohibicion"**

La prohibicion se aplica a tu nodo y se **comparte con todos los nodos
federados** que tienen tu mismo perfil.

### Que hace la prohibicion localmente

Cuando agregas una prohibicion, el sistema busca productos locales cuyo
nombre contenga el termino prohibido y los marca como prohibidos en el
catalogo. Por ejemplo, si prohibes "cerdo", cualquier producto local con
"cerdo" en el nombre se marca como prohibido.

### Desaprobar una prohibicion

Si una prohibicion es un falso positivo (marco un producto que no deberia
estar prohibido), puedes desaprobarla:

1. En la lista de prohibiciones, click el boton de eliminar (rojo)
2. La prohibicion se marca como rechazada en tu nodo
3. El producto afectado deja de estar prohibido
4. **No afecta a otros nodos** — cada nodo es independiente

## Cola de aprobacion

Si tienes **auto-approve desactivado**, las prohibiciones recibidas de otros
nodos aparecen en la cola de aprobacion.

### Revisar prohibiciones pendientes

1. Ve a la seccion "Prohibiciones pendientes de aprobacion"
2. Veras cada prohibicion con:
   - Nombre del producto
   - Razon (si la tiene)
   - Quien la reporto (que nodo federado)
3. Para cada una, puedes:
   - **Aprobar:** marca el producto como prohibido en tu nodo
   - **Rechazar:** ignora la prohibicion para tu nodo

### Por que revisar manualmente?

Porque los productos pueden tener nombres diferentes en distintos nodos.
Por ejemplo, un nodo puede reportar "Chorizo" como prohibido, pero en tu
nodo "Chorizo" puede ser de res (no de cerdo). La revision manual evita
falsos positivos.

## Como funciona el sharing federado

### Flujo completo

```
[Nodo A (adventista)] marca "Salchicha de cerdo" como prohibida
        │
        ▼
[Gossip cada 60s] envia a todos los peers activos
        │
        ▼
[Nodo B (adventista)] recibe la prohibicion
        │
        ├─ Si auto-approve = true → se aplica automaticamente
        └─ Si auto-approve = false → va a cola de aprobacion
        │
        ▼
[Admin del Nodo B] revisa y aprueba o rechaza
```

### Que perfiles se comparten

- Los **8 perfiles oficiales** (adventista, iskcon, etc.) ya estan en todos
  los nodos. No se sobrescriben via federation.
- Los **perfiles custom** creados por cualquier nodo se comparten
  automaticamente. Aparecen en la lista de perfiles de otros nodos.
- Un nodo solo recibe prohibiciones de **peers con el mismo perfil**. Un
  nodo adventista no recibe prohibiciones de un nodo ISKCON.

## Crear un nuevo perfil: ejemplo completo

Supongamos que tu comunidad es adventista pero sigue la rama "Reforma":

1. Ve a **Configuracion > Perfil del Nodo**
2. Click **"+ Crear nuevo perfil"**
3. Completa:
   - ID: `adventista_reforma`
   - Nombre: "Adventista Reforma"
   - Categoria: `cristiana`
   - Icono: `book-open`
   - Descripcion: "Rama reformista del adventismo"
   - Reglas base: "Sin carne, sin alcohol, sin cafe, sin especias fuertes"
4. Click **"Crear"**
5. El perfil aparece en la lista — click para aplicarlo
6. En el proximo ciclo de gossip (60s), el perfil se envia a todos los peers
7. Otros nodos ven "Adventista Reforma" en su lista de perfiles
8. Si alguien mas se identifica con ese perfil, lo puede seleccionar

## Preguntas frecuentes

### ¿Necesito recompilar el servidor o Android?

No. Los perfiles y prohibiciones se gestionan dinamicamente desde la web admin.
No requieren recompilar nada.

### ¿Que pasa si dos nodos reportan prohibiciones contradictorias?

Cada prohibicion es independiente. Si el nodo A reporta "Carne" como
prohibida y el nodo B reporta "Carne de res" como permitida, cada nodo decide
localmente. No hay conflictos — tu nodo, tu decision.

### ¿Puedo dejar de recibir prohibiciones de otros nodos?

Si. Desactiva "Recibir prohibiciones de nodos federados" en la configuracion
de sharing. Tu nodo sera completamente independiente.

### ¿Los perfiles oficiales se pueden borrar?

No. Los perfiles oficiales (creados por los desarrolladores) no se pueden
borrar ni sobrescribir via federation. Los perfiles custom si se pueden
reemplazar.

### ¿Como se hace match entre productos de distintos nodos?

Por nombre (contains, case-insensitive). Si un nodo reporta "cerdo" como
prohibido, el sistema busca productos locales con "cerdo" en el nombre.
Esto puede generar falsos positivos, por eso la revision manual esta
disponible.

### ¿Mi nodo puede usar un perfil que otro nodo creo?

Si. Cuando un nodo crea un perfil custom, se comparte via federation.
Aparece en tu lista de perfiles. Puedes seleccionarlo como cualquier otro.
