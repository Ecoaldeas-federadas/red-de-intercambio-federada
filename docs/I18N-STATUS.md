# Sistema i18n — Documento maestro de estado y tareas

## Resumen ejecutivo

Sistema de internacionalización del proyecto "red de intercambio federada". Infraestructura completa (Fases 1-8). Auditoría del 4 Sep 2026: **todas las páginas y componentes incluyen el namespace `common`**. NodeSettings.tsx completamente internacionalizado (589 claves `settings_*` extraídas y agregadas a es/en). FederatedServices.tsx (VoIP) corregido. Namespace `settings` expandido de 199 a 788 claves. Aún quedan ~109 strings "No hay" y textos descriptivos en otras páginas que requieren traducción individual.

---

## 1. Infraestructura completada ✅

### Frontend
- `web/src/i18n/index.ts` — Configuración i18next
- `web/src/i18n/TranslationProvider.tsx` — Provider de React
- `web/src/i18n/useT.ts` — Hook personalizado
- `web/src/components/LanguageSwitcher.tsx` — Selector de idioma reutilizable (light/dark, compact, accesible)
- `web/src/hooks/usePreferences.tsx` — Aplica idioma preferido del usuario al iniciar sesión

### Backend
- `internal/api/translations.go` — Endpoints CRUD de traducciones
- `internal/api/content_translations.go` — Endpoints para contenido multilingüe
- `internal/api/errors.go` — Códigos de error estables
- `internal/federation/translations_federation.go` — Federación de traducciones (gossip)

### Base de datos
- Migración 163: `languages` table
- Migración 164: `translations` table
- Migración 165: Permisos `translations.edit`, `translations.manage`
- Migración 166: `node_config.default_language`
- Migración 167: `user_preferences.language`
- Migración 168: `federated_translations` table
- Migración 169: `public_page_translations`, `public_settings_translations`, `admission_form_translations`

### Documentación
- `docs/I18N.md` — Guía completa del sistema i18n

### Funcionalidades
- Selector de idioma en header de app interna (Layout)
- Selector de idioma en footer del sitio público (PublicSite)
- Idioma preferido en perfil de usuario
- Precedencia: localStorage > user_preferences > node_default > navegador > es
- LivePageEditor con selector de idioma
- WebsiteAdmin con formulario de admisión multilingüe
- ThemeCustomizer con títulos de menú por idioma
- PublicSite carga contenido según `?lang=`
- Panel de auditoría con % de completitud
- Botón "Copiar de..." para auto-traducción asistida
- Federación de traducciones (gossip, descarga manual, sin auto-instalación)

---

## 2. Namespaces (19) — Todos con claves es/en idénticas ✅

| Namespace | Claves | Estado |
|-----------|--------|--------|
| assembly | 96+ | ✅ (expandido con proposal_type.*, proposal_help.*) |
| audit | 0 | ✅ (vacío, sin uso aún) |
| common | 407 | ✅ |
| dashboard | 20 | ✅ |
| errors | 37 | ✅ |
| external | 239 | ✅ |
| federation | 358 | ✅ |
| nfc | 274 | ✅ |
| notifications | 86 | ✅ |
| organizations | 152 | ✅ |
| products | 217 | ✅ |
| profile | 24 | ✅ |
| public | 29 | ✅ |
| satellite | 42 | ✅ |
| services | 162 | ✅ |
| settings | 788 | ✅ (expandido: tabs + NodeSettings completo + NodeUpdateSection + VoIP) |
| transfer | 128+ | ✅ (expandido con wallet.*) |
| translations | 34 | ✅ |
| website | 172 | ✅ |
| **TOTAL** | **3,229** | |

---

## 3. Estado real de traducción de páginas (Sep 4, 2026)

### Auditoría de strings hardcoded restantes

| Palabra clave | Matches | Archivos afectados |
|---------------|---------|-------------------|
| "No hay" | 109 | 38 páginas + 3 componentes |
| "Guardar" | 64 | 16 páginas + 5 componentes |
| "Eliminar" | 52 | 15 páginas |
| "Cancelar" | 49 | 19 páginas |
| "Cerrar" | 45 | 26 páginas |
| "Cargando" | 37 | 20 páginas |
| **Subtotal** | **~356** | **Prácticamente todos** |

### Páginas con más strings pendientes

| Página | Strings aprox | Estado |
|--------|---------------|--------|
| Assembly.tsx | ~50+ | Parcial (PROPOSAL_LABELS traducido, queda config/help/status) |
| NodeSettings.tsx | 0 | ✅ Completado (589 claves settings_* agregadas a es/en) |
| ExternalBridge.tsx | ~20+ | Parcial |
| NFCTerminals.tsx | ~15+ | Parcial |
| Products.tsx | ~15+ | Parcial |
| Profile.tsx | ~15+ | Parcial |
| FederatedServices.tsx | ~5+ | Casi completo (VoIP corregido, quedan placeholders técnicos) |
| WebsiteAdmin.tsx | ~15+ | Parcial |
| NodeDiscovery.tsx | ~12+ | Parcial |
| NotificationSettings.tsx | ~10+ | Parcial |
| Resto de páginas | ~100+ | Parcial |

### Página NO traducida ❌
| Página | Líneas | Namespace sugerido | Descripción |
|--------|--------|-------------------|-------------|
| `OrganizationDetail.tsx` | 1049 | `organizations` | Detalle de organización con tabs: info, board, members, departments, services, wallet, assembly, boardmeetings, terminals |

---

## 4. Componentes traducidos (3/14) — 21%

### Traducidos ✅
- `LanguageSwitcher.tsx` (7 strings)
- `Layout.tsx` (42 strings)
- `PublicSite.tsx` (304 strings, parcial)

### NO traducidos ❌

| # | Componente | Líneas | Strings aprox | Prioridad | Namespace | Descripción |
|---|------------|--------|---------------|-----------|-----------|-------------|
| 1 | `public-site/PublicBlocks.tsx` | 1906 | 389 | **Alta** | `public` | Bloques del sitio público (visible a visitantes) |
| 2 | `public-site/PublicFederationPage.tsx` | 1286 | 312 | **Alta** | `public` | Página de federación pública |
| 3 | `public-site/PublicGovernancePage.tsx` | 571 | 143 | **Alta** | `public` | Página de gobernanza pública |
| 4 | `public-site/ThemeCustomizer.tsx` | ~800 | 207 | Media | `website` | Personalización del tema |
| 5 | `ScopedAssembly.tsx` | 764 | 172 | Media | `assembly` | Asamblea scoped (org/dept) |
| 6 | `public-site/LivePageEditor.tsx` | ~500 | 100 | Media | `website` | Editor de páginas en vivo |
| 7 | `public-site/DynamicAdmissionForm.tsx` | ~300 | 57 | Media | `website` | Formulario de admisión dinámico |
| 8 | `LoginModal.tsx` | 385 | 54 | Media | `common` | Modal de login |
| 9 | `public-site/InlineEditable.tsx` | ~200 | 36 | Baja | `common` | Componentes inline editables |
| 10 | `SessionExpiredModal.tsx` | 107 | 19 | Baja | `common` | Modal de sesión expirada |
| 11 | `EntitySelector.tsx` | 126 | 15 | Baja | `common` | Selector de entidad |

---

## 5. Build y verificación

- **Build**: `npm run build` ✅ — Compila sin errores, 1699 módulos
- **Claves es/en**: ✅ — Todos los 19 namespaces tienen exactamente las mismas claves
- **Warning**: `TranslationProvider.tsx` es importado dinámica y estáticamente (no afecta funcionalidad)
- **Docker**: No corriendo — no se pudieron verificar migraciones BD (pendiente)

---

## 6. Historial de commits i18n (Sep 3, 2026)

| Hora | Commit | Descripción |
|------|--------|-------------|
| 07:46 | `06a0423` | Fase 1: Infraestructura i18n |
| 07:54 | `b8c2630` | Fase 2: Páginas core + TranslationEditor |
| 07:56 | `b18c5eb` | Fase 3: Transfer, Wallet, Profile, Notifications, Federation, NodeSettings |
| 08:08 | `1e16df8` | Fase 4: TranslationEditor completo |
| 08:12 | `314e189` | Fase 5: Sitio público i18n |
| 08:16 | `cad9dc0` | Fase 6: Backend errores → códigos |
| 08:20 | `5f9f926` | Fase 7: Federación de traducciones |
| 08:24 | `ec5e9bf` | Fase 8: Documentación |
| 10:36 | `5256e6d` | Selectores de idioma + contenido multilingüe |
| 10:39 | `862aafa` | Panel de auditoría + auto-traducción |
| 11:49 | `74a97bd` | 14 páginas internas + 10 namespaces |
| 12:23 | `60860e5` | Grupo 1: Products, Store, Organizations |
| 13:04 | `419077c` | Grupo 2: Federation + NFC |
| 13:32 | `d301ca7` | Grupo 3: Services, NetworkConfig, Notifications |
| 14:20 | `798edd2` | Grupo 4: Assembly, ExternalBridge, License, Recovery, Software, Website |
| 18:19 | `b887d5a` | Fix: crashes, auditoría, selector, accesibilidad |

---

## 7. Plan de trabajo (Sep 4, 2026)

### Completado ✅
1. **I18N-STATUS.md actualizado** con estado real
2. **Namespaces comunes**: Todas las páginas y componentes ahora incluyen `common` como segundo namespace
3. **Botones comunes reemplazados**: Guardar, Cancelar, Cerrar, Eliminar, Editar, Cargando, Guardando → `t('common.*')`
4. **Assembly.tsx**: PROPOSAL_LABELS, PROPOSAL_HELP, botones, mensajes vacíos traducidos
5. **NodeSettings.tsx**: COMPLETAMENTE internacionalizado — 589 claves `settings_*` extraídas del código y agregadas a `es/settings.json` y `en/settings.json`. Todas las secciones: General, Niveles, Organización, Tarifa, Horarios, Perfil del Nodo, Trabajo Comunitario, Banco Semillas, Cayapa, NFC, FRNE, Biodinamica, Páginas Públicas, Backup, Base de Datos, Nodo Demo, NodeUpdateSection
6. **FederatedServices.tsx**: Strings VoIP corregidos (mensajes de error, confirmaciones, guardado)
7. **Locale files**: `settings.json` (es/en) expandido de 199 a 788 claves idénticas
8. **Build exitoso** y push a origin/main

### Pendiente (futuro)
- ~109 strings "No hay X" requieren traducción individual por página (cada uno tiene contexto diferente)
- Textos descriptivos largos (help, explicaciones) en Assembly, FederatedServices, etc.
- `OrganizationDetail.tsx` (única página sin `useTranslation`)
- Componentes públicos: PublicBlocks, PublicFederationPage, PublicGovernancePage, ThemeCustomizer, LivePageEditor
- Strings en comentarios (no visibles para usuarios, baja prioridad)
- Traducciones en `en/settings.json`: las 589 claves nuevas tienen texto en español como placeholder — requieren traducción manual al inglés

---

## 8. Cómo usar este documento

Si se pierde el historial de trabajo, este documento contiene:
1. **Estado exacto** de qué está traducido y qué no
2. **Orden de trabajo** recomendado
3. **Namespaces** sugeridos para cada componente
4. **Historial de commits** para reconstruir contexto
5. **Información de infraestructura** completa

Última actualización: Sep 4, 2026 22:25
