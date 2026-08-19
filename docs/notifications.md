# Modulo de Notificaciones

## Estado: EN DESARROLLO

Este documento describe el modulo completo de notificaciones. Se va implementando por fases. Marca lo completado.

---

## Fase 1: Infraestructura base (COMPLETADO)

- [x] Tabla `notifications` — notificaciones generales por usuario
- [x] Tabla `notification_channels` — canales de entrega (in_app, email, sms, whatsapp)
- [x] Tabla `notification_gateway_config` — configuracion de pasarelas (SMTP, Twilio, Meta WhatsApp, etc.)
- [x] Tabla `notification_preferences` — preferencias por usuario y tipo
- [x] Endpoint `GET /api/notifications` — listar notificaciones del usuario
- [x] Endpoint `PUT /api/notifications/{id}/read` — marcar como leida
- [x] Endpoint `PUT /api/notifications/read-all` — marcar todas como leidas
- [x] Endpoint `GET /api/notifications/unread-count` — contador de no leidas
- [x] Campana de notificaciones en el header (Layout.tsx)
- [x] Panel desplegable con lista de notificaciones
- [x] Resumen de asambleas pendientes en el Dashboard

## Fase 2: Notificaciones por evento (COMPLETADO)

- [x] Pago recibido — cuando alguien te transfiere TQ
- [x] Asamblea programada — cuando se crea una sesion nueva
- [x] Asamblea proxima — recordatorio N dias antes (reusa assembly_notifications)
- [x] Votacion abierta — cuando se abre la votacion de una propuesta
- [x] Resultado de votacion — cuando se cierra la votacion
- [x] Propuesta creada — cuando se crea una propuesta nueva
- [x] Solicitud de federacion — para la junta directiva
- [x] Solicitud de recuperacion — para los aprobadores
- [x] Admision aprobada/rechazada — para el aspirante
- [x] Miembro asignado a departamento — para el miembro
- [x] Limite de federacion cercano — alerta de limite

## Fase 3: Pasarelas de entrega (PENDIENTE)

### Prioridad: redes federadas/libres

El proyecto impulsa redes federadas y soberanas. Se priorizan:

1. **Matrix** (federada, soberana, self-hosted) — PRIORIDAD ALTA
2. **Telegram** (bot API, facil de configurar) — PRIORIDAD ALTA
3. **XMPP** (federada, estandar abierto) — PRIORIDAD MEDIA
4. **Email SMTP** (estandar abierto, universal) — PRIORIDAD ALTA
5. **Web Push** (estandar W3C, no requiere terceros) — PRIORIDAD MEDIA
6. **WhatsApp** (proprietario, opcion disponible pero no prioritaria) — PRIORIDAD BAJA

### Matrix (federada)
- [ ] Configuracion: `homeserver_url`, `access_token`, `default_room_id`
- [ ] Soporte para Matrix Client-Server API (estandar abiertto)
- [ ] Envio a sala publica o DM directo
- [ ] Compatible con Synapse, Dendrite, Conduit (self-hosted)
- [ ] Soporte para federacion entre homeservers

### Telegram Bot
- [ ] Configuracion: `bot_token`, `default_chat_id`
- [ ] Envio via Bot API: `https://api.telegram.org/bot{token}/sendMessage`
- [ ] Soporte para markdown y HTML en mensajes
- [ ] Comandos del bot: `/balance`, `/asambleas`, `/ayuda`

### XMPP (Jabber federado)
- [ ] Configuracion: `xmpp_server`, `xmpp_username`, `xmpp_password`
- [ ] Envio via XMPP client (libreria Go xmpp)
- [ ] Soporte para federacion entre servidores XMPP

### Email (SMTP)
- [ ] Configuracion SMTP en ajustes (host, puerto, usuario, password, from)
- [ ] Envio de email al crear notificacion
- [ ] Plantillas HTML por tipo de notificacion
- [ ] Verificacion de configuracion (boton "enviar email de prueba")

### Web Push (W3C, sin terceros)
- [ ] Service worker para push notifications
- [ ] Configuracion de VAPID keys (generables localmente)
- [ ] Suscripcion del usuario
- [ ] No requiere servicios externos

### WhatsApp (opcion disponible, no prioritaria)
- [ ] Meta WhatsApp Cloud API: `phone_number_id`, `access_token`
- [ ] API propia (Pixie, etc.): `endpoint_url`, `auth_token`
- [ ] Plantillas aprobadas por Meta (requiere aprobacion externa)

### Pasarela personalizada (generic webhook)
- [ ] Configuracion: `endpoint_url`, `auth_token`, `method`, `payload_template`
- [ ] Permite integrar cualquier servicio via webhook
- [ ] Template JSON con variables: `{title}`, `{message}`, `{link}`, `{user}`

## Fase 4: Preferencias de usuario (PENDIENTE)

- [ ] Pagina de preferencias: que notificaciones recibir y por que canal
- [ ] Por tipo: pagos, asambleas, federacion, recuperacion, etc.
- [ ] Por canal: in_app, email, sms, whatsapp
- [ ] Frecuencia de email: inmediato, diario, semanal
- [ ] Horario de no molestar (no enviar SMS de noche)

## Fase 5: Notificaciones por scope (PENDIENTE)

- [ ] Notificaciones para la junta directiva (federacion, configuracion)
- [ ] Notificaciones para el secretario (minutas, asistencia)
- [ ] Notificaciones para el director de organizacion
- [ ] Notificaciones para miembros de departamento
- [ ] Notificaciones para aprobadores de recuperacion
- [ ] Filtrar por rol/permiso al enviar

---

## Tipos de Notificacion

| Tipo | Descripcion | Quien la recibe | Canal default |
|------|-------------|-----------------|---------------|
| `payment_received` | Recibiste X TQ de Y | Receptor | in_app |
| `payment_sent` | Enviaste X TQ a Y | Emisor | in_app |
| `assembly_scheduled` | Asamblea programada para FECHA | Miembros con voto | in_app + email |
| `assembly_reminder` | Recordatorio: asamblea en N dias | Miembros con voto | in_app + email |
| `assembly_started` | La asamblea ha comenzado | Miembros con voto | in_app |
| `assembly_closed` | Asamblea cerrada, minuta disponible | Miembros con voto | in_app |
| `voting_opened` | Votacion abierta para propuesta X | Miembros con voto | in_app |
| `voting_closed` | Resultado de votacion: aprobada/rechazada | Miembros con voto | in_app |
| `proposal_created` | Nueva propuesta creada | Miembros con voto | in_app |
| `federation_request` | Solicitud de federacion de nodo X | Junta directiva | in_app + email |
| `federation_approved` | Federacion aprobada con nodo X | Solicitante | in_app |
| `recovery_request` | Solicitud de recuperacion de cuenta | Aprobadores | in_app + email |
| `recovery_approved` | Tu recuperacion fue aprobada | Solicitante | in_app |
| `admission_approved` | Tu admision fue aprobada | Aspirante | in_app + email |
| `admission_rejected` | Tu admision fue rechazada | Aspirante | in_app + email |
| `dept_assigned` | Fuiste asignado al departamento X | Miembro | in_app |
| `dept_removed` | Fuiste removido del departamento X | Miembro | in_app |
| `org_board_assigned` | Fuiste asignado a la junta de la org X | Miembro | in_app |
| `federation_limit_warning` | Te acercas al limite con nodo X | Junta directiva | in_app + email |
| `tax_distribution` | Se distribuyeron X TQ de la asamblea | Miembros con voto | in_app |
| `product_federation_request` | Solicitud de federar producto X | Junta directiva | in_app |
| `assembly_rescheduled` | Asamblea reprogramada para FECHA | Miembros con voto | in_app + email |
| `quorum_not_reached` | No se alcanzo el quorum | Miembros con voto | in_app |

---

## Esquema de Base de Datos

### `notifications`
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  notification_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  -- Datos adicionales en JSON (ej: monto, remitente, sesion_id)
  metadata JSONB,
  -- Link relativo para ir al detalle (ej: /app/assembly)
  link VARCHAR(255),
  -- Estado
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  -- Canales de entrega
  channels_tried TEXT[], -- ['in_app', 'email', 'sms']
  channels_delivered TEXT[], -- ['in_app', 'email']
  delivery_errors JSONB, -- errores por canal
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
```

### `notification_channels`
```sql
CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_code VARCHAR(50) NOT NULL UNIQUE, -- 'in_app', 'email', 'sms', 'whatsapp', 'telegram'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  requires_config BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);
```

### `notification_gateway_config`
```sql
CREATE TABLE notification_gateway_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_domain VARCHAR(255) NOT NULL,
  channel_code VARCHAR(50) NOT NULL, -- 'email', 'sms', 'whatsapp', 'telegram'
  -- Configuracion en JSON (host, puerto, password, tokens, etc.)
  -- Los secretos se encriptan en el backend antes de guardar
  config JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(node_domain, channel_code)
);
```

### `notification_preferences`
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  notification_type VARCHAR(100) NOT NULL,
  channel_code VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, notification_type, channel_code)
);
```

---

## API

### Notificaciones del usuario

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/notifications` | Listar notificaciones (limit=50, offset) |
| GET | `/api/notifications/unread-count` | Contador de no leidas |
| PUT | `/api/notifications/{id}/read` | Marcar como leida |
| PUT | `/api/notifications/read-all` | Marcar todas como leidas |
| DELETE | `/api/notifications/{id}` | Eliminar notificacion |

### Configuracion de pasarelas (admin)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/notifications/gateways` | Listar pasarelas configuradas |
| PUT | `/api/notifications/gateways/{channel}` | Configurar pasarela |
| POST | `/api/notifications/gateways/{channel}/test` | Enviar mensaje de prueba |

### Preferencias de usuario

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/notifications/preferences` | Listar preferencias del usuario |
| PUT | `/api/notifications/preferences` | Actualizar preferencias |

---

## Pasarelas Soportadas

### In-App (siempre activo)
- **Config**: Ninguna
- **Entrega**: Se guarda en `notifications` y se muestra en la campana

### Matrix (federada, soberana)
- **Config**: `homeserver_url`, `access_token`, `default_room_id`
- **API**: Matrix Client-Server API r0 (estandar abierto)
- **Compatibilidad**: Synapse, Dendrite, Conduit (self-hosted)
- **Federacion**: Mensajes entre homeservers distintos
- **Ventaja**: Red propia, federada, sin depender de terceros

### Telegram Bot
- **Config**: `bot_token`, `default_chat_id`
- **API**: `https://api.telegram.org/bot{token}/sendMessage`
- **Soporte**: Markdown y HTML en mensajes
- **Comandos**: `/balance`, `/asambleas`, `/ayuda`

### XMPP (Jabber federado)
- **Config**: `xmpp_server`, `xmpp_username`, `xmpp_password`
- **Libreria**: Go XMPP client
- **Federacion**: Mensajes entre servidores XMPP distintos
- **Ventaja**: Estandar abierto, federado, self-hostable

### Email (SMTP)
- **Config**: `host`, `port`, `username`, `password`, `from_email`, `from_name`, `use_tls`
- **Libreria**: `net/smtp` estandar de Go
- **Plantillas**: HTML con logo del nodo
- **Ventaja**: Universal, estandar abierto

### Web Push (W3C)
- **Config**: VAPID public/private keys (generables localmente)
- **Entrega**: Service worker del navegador
- **Ventaja**: No requiere servicios externos

### WhatsApp (Meta Cloud API)
- **Config**: `phone_number_id`, `access_token`, `verify_token`
- **API**: `https://graph.facebook.com/v18.0/{phone_number_id}/messages`
- **Requisito**: Plantillas aprobadas por Meta
- **Nota**: Opcion disponible, no prioritaria (red proprietaria)

### WhatsApp API personalizada
- **Config**: `endpoint_url`, `auth_token`, `phone_field`, `message_field`
- **Uso**: Para servicios como Pixie, WhatsApp Business API local, etc.

### Webhook generico (cualquier servicio)
- **Config**: `endpoint_url`, `auth_token`, `method`, `payload_template`
- **Uso**: Integrar cualquier servicio via HTTP POST
- **Template**: JSON con variables `{title}`, `{message}`, `{link}`, `{user}`

---

## Frontend

### Campana de notificaciones (Layout.tsx)
- Icono de campana en el header
- Badge con contador de no leidas
- Al hacer clic, panel desplegable con lista
- Polling cada 30 segundos para actualizar contador
- Click en notificacion: marcar como leida + navegar al `link`

### Panel de notificaciones
- Lista scrollable con ultimas 50
- Icono por tipo (pago, asamblea, votacion, etc.)
- Fecha relativa ("hace 2 horas")
- Boton "Marcar todas como leidas"
- Link "Ver todas" -> pagina dedicada

### Dashboard
- Nueva tarjeta: "Asambleas Pendientes"
- Muestra proximas asambleas (scheduled)
- Click -> va a /app/assembly

### Pagina de ajustes de notificaciones
- Configuracion de pasarelas (solo admin)
- Preferencias por usuario
- Test de pasarela

---

## Arquitectura

```
Evento (pago, asamblea, etc.)
      |
      v
notifyService.Create(usuarios, tipo, titulo, mensaje, metadata, link)
      |
      v
INSERT INTO notifications (...)
      |
      v
Entrega por canales (async):
  - in_app: ya hecho (INSERT)
  - email: si tiene email y esta activo -> SMTP
  - sms: si tiene telefono y esta activo -> Twilio
  - whatsapp: si tiene telefono y esta activo -> Meta/Pixie
  - telegram: si tiene chat_id y esta activo -> Telegram API
```

El servicio de notificaciones es una funcion Go que se llama desde cualquier handler. No bloquea la respuesta HTTP; el envio por pasarelas se hace en una goroutine.

---

## Migraciones

- `059_notifications.sql` — Tablas del modulo de notificaciones

---

## Estado de implementacion

### Fase 1: Infraestructura base - COMPLETA
- [x] Migracion 059: tablas notifications, notification_channels, notification_gateway_config, notification_preferences
- [x] Campos en users: email, phone, telegram_chat_id, matrix_user_id, xmpp_jid
- [x] NotificationHandler con endpoints REST
- [x] NotifyService: Notify, NotifyMany, NotifyVotingMembers, NotifyBoard
- [x] Campana de notificaciones en Layout.tsx
- [x] Panel desplegable con lista y badge de no leidas
- [x] Polling cada 30 segundos
- [x] Tarjeta de Asambleas Pendientes en Dashboard

### Fase 2: Notificaciones por evento - COMPLETA
- [x] Pago recibido (transfer)
- [x] Asamblea programada (createSession)
- [x] Votacion abierta (openVoting)
- [x] Resultado de propuesta aprobada (executeProposal)
- [x] Resultado de propuesta rechazada (executeProposal)
- [x] Quorum alcanzado / no alcanzado (verifyQuorum)
- [x] Minuta publicada / asamblea cerrada (closeSession)
- [x] Admision aprobada (approveAdmission)
- [x] Admision rechazada (rejectAdmission)
- [x] Solicitud de recuperacion creada (createRequest)
- [x] Miembro asignado a departamento (assignMember)
- [x] Miembro asignado a junta de organizacion (assignOrganizationBoardMember)
- [x] Organizacion aprobada (approveOrganization)
- [x] Nodo par registrado (registerPeer)
- [x] Producto federado aprobado (approveProductProposal)

### Fase 3: Servicio de envio por pasarelas - COMPLETA
- [x] GatewayService con entrega en background (goroutine)
- [x] Email via SMTP (sendEmail)
- [x] Telegram Bot API (sendTelegram)
- [x] Matrix Client-Server API (sendMatrix)
- [x] XMPP via HTTP API / bridge (sendXMPP)
- [x] Webhook generico (sendWebhook)
- [x] WhatsApp Meta Cloud API (sendWhatsAppMeta)
- [x] WhatsApp API propia (sendWhatsAppCustom)
- [x] Respeto de preferencias del usuario por canal
- [x] Registro de canales entregados y errores de entrega
- [x] Integracion automatica en NotifyService.Notify

### Fase 4: Frontend de preferencias - COMPLETA
- [x] Pagina NotificationSettings.tsx
- [x] Tab "Mis preferencias": matriz evento x canal
- [x] Tab "Mis contactos": email, phone, telegram, matrix, xmpp
- [x] Tab "Pasarelas (admin)": config de cada pasarela (incluido XMPP)
- [x] Endpoint PUT /api/accounts/me/contacts
- [x] Campos de contacto en User struct y GetUser
- [x] Boton de test de pasarela
- [x] Item en menu lateral
- [x] Pagina de historial completo Notifications.tsx
- [x] Filtros: todas / no leidas / leidas
- [x] Eliminar notificacion individual
- [x] Iconos por tipo de notificacion (lib/notifications.tsx)
- [x] Fecha relativa en espanol ("hace 2 horas")
- [x] Link "Ver historial completo" en panel desplegable

### Fase 5: Scope y autorizacion - COMPLETA
- [x] listNotifications filtra por user_id
- [x] unreadCount filtra por user_id
- [x] markRead filtra por user_id (no se pueden marcar notificaciones ajenas)
- [x] markAllRead filtra por user_id
- [x] deleteNotification filtra por user_id
- [x] NotifyBoard solo notifica a miembros de assembly_board_members
- [x] NotifyVotingMembers solo notifica a usuarios con has_vote = true
- [x] Notify dirige a usuario especifico
- [x] Gateways solo configurables por admin (config.manage)
- [x] Preferencias solo editables por el propio usuario

### Canales soportados (prioridad: redes federadas/libres)
1. in_app (siempre activo)
2. matrix (federada, soberana) - RECOMENDADA
3. xmpp (Jabber federado) - via HTTP API / bridge
4. telegram (bot API)
5. email (SMTP)
6. webhook (generico)
7. whatsapp (opcional, propietario)

### Pendiente para futuras iteraciones
- [ ] WebPush: implementar via Service Worker (schema listo, envio pendiente)
- [ ] SMS: integrar con proveedor (Twilio, etc.)
- [ ] Notificaciones de proposal closing deadline approaching (cron job)
- [ ] Rate limiting / quiet hours
- [ ] Notificaciones push a app movil nativa
