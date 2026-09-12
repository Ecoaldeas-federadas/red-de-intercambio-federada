const fs = require('fs')
const tsx = fs.readFileSync(__dirname + '/pages/Assembly.tsx', 'utf8')
const lines = tsx.split('\n')

// Only find truly hardcoded Spanish (not in t() calls, not comments)
const hardcodedPatterns = [
  /'Error al [^']+'/,
  /'Debes [^']+'/,
  /'El titulo [^']+'/,
  /'Usuario y [^']+'/,
  /'Presencia confirmada[^']*'/,
  /`Permiso "[^"]+" removido`/,
  /`Permiso "[^"]+" asignado`/,
  /'Cerrar esta asamblea\?[^']*'/,
  /'Sin organizacion'/,
  /'Asamblea General'/,
  /'deptos'/,
  /setError\('Error'\)/,
  /alert\('Presencia confirmada[^']*'\)/,
]

lines.forEach((line, i) => {
  const trimmed = line.trim()
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return
  if (trimmed.startsWith('import ')) return
  
  for (const pattern of hardcodedPatterns) {
    if (pattern.test(line)) {
      console.log(`L${i+1}: ${trimmed.substring(0, 200)}`)
      break
    }
  }
})
