const fs = require('fs')
const path = require('path')

const tsx = fs.readFileSync(path.join(__dirname, 'pages/Assembly.tsx'), 'utf8')
const lines = tsx.split('\n')

// Common Spanish words that indicate hardcoded Spanish (not in t() calls)
const spanishPatterns = [
  /\bError al\b/, /\bCerrar\b/, /\bDebes\b/, /\bPresencia\b/, /\bUsuario y\b/,
  /\bEl titulo\b/, /\bPermiso\b/, /\bCuenta:\b/, /\bvotacion\b/, /\basamblea\b/i,
  /\bSeleccionar\b/, /\bpendiente\b/i
]

// Skip lines that are comments (// or /*) or import statements
lines.forEach((line, i) => {
  const trimmed = line.trim()
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return
  if (trimmed.startsWith('import ')) return
  
  // Check if line has t() call - if the Spanish text is inside t(), it's a fallback (less critical)
  const hasTCall = /t\(['"]/.test(line)
  
  for (const pattern of spanishPatterns) {
    if (pattern.test(line)) {
      // Check if the match is inside a t() fallback or outside
      if (hasTCall && pattern.source.includes('Error al')) {
        // These might be inline error messages, not t() fallbacks
        if (!/t\(['"]assembly/.test(line)) {
          console.log(`Line ${i+1}: ${trimmed.substring(0, 120)}`)
        }
      } else if (!hasTCall) {
        console.log(`Line ${i+1}: ${trimmed.substring(0, 120)}`)
      }
    }
  }
})
