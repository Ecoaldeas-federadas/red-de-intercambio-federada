const fs = require('fs')
const path = require('path')

const tsx = fs.readFileSync(path.join(__dirname, 'pages/Assembly.tsx'), 'utf8')
const lines = tsx.split('\n')

// Spanish words that indicate Spanish text (common words, no false positives in English)
const spanishWords = [
  'Error al', 'Cerrar', 'Debes', 'Presencia', 'Usuario y', 'El titulo',
  'Permiso', 'Cuenta:', 'Seleccionar', 'pendiente', 'Asignar', 'Buscar',
  'Crear', 'Guardar', 'Eliminar', 'Cancelar', 'Aceptar', 'Nuevo', 'Nueva',
  'Asamblea', 'Junta', 'Sesion', 'Propuesta', 'Informe', 'Configuracion',
  'Nivel', 'Organizacion', 'Departamento', 'Miembro', 'Votacion', 'Cargo',
  'Descripcion', 'Activo', 'Inactivo', 'multisig', 'permisos', 'Super',
  'Este usuario', 'Las ', 'Los ', 'No hay', 'Solo ', 'Como ', 'Cuando ',
  'Cada ', 'Para ', 'Donde ', 'Quedan', 'para votar', 'minutos',
  'horas', 'dias', 'dia', 'hora', 'antes', 'despues', 'Pendientes',
  'Aprobadas', 'Rechazadas', 'Vencidas', 'Total', 'Participacion',
  'Aprobacion', 'Tipo', 'Estado', 'Fecha', 'Titulo', 'Votos', 'A favor',
  'En contra', 'Abstencion', 'No emitidos', 'Remoto', 'Presencial',
  'Ordinaria', 'Extraordinaria', 'Urgente', 'Programada', 'Presente',
  'Quorum', 'Firmas', 'Persona', 'Comision', 'Metodo', 'Porcentaje',
  'Agregar', 'Autorizados', 'Autorizada', 'Fondo', 'Impuestos', 'Tasas',
  'Balance', 'Monto', 'minimo', 'Exento', 'Activo', 'Inactivo',
  'Con Voz', 'Con Voto', 'Solo Voz', 'Voz + Voto', 'Voz', 'Voto',
  'Proximas', 'pasadas', 'Reprogramar', 'Cerrar', 'Ver', 'Escribir',
  'Descargar', 'Abrir', 'Modo', 'Duracion', 'Parametros', 'Metadata',
  'Respuestas', 'Sin ', 'Cualquier', 'Cualquiera', 'Importante',
  'Consejo', 'Reglas', 'Convocatoria', 'Frecuencia', 'Dia', 'Hora',
  'Notificar', 'Registrar', 'asistencia', 'Permitir', 'reprogramar',
  'Max', 'Gracia', 'llamado', 'Llamado', 'Junta ', 'Directiva',
  'Asamblea ', 'Ordinaria', 'Extraordinaria', 'Urgente', 'Presencial',
  'Remota', 'Remoto', 'Acta', 'Minuta', 'minuta', 'acta',
  'Cuenta', 'Cuenta de', 'donde llegan', 'Impuestos -',
  'Como funciona', 'Cada nivel', 'Los cambios', 'Para distribuir',
  'Para gastar', 'indicando', 'La Asamblea', 'La asamblea',
  'La organizacion', 'Las organizaciones', 'Los miembros',
  'Los permisos', 'El quorum', 'El voto', 'El propietario',
  'El secretario', 'El administrador', 'La fecha', 'La hora',
  'El titulo', 'El usuario', 'La descripcion', 'La cuenta',
  'El monto', 'El nivel', 'La tasa', 'El balance',
  'Sin respuestas', 'Sin metadata', 'Sin roles', 'Sin miembros',
  'Sin votacion', 'Sin firma', 'Sin configuracion',
  'Solo puedes', 'Solo los', 'Solo pueden', 'Solo la',
  'Solo el', 'Solo una', 'Solo se', 'Solo si',
  'Todas las', 'Todos los', 'Toda la', 'Todo el',
  'Cualquier dia', 'Cualquier persona',
  'Presencia confirmada', 'Gracias por',
  'Usuario y cargo', 'El titulo no', 'El titulo es',
  'Debes seleccionar', 'Debes seleccionar la fecha',
  'Debes seleccionar la hora',
  'Cerrar esta', 'Se convocara',
  'Sin organizacion', 'deptos',
  'Asamblea General', 'Asamblea (todos',
  'Asamblea (votacion', 'Junta Directiva',
  'Junta (solo', 'Junta Directiva (solo',
  'Asamblea Ordinaria', 'Asamblea Extraordinaria', 'Asamblea Urgente',
  'Junta Ordinaria', 'Junta Extraordinaria', 'Junta Urgente',
  'Junta ', 'Asamblea ',
]

// Skip lines that are comments or imports
lines.forEach((line, i) => {
  const trimmed = line.trim()
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return
  if (trimmed.startsWith('import ')) return
  
  for (const word of spanishWords) {
    if (line.includes(word)) {
      // Check if it's inside a t() fallback
      const tMatch = line.match(/t\(['"][^'"]+['"]\s*,\s*['"`]([^'"`]+)['"`]/)
      if (tMatch && tMatch[1].includes(word)) {
        // It's a fallback in a t() call - check if key exists
        // We'll just report it
        console.log(`L${i+1} [FALLBACK]: ${trimmed.substring(0, 150)}`)
        break
      } else if (!line.includes("t('") && !line.includes('t("')) {
        // Not in a t() call at all - hardcoded
        console.log(`L${i+1} [HARDCODED]: ${trimmed.substring(0, 150)}`)
        break
      } else if (line.includes(`'${word}`) || line.includes(`"${word}`) || line.includes(`\`${word}`)) {
        // Might be in a string but not in t()
        // Check if it's in a t() call or not
        const beforeWord = line.substring(0, line.indexOf(word))
        const lastT = beforeWord.lastIndexOf('t(')
        const lastComma = beforeWord.lastIndexOf(',')
        if (lastT > lastComma) {
          // It's inside a t() call as the first argument (key) - skip
        } else if (lastComma > lastT && lastT !== -1) {
          // It's a fallback in a t() call
          console.log(`L${i+1} [FALLBACK]: ${trimmed.substring(0, 150)}`)
          break
        } else {
          // Not in t() call
          console.log(`L${i+1} [HARDCODED]: ${trimmed.substring(0, 150)}`)
          break
        }
      }
    }
  }
})
