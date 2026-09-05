const fs = require('fs')
const path = require('path')

const localesEn = path.join(__dirname, 'web/src/locales/en')
const files = fs.readdirSync(localesEn).filter(f => f.endsWith('.json'))

let total = 0
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(localesEn, file), 'utf8'))
  function countSpanish(obj) {
    let count = 0
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        if (/[áéíóúñ¿¡]/.test(v) || /\b(que|para|los|las|una|uno|como|cuando|donde|sin|sobre|entre|del|al|sus|fue|son|sea|ser|tiene|puede|debe|cada|todo|toda|todos|todas|otro|otra|mismo|misma|nuestro|nuestra|vuestro|vuestra)\b/i.test(v)) {
          count++
        }
      } else if (typeof v === 'object' && v !== null) {
        count += countSpanish(v)
      }
    }
    return count
  }
  const count = countSpanish(data)
  if (count > 0) {
    console.log(`${file}: ${count} still Spanish`)
    total += count
  }
}
console.log(`Total still Spanish: ${total}`)
