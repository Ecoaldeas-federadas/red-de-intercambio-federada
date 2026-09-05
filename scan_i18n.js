const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, 'web/src')
const localesEs = path.join(srcDir, 'locales/es')
const localesEn = path.join(srcDir, 'locales/en')

// 1. Find all t('key', 'default') patterns in all TSX files
const pagesDir = path.join(srcDir, 'pages')
const compDir = path.join(srcDir, 'components')

function extractTKeys(dir) {
  const results = {}
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'))
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8')
    const re = /\bt\(\s*['"]([^'"]+)['"]\s*,\s*['"`]([^'"`]+)['"`]\)/g
    let m
    while ((m = re.exec(content)) !== null) {
      const fullKey = m[1]
      const defaultVal = m[2]
      if (!results[fullKey]) results[fullKey] = { file: f, default: defaultVal }
    }
  }
  return results
}

const pageKeys = extractTKeys(pagesDir)
const compKeys = extractTKeys(compDir)
const allKeys = { ...pageKeys, ...compKeys }

// 2. Check which keys are missing from es/*.json
const namespaces = fs.readdirSync(localesEs).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))

let missingFromEs = 0
let missingFromEn = 0
const missingDetails = []

for (const [key, info] of Object.entries(allKeys)) {
  let ns, actualKey
  if (key.includes(':')) {
    const parts = key.split(':')
    ns = parts[0]
    actualKey = parts.slice(1).join(':')
  } else {
    continue
  }

  const esFile = path.join(localesEs, ns + '.json')
  const enFile = path.join(localesEn, ns + '.json')

  if (!fs.existsSync(esFile)) continue
  if (!fs.existsSync(enFile)) continue

  const esData = JSON.parse(fs.readFileSync(esFile, 'utf8'))
  const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'))

  function getKey(obj, key) {
    const parts = key.split('.')
    let cur = obj
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) {
        cur = cur[p]
      } else {
        return undefined
      }
    }
    return cur
  }

  const esVal = getKey(esData, actualKey)
  const enVal = getKey(enData, actualKey)

  if (esVal === undefined) {
    missingFromEs++
    missingDetails.push({ ns, key: actualKey, file: info.file, default: info.default, missing: 'es' })
  }
  if (enVal === undefined) {
    missingFromEn++
    missingDetails.push({ ns, key: actualKey, file: info.file, default: info.default, missing: 'en' })
  }
}

console.log('=== KEYS USED IN t() CALLS ===')
console.log('Total unique keys found:', Object.keys(allKeys).length)
console.log('Missing from es/*.json:', missingFromEs)
console.log('Missing from en/*.json:', missingFromEn)

const byNs = {}
for (const d of missingDetails) {
  if (!byNs[d.ns]) byNs[d.ns] = []
  byNs[d.ns].push(d)
}
for (const [ns, items] of Object.entries(byNs)) {
  console.log(`\n--- ${ns} (${items.length} missing) ---`)
  for (const item of items.slice(0, 30)) {
    console.log(`  [${item.missing}] ${item.key} = "${item.default.slice(0, 70)}" (from ${item.file})`)
  }
  if (items.length > 30) console.log(`  ... and ${items.length - 30} more`)
}

// 3. Count Spanish-looking values in en/*.json
console.log('\n=== SPANISH TEXT IN en/*.json ===')
let totalSpanish = 0
for (const ns of namespaces) {
  const enFile = path.join(localesEn, ns + '.json')
  if (!fs.existsSync(enFile)) continue
  const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'))
  function countSpanish(obj) {
    let count = 0
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        if (/[áéíóúñ¿¡]/.test(v) || /\b(que|de|en|con|por|para|los|las|una|uno|este|esta|como|cuando|donde|sin|sobre|entre)\b/i.test(v)) {
          count++
        }
      } else if (typeof v === 'object' && v !== null) {
        count += countSpanish(v)
      }
    }
    return count
  }
  const spanishCount = countSpanish(enData)
  if (spanishCount > 0) {
    console.log(`  ${ns}.json: ${spanishCount} Spanish-looking values`)
    totalSpanish += spanishCount
  }
}
console.log(`TOTAL Spanish in en/*.json: ${totalSpanish}`)

// 4. Find hardcoded strings in JSX (not wrapped in t())
console.log('\n=== HARDCODED STRINGS (not in t()) ===')
function findHardcoded(dir) {
  const results = []
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'))
  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n')
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (/>\s*[A-ZÁÉÍÓÚÑa-záéíóúñ]/.test(trimmed) && !trimmed.includes('t(') && !trimmed.includes('//') && !trimmed.includes('className') && !trimmed.includes('import') && !trimmed.includes('const ') && !trimmed.includes('interface') && !trimmed.includes('type ') && !trimmed.includes('=') && !trimmed.includes('{') && !trimmed.includes('}')) {
        results.push(`${f}:${i + 1}: ${trimmed.slice(0, 100)}`)
      }
      if (/placeholder=['"][A-ZÁÉÍÓÚÑa-záéíóúñ]/.test(trimmed) && !trimmed.includes('t(')) {
        results.push(`${f}:${i + 1}: ${trimmed.slice(0, 100)}`)
      }
      if (/confirm\(['"][A-ZÁÉÍÓÚÑa-záéíóúñ]/.test(trimmed) && !trimmed.includes('t(')) {
        results.push(`${f}:${i + 1}: ${trimmed.slice(0, 100)}`)
      }
    })
  }
  return results
}

const hardcodedPages = findHardcoded(pagesDir)
const hardcodedComps = findHardcoded(compDir)
console.log('Pages:', hardcodedPages.length)
hardcodedPages.forEach(r => console.log(`  ${r}`))
console.log('Components:', hardcodedComps.length)
hardcodedComps.forEach(r => console.log(`  ${r}`))
