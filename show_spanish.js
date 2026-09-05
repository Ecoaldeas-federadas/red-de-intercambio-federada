const fs = require('fs')
const path = require('path')

const localesEn = path.join(__dirname, 'web/src/locales/en')
const files = fs.readdirSync(localesEn).filter(f => f.endsWith('.json'))

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(localesEn, file), 'utf8'))
  function findSpanish(obj, prefix) {
    const results = []
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        if (/[áéíóúñ¿¡]/.test(v) || /\b(que|para|los|las|una|uno|como|cuando|donde|sin|sobre|entre|del|al|sus|fue|son|sea|ser|tiene|puede|debe|cada|todo|toda|todos|todas|otro|otra|mismo|misma|nuestro|nuestra|vuestro|vuestra)\b/i.test(v)) {
          results.push(`${prefix}${k} = "${v.slice(0, 120)}"`)
        }
      } else if (typeof v === 'object' && v !== null) {
        results.push(...findSpanish(v, prefix + k + '.'))
      }
    }
    return results
  }
  const items = findSpanish(data, '')
  if (items.length > 0) {
    console.log(`\n--- ${file} (${items.length}) ---`)
    items.forEach(i => console.log(`  ${i}`))
  }
}
