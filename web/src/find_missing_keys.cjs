const fs = require('fs')
const path = require('path')

// Read the en/assembly.json
const enAssembly = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales/en/assembly.json'), 'utf8'))
const enKeys = new Set(Object.keys(enAssembly))

// Read Assembly.tsx
const tsx = fs.readFileSync(path.join(__dirname, 'pages/Assembly.tsx'), 'utf8')

// Find all t('key', 'fallback') or t("key", "fallback") patterns
// Also t('key') without fallback
const regex = /t\(['"]([^'"]+)['"](?:\s*,\s*['"`]([^'"`]+)['"`])?/g
let match
const missing = []
const withSpanishFallback = []
while ((match = regex.exec(tsx)) !== null) {
  const key = match[1]
  const fallback = match[2]
  
  // Skip keys with namespace prefix like 'common:close'
  if (key.includes(':')) continue
  
  if (!enKeys.has(key)) {
    missing.push({ key, fallback, line: tsx.substring(0, match.index).split('\n').length })
  }
  
  if (fallback && /[áéíóúñÁÉÍÓÚÑ]/.test(fallback)) {
    withSpanishFallback.push({ key, fallback, line: tsx.substring(0, match.index).split('\n').length })
  }
}

console.log('=== MISSING KEYS (not in en/assembly.json) ===')
missing.forEach(m => console.log(`Line ${m.line}: t('${m.key}') - fallback: "${m.fallback}"`))
console.log(`\nTotal missing: ${missing.length}`)

console.log('\n=== KEYS WITH SPANISH FALLBACKS (containing accents) ===')
withSpanishFallback.forEach(m => console.log(`Line ${m.line}: t('${m.key}', '${m.fallback}')`))
console.log(`\nTotal with Spanish fallbacks: ${withSpanishFallback.length}`)
