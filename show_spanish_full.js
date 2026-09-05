const fs = require('fs');
const path = require('path');

const enDir = path.join(__dirname, 'web', 'src', 'locales', 'en');
const files = fs.readdirSync(enDir).filter(f => f.endsWith('.json'));

function looksSpanish(text) {
  if (!text || typeof text !== 'string') return false;
  if (/[áéíóúñü¿¡]/.test(text)) return true;
  const spanishOnly = /\b(que|con|por|para|una|uno|del|las|los|como|más|menos|todo|toda|todos|todas|este|esta|estos|estas|ese|esa|esos|esas|cuando|donde|cómo|qué|quién|quiénes|cuál|cuáles|también|pero|sí|ni|tan|tanto|tanta|tantos|tantas|muy|poco|muchos|muchas|cada|otro|otra|otros|otras|esto|eso|aquí|allí|allá|así|ya|aún|todavía|siempre|nunca|jamás|ahora|antes|después|entonces|luego|mientras|durante|sin|sobre|entre|hasta|desde|hacia|contra|según|tras|aunque|porque|pues|puesto|sino|tampoco|apenas|cual|quien|cuyo|cuya|cuyos|cuyas|cualquier|cualquiera|alguno|alguna|algunos|algunas|ninguno|ninguna|varios|varias|ambos|ambas|dicho|dicha|dichos|dichas|propio|propia|propios|propias|nuestro|nuestra|nuestros|nuestras|vuestro|vuestra|vuestros|vuestras|debe|deben|debes|puede|pueden|puedes|tiene|tienen|fue|fueron|sea|sean|está|están|estaba|estaban|hace|hacen|hacer|quiere|quieren|sabe|saben|saber|vez|veces|lugar|forma|manera|parte|día|días|año|años|hoy|ayer|mañana|tarde|noche|semana|mes|meses|hora|horas|minuto|minutos|segundo|segundos|tiempo|vida|mundo|país|países|ciudad|pueblo|gente|persona|personas|hombre|mujer|niño|niña|familia|casa|hogar|trabajo|dinero|cuenta|cuentas|saldo|crédito|débito|deuda|impuesto|impuestos|fondo|fondos|presupuesto|gasto|gastos|ingreso|ingresos|costo|precio|precios|producto|productos|servicio|servicios|usuario|usuarios|miembro|miembros|organización|organizaciones|comunidad|comunidades|asamblea|sesión|sesiones|propuesta|propuestas|votación|voto|votos|decisión|decisiones|regla|reglas|permiso|permisos|rol|roles|nivel|niveles|sistema|sistemas|nodo|nodos|servidor|servidores|base|datos|archivo|archivos|configuración|opciones|preferencias|ajustes|perfil|perfiles|nombre|descripción|estado|categoría|etiqueta|etiquetas|versión|historial|registro|registros|informe|informes|estadísticas|gráfico|gráficos|tabla|tablas|lista|listas|menú|botón|botones|campo|campos|formulario|formularios|página|páginas|sección|secciones|enlace|enlaces|imagen|imágenes|video|videos|audio|texto|título|subtítulo|contenido|mensaje|mensajes|notificación|notificaciones|alerta|alertas|error|errores|advertencia|advertencias|información|ayuda|pregunta|preguntas|respuesta|respuestas|comentario|comentarios|opinión|opiniones|idea|ideas|sugerencia|sugerencias|reclamación|reclamaciones|reporte|reportes|novedad|novedades|actualización|actualizaciones|cambio|cambios|modificación|modificaciones|creación|eliminación|borrado|restablecimiento|restauración|copia|respaldo|respaldos|descarga|descargas|subida|subidas|instalación|desinstalación|activación|desactivación|conexión|desconexión|inicio|cierre|acceso|salida|entrada|autorización|autenticación|verificación|confirmación|aprobación|rechazo|aceptación|cancelación|suspensión|reactivación|renovación|expiración|vencimiento|publicación|edición|revisión|traducción|idioma|idiomas|lengua|lenguas|palabra|palabras|frase|frases|oración|oraciones|documento|documentos|carpeta|carpetas|directorio|directorios|ruta|rutas|dominio|subdominio|host|puerto|protocolo|certificado|certificados|clave|claves|contraseña|admin|administrador|administradores|superusuario|root|invitado|visitante|colaborador|colaboradores|editor|editores|autor|autores|lector|lectores|moderador|moderadores|supervisor|supervisores|auditor|auditores|tesorero|secretario|coordinador|representante|delegado|vocero|líder|líderes|jefe|director|gerente|encargado|responsable)\b/i;
  return spanishOnly.test(text);
}

const allKeys = {};
for (const file of files) {
  const ns = file.replace('.json', '');
  const enContent = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'));
  function flatten(obj, prefix) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null) {
        flatten(v, key);
      } else if (typeof v === 'string' && looksSpanish(v)) {
        if (!allKeys[ns]) allKeys[ns] = [];
        allKeys[ns].push({ key, value: v });
      }
    }
  }
  flatten(enContent, '');
}

for (const [ns, entries] of Object.entries(allKeys)) {
  console.log(`\n=== ${ns}.json (${entries.length}) ===`);
  for (const e of entries) {
    console.log(`  ${e.key} = "${e.value.substring(0, 150)}${e.value.length > 150 ? '...' : ''}"`);
  }
}
console.log(`\nTotal: ${Object.values(allKeys).reduce((a, b) => a + b.length, 0)}`);
