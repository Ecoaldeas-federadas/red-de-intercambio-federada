const fs = require('fs');
const path = require('path');

const enDir = path.join(__dirname, 'web', 'src', 'locales', 'en');

// Spanish indicator characters and words
const spanishIndicators = [
  'ñ', 'á', 'é', 'í', 'ó', 'ú', '¿', '¡',
];
const spanishWords = [
  ' que ', ' de ', ' la ', ' el ', ' los ', ' las ', ' un ', ' una ',
  ' y ', ' o ', ' en ', ' con ', ' por ', ' para ', ' se ', ' es ',
  ' del ', ' al ', ' lo ', ' le ', ' su ', ' sus ', ' más ', ' menos ',
  ' como ', ' pero ', ' cuando ', ' donde ', ' sino ', ' porque ',
  ' cada ', ' todo ', ' todos ', ' toda ', ' todas ', ' esto ', ' eso ',
  ' aquí ', ' allí ', ' así ', ' ya ', ' ha ', ' han ', ' fue ', ' son ',
  ' está ', ' están ', ' era ', ' será ', ' sería ', ' puede ', ' deben ',
  ' debe ', ' tener ', ' hacer ', ' decir ', ' ver ', ' dar ', ' saber ',
];

function findSpanish(text, key, file, results) {
  if (!text || typeof text !== 'string') return;
  const lower = text.toLowerCase();
  
  // Check for Spanish-specific characters
  for (const ch of spanishIndicators) {
    if (lower.includes(ch)) {
      results.push({ file, key, value: text, reason: `contains '${ch}'` });
      return;
    }
  }
  
  // Check for Spanish words (only if text is long enough)
  if (text.length > 10) {
    let wordCount = 0;
    for (const word of spanishWords) {
      const parts = lower.split(word);
      if (parts.length > 1) wordCount += parts.length - 1;
    }
    if (wordCount >= 2) {
      results.push({ file, key, value: text, reason: `contains ${wordCount} Spanish words` });
      return;
    }
  }
}

function scanObject(obj, prefix, file, results) {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      findSpanish(value, fullKey, file, results);
    } else if (typeof value === 'object' && value !== null) {
      scanObject(value, fullKey, file, results);
    }
  }
}

const files = fs.readdirSync(enDir).filter(f => f.endsWith('.json'));
const results = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(enDir, file), 'utf8');
  const json = JSON.parse(content);
  scanObject(json, '', file, results);
}

console.log(`Found ${results.length} potential Spanish texts remaining:\n`);
for (const r of results) {
  console.log(`[${r.file}] ${r.key}: "${r.value}" (${r.reason})`);
}
