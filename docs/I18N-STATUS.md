# Estado de internacionalización de contenido dinámico

Actualizado durante la implementación de la capa unificada de fuentes.

| Área | Fuente y editor central | Lectura localizada en handlers | Estado |
| --- | --- | --- | --- |
| Páginas públicas, ajustes y admisión | Sí | Sí | Integrado |
| Productos y taxonomía | Sí | Productos, catálogo y filtros principales | Integrado |
| Calculadora | Sí | Categorías y parámetros | Integrado |
| Niveles, reglas y configuración de asamblea | Sí | Sí | Integrado |
| Sesiones y decisiones de asamblea (nodo y seccionales) | Sí | Listados y detalles completos | Integrado |
| Propuestas públicas y moderación | Sí | Listados públicos y administrativos | Integrado |
| Constantes y perfiles federados | Sí | Sí | Integrado |
| Departamentos, roles y servicios | Sí | Listados, detalles y creación | Integrado |
| Tienda, horarios comerciales, filtros dietéticos y NFC | Sí | Sí | Integrado |
| Trabajo comunitario (Cayapa / Minga) | Sí | Sesiones y tareas | Integrado |
| HTML estático por idioma y SEO/hreflang | Sí, páginas públicas | Sí con tags hreflang | Integrado |

## Garantías implementadas

- Las traducciones se almacenan separadas del texto original y se invalidan con
  `source_hash` cuando cambia el original.
- Una traducción vacía o desactualizada hace fallback seguro al idioma original.
- El idioma de origen se resuelve por `node_config.default_language` del nodo
  dueño de la fuente; no se fuerza español ni el idioma del traductor.
- Las rutas centrales comprueban idioma habilitado, pertenencia al nodo y
  `translations.edit`. No aceptan tablas ni campos arbitrarios suministrados por HTTP.
- Durante la creación de entidades, el creador puede enviar opcionalmente
  traducciones para otros idiomas habilitados sin reemplazar el idioma base.
- Soporte en frontend con pestaña y selector reutilizable (`LanguageTabs`) que destaca
  el idioma principal y estado de traducción.
