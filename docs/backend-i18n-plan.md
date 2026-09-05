# Plan: Internacionalización (i18n) de Notificaciones del Backend

## Problema

El backend en Go genera mensajes de notificación hardcodeados en español. Cuando un usuario tiene la interfaz en inglés, las notificaciones que recibe (email, Telegram, Matrix, Web Push, etc.) llegan en español, creando una experiencia inconsistente.

## Archivos Afectados

Los siguientes archivos del backend contienen mensajes de notificación hardcodeados en español:

- `internal/api/assembly.go`
- `internal/api/federation.go`
- `internal/api/recovery.go`
- `internal/api/scoped_assembly.go`
- `internal/api/cluster_handler.go`
- `internal/api/departments.go`
- `internal/api/handlers.go`
- `internal/api/notification_scheduler.go`
- `internal/api/organization.go`

## Solución Propuesta

### Opción A: Sistema de i18n en el Backend (Recomendada)

Implementar un sistema de traducción en el backend Go que cargue archivos JSON de traducción, similar al frontend.

#### Pasos:

1. **Crear paquete `internal/i18n/`** que:
   - Cargue archivos JSON desde `web/src/locales/{lang}/notifications_backend.json` (o un directorio dedicado `internal/i18n/locales/`).
   - Mantenga un mapa `map[string]map[string]string` de claves → idioma → traducción.
   - Exponga una función `Translate(lang, key, params...)` que reemplace placeholders `{{param}}`.

2. **Determinar el idioma del destinatario**:
   - Cada usuario ya tiene un campo `preferred_language` en la base de datos.
   - Al generar una notificación, consultar el idioma del destinatario y usarlo para traducir el mensaje.

3. **Reemplazar strings hardcodeados**:
   - En cada handler del backend, reemplazar los strings en español por claves de traducción.
   - Ejemplo: `mensaje := "Solicitud de recuperación"` → `mensaje := i18n.Translate(userLang, "notif.recovery_request_created")`.

4. **Crear archivos de traducción**:
   - `notifications_backend.json` en `es/` y `en/` con todas las claves de mensajes.
   - Mantener sincronizadas las claves entre idiomas.

5. **Fallback**:
   - Si no se encuentra la traducción en el idioma del usuario, usar el idioma por defecto del nodo (`default_language` en configuración).
   - Si tampoco se encuentra, usar español como último recurso.

#### Ventajas:
- Notificaciones completamente localizadas según el idioma del usuario.
- Sistema escalable: agregar más idiomas es trivial.
- Consistencia con el sistema de traducción del frontend.

#### Desventajas:
- Mayor complejidad en el backend.
- Necesidad de mantener archivos de traducción adicionales.

### Opción B: Traducir Strings a Inglés (Simplificada)

Traducir todos los strings hardcodeados del backend de español a inglés directamente.

#### Ventajas:
- Implementación rápida.
- Sin código nuevo.

#### Desventajas:
- Los usuarios hispanohablantes recibirán notificaciones en inglés.
- No es una solución real de i18n.

## Recomendación

Implementar la **Opción A** (sistema de i18n en el backend) ya que:
- El proyecto ya tiene un sistema de traducción JSON en el frontend.
- Cada usuario ya tiene `preferred_language` configurado.
- Es la solución correcta a largo plazo.

## Orden de Implementación

1. Crear el paquete `internal/i18n/` con el cargador de traducciones.
2. Crear `notifications_backend.json` en `es/` y `en/`.
3. Modificar `notification_scheduler.go` para usar el idioma del destinatario.
4. Reemplazar strings hardcodeados en los handlers uno por uno.
5. Probar con usuarios en diferentes idiomas.
