// Análisis de exportación de chat de WhatsApp (chat.md)
// Genera estadísticas por participante y un informe HTML con gráficos SVG inline.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'chat.md');
const raw = fs.readFileSync(FILE, 'utf8');
const lines = raw.split(/\r?\n/);

const MESES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

// ---------- Parseo ----------
const reDate = /^## (\d{1,2}) de ([a-záéíóú]+) de (\d{4})/i;
const reMsg = /^\[(\d{1,2}):(\d{2}) ([ap])\.m\.\] \*\*(.+?):\*\*\s?(.*)$/;
const reSys = /^\[(\d{1,2}):(\d{2}) ([ap])\.m\.\] __/;
const reMedia = /^\[(Mensaje de voz|Audio|Imagen|Video|Sticker|Documento|GIF|Ubicación|Contacto)\]\s*/i;
const reQuote = /^>\s*_/;

const messages = []; // {ts, author, ownText, type, forwarded}
let curDate = null;
let cur = null; // {ts, author, firstLine, extra: []}
const systemEvents = { joins: 0, leaves: 0, notifications: 0, other: 0 };

function toTs(h, m, ap) {
  let hh = parseInt(h, 10) % 12;
  if (ap === 'p') hh += 12;
  return new Date(curDate.y, curDate.m, curDate.d, hh, parseInt(m, 10)).getTime();
}

// Extrae el texto propio del mensaje descartando bloques de cita (> _..._).
// Una cita empieza con "> _" y puede ocupar varias líneas hasta la línea que termina en "_".
function splitOwn(all) {
  const own = [];
  let inQuote = false;
  for (const l of all) {
    const t = l.trim();
    if (inQuote) {
      if (t.endsWith('_')) inQuote = false;
      continue;
    }
    if (/^>\s*_/.test(t)) {
      if (!t.endsWith('_')) inQuote = true; // cita multilínea
      continue;
    }
    own.push(l);
  }
  return own.join('\n').trim();
}

function finalize() {
  if (!cur) return;
  const all = [cur.firstLine, ...cur.extra];
  const own = splitOwn(all);
  let c = own, forwarded = false;
  if (/^\[Reenviado\]/i.test(c)) { forwarded = true; c = c.replace(/^\[Reenviado\]\s*/i, ''); }
  const mm = c.match(reMedia);
  let type = 'text';
  if (/^_?Se eliminó este mensaje_?$/i.test(c) || /^_?You deleted this message_?$/i.test(c)) {
    type = 'deleted'; c = '';
  } else if (mm) {
    const k = mm[1].toLowerCase();
    if (k === 'mensaje de voz' || k === 'audio') type = 'audio';
    else if (k === 'imagen') type = 'image';
    else if (k === 'video') type = 'video';
    else if (k === 'sticker') type = 'sticker';
    else if (k === 'documento') type = 'document';
    else type = 'other_media';
    c = c.replace(reMedia, '').trim();
  }
  messages.push({ ts: cur.ts, author: cur.author, type, forwarded, text: c });
  cur = null;
}

for (const line of lines) {
  const d = line.match(reDate);
  if (d) {
    finalize();
    curDate = { d: +d[1], m: MESES[d[2].toLowerCase()], y: +d[3] };
    continue;
  }
  if (!curDate) continue;
  if (reSys.test(line)) {
    finalize();
    const body = line.toLowerCase();
    if (body.includes('notificación del sistema')) systemEvents.notifications++;
    else if (body.includes('se unieron') || body.includes('añadió')) systemEvents.joins++;
    else if (body.includes('salieron') || body.includes('eliminó')) systemEvents.leaves++;
    else systemEvents.other++;
    continue;
  }
  const m = line.match(reMsg);
  if (m) {
    finalize();
    cur = { ts: toTs(m[1], m[2], m[3]), author: m[4].trim(), firstLine: m[5] || '', extra: [] };
  } else if (cur && line.trim()) {
    cur.extra.push(line);
  }
}
finalize();

// ---------- Estadísticas por autor ----------
const authors = new Map();
function A(name) {
  if (!authors.has(name)) {
    authors.set(name, {
      name, total: 0, text: 0, audio: 0, image: 0, video: 0, sticker: 0,
      document: 0, other_media: 0, deleted: 0, forwarded: 0, chars: 0, words: 0, links: 0,
      days: new Set(), first: Infinity, last: -Infinity,
    });
  }
  return authors.get(name);
}

for (const m of messages) {
  const a = A(m.author);
  a.total++;
  a[m.type] = (a[m.type] || 0) + 1;
  if (m.forwarded) a.forwarded++;
  a.chars += m.text.length;
  a.words += m.text.split(/\s+/).filter(Boolean).length;
  a.links += (m.text.match(/https?:\/\//g) || []).length;
  a.days.add(new Date(m.ts).toDateString());
  if (m.ts < a.first) a.first = m.ts;
  if (m.ts > a.last) a.last = m.ts;
}

// ---------- Ráfagas ----------
// Ráfaga: >=3 mensajes consecutivos del mismo autor con hueco <= 5 min entre cada uno
const GAP = 5 * 60 * 1000;
const bursts = [];
let run = null;
for (const m of messages) {
  if (run && run.author === m.author && (m.ts - run.lastTs) <= GAP) {
    run.n++; run.lastTs = m.ts; run.end = m.ts;
    if (m.type === 'audio') run.audios++;
    if (m.type !== 'text') run.media++;
  } else {
    if (run && run.n >= 3) bursts.push(run);
    run = { author: m.author, start: m.ts, end: m.ts, lastTs: m.ts, n: 1, audios: m.type === 'audio' ? 1 : 0, media: m.type !== 'text' ? 1 : 0 };
  }
}
if (run && run.n >= 3) bursts.push(run);

const burstStats = new Map();
for (const b of bursts) {
  if (!burstStats.has(b.author)) burstStats.set(b.author, { bursts: 0, msgs: 0, max: 0, audioMsgs: 0, mediaMsgs: 0 });
  const s = burstStats.get(b.author);
  s.bursts++; s.msgs += b.n; s.max = Math.max(s.max, b.n);
  s.audioMsgs += b.audios; s.mediaMsgs += b.media;
}

// ---------- Series temporales ----------
const perDay = new Map();
const perHour = new Array(24).fill(0);
for (const m of messages) {
  const d = new Date(m.ts);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  perDay.set(key, (perDay.get(key) || 0) + 1);
  perHour[d.getHours()]++;
}
const dayKeys = [...perDay.keys()].sort();

const firstTs = messages[0]?.ts, lastTs = messages[messages.length - 1]?.ts;
const totalDays = Math.max(1, Math.round((lastTs - firstTs) / 86400000) + 1);

const sorted = [...authors.values()].sort((a, b) => b.total - a.total);
const totalMsgs = messages.length;
const mediaTotals = { audio: 0, image: 0, video: 0, sticker: 0, document: 0, other_media: 0, deleted: 0 };
for (const a of sorted) for (const k of Object.keys(mediaTotals)) mediaTotals[k] += a[k] || 0;
const burstMsgsTotal = [...burstStats.values()].reduce((s, b) => s + b.msgs, 0);
const fwdTotal = sorted.reduce((s, a) => s + a.forwarded, 0);

// ---------- Datos para consola ----------
const summary = {
  rango: { inicio: new Date(firstTs).toISOString().slice(0, 10), fin: new Date(lastTs).toISOString().slice(0, 10), dias: totalDays },
  totalMensajes: totalMsgs,
  participantes: sorted.length,
  media: mediaTotals,
  reenviados: fwdTotal,
  sistema: systemEvents,
  rafagas: { total: bursts.length, mensajesEnRafagas: burstMsgsTotal },
  top: sorted.slice(0, 20).map(a => ({
    autor: a.name, msgs: a.total, pct: +(a.total / totalMsgs * 100).toFixed(1),
    texto: a.text, audio: a.audio, sticker: a.sticker, doc: a.document, img: a.image, video: a.video, elim: a.deleted,
    reenv: a.forwarded, diasActivos: a.days.size,
    rafagas: burstStats.get(a.name) || null,
  })),
};
console.log(JSON.stringify(summary, null, 2));

// ---------- Informe HTML ----------
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function barChart(entries, opts = {}) {
  const { w = 900, barH = 22, pad = 6, labelW = 190, colors = ['#25d366'] } = opts;
  const max = Math.max(1, ...entries.map(e => e.value));
  const valW = 70;
  const cw = w - labelW - valW - 20;
  const h = entries.length * (barH + pad) + 30;
  let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%">`;
  let y = 10;
  for (const e of entries) {
    const bw = Math.max(2, e.value / max * cw);
    svg += `<text x="${labelW - 8}" y="${y + barH * 0.72}" text-anchor="end" font-size="12" fill="#ddd">${esc(e.label)}</text>`;
    svg += `<rect x="${labelW}" y="${y}" width="${bw}" height="${barH}" rx="3" fill="${e.color || colors[0]}"/>`;
    svg += `<text x="${labelW + bw + 6}" y="${y + barH * 0.72}" font-size="12" fill="#fff">${e.value}</text>`;
    y += barH + pad;
  }
  return svg + '</svg>';
}

function stackedBar(entries, segs, opts = {}) {
  const { w = 900, barH = 24, pad = 7, labelW = 190 } = opts;
  const max = Math.max(1, ...entries.map(e => segs.reduce((s, g) => s + (e.parts[g.key] || 0), 0)));
  const valW = 70, cw = w - labelW - valW - 20;
  const h = entries.length * (barH + pad) + 40;
  let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%">`;
  let lx = labelW;
  for (const g of segs) {
    svg += `<rect x="${lx}" y="0" width="12" height="12" fill="${g.color}" rx="2"/><text x="${lx + 16}" y="11" font-size="11" fill="#ccc">${g.label}</text>`;
    lx += 16 + g.label.length * 6.5 + 18;
  }
  let y = 22;
  for (const e of entries) {
    svg += `<text x="${labelW - 8}" y="${y + barH * 0.72}" text-anchor="end" font-size="12" fill="#ddd">${esc(e.label)}</text>`;
    let x = labelW, tot = 0;
    for (const g of segs) {
      const v = e.parts[g.key] || 0; tot += v;
      const bw = v / max * cw;
      if (bw > 0) svg += `<rect x="${x}" y="${y}" width="${Math.max(bw, 0.5)}" height="${barH}" fill="${g.color}"/>`;
      x += bw;
    }
    svg += `<text x="${x + 6}" y="${y + barH * 0.72}" font-size="12" fill="#fff">${tot}</text>`;
    y += barH + pad;
  }
  return svg + '</svg>';
}

function lineChart(points, opts = {}) {
  const { w = 920, h = 200, color = '#25d366', label = '' } = opts;
  const max = Math.max(1, ...points.map(p => p.v));
  const px = 45, py = 20, cw = w - px - 15, ch = h - py - 30;
  const n = points.length;
  let pathD = '';
  points.forEach((p, i) => {
    const x = px + (n === 1 ? cw / 2 : i / (n - 1) * cw);
    const y = py + ch - p.v / max * ch;
    pathD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
  });
  const area = pathD + `L${px + cw},${py + ch} L${px},${py + ch} Z`;
  let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%">`;
  for (let i = 0; i <= 4; i++) {
    const gy = py + ch - i / 4 * ch;
    svg += `<line x1="${px}" y1="${gy}" x2="${px + cw}" y2="${gy}" stroke="#333"/><text x="${px - 6}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#888">${Math.round(max * i / 4)}</text>`;
  }
  svg += `<path d="${area}" fill="${color}22"/><path d="${pathD}" fill="none" stroke="${color}" stroke-width="2"/>`;
  const step = Math.ceil(n / 10);
  points.forEach((p, i) => {
    if (i % step === 0 || i === n - 1) {
      const x = px + (n === 1 ? cw / 2 : i / (n - 1) * cw);
      svg += `<text x="${x}" y="${h - 8}" text-anchor="middle" font-size="9" fill="#888" transform="rotate(-30 ${x} ${h - 8})">${p.k.slice(5)}</text>`;
    }
  });
  if (label) svg += `<text x="${px}" y="14" font-size="11" fill="#aaa">${esc(label)}</text>`;
  return svg + '</svg>';
}

const C = { text: '#4aa3ff', audio: '#25d366', image: '#ff9f43', video: '#ee5253', sticker: '#a55eea', document: '#f368e0' };

const top15 = sorted.slice(0, 15);
const chartMsgs = stackedBar(top15.map(a => ({ label: a.name, parts: { text: a.text, audio: a.audio, media: (a.image || 0) + (a.video || 0), sticker: a.sticker, doc: a.document } })),
  [{ key: 'text', color: C.text, label: 'Texto' }, { key: 'audio', color: C.audio, label: 'Audio' }, { key: 'media', color: C.image, label: 'Imagen/Video' }, { key: 'sticker', color: C.sticker, label: 'Sticker' }, { key: 'doc', color: C.document, label: 'Documento' }]);

const chartAudios = barChart([...sorted].filter(a => a.audio > 0).sort((x, y) => y.audio - x.audio).map(a => ({ label: a.name, value: a.audio, color: C.audio })));
const chartStickers = barChart([...sorted].filter(a => a.sticker > 0).sort((x, y) => y.sticker - x.sticker).map(a => ({ label: a.name, value: a.sticker, color: C.sticker })));
const chartDocs = barChart([...sorted].filter(a => (a.document + a.image + a.video) > 0).sort((x, y) => (y.document + y.image + y.video) - (x.document + x.image + x.video)).map(a => ({ label: a.name, value: a.document + a.image + a.video, color: C.document })));
const chartTimeline = lineChart(dayKeys.map(k => ({ k, v: perDay.get(k) })), { label: 'Mensajes por día' });
const chartHours = barChart(perHour.map((v, h) => ({ label: String(h).padStart(2, '0') + ':00', value: v, color: '#00d2d3' })), { barH: 12, pad: 3, labelW: 50 });
const burstRank = [...burstStats.entries()].sort((a, b) => b[1].msgs - a[1].msgs);
const chartBursts = barChart(burstRank.slice(0, 15).map(([name, s]) => ({ label: `${name} (${s.bursts} ráfagas, máx ${s.max})`, value: s.msgs, color: '#ee5253' })));

let rows = '';
sorted.forEach((a, i) => {
  const bs = burstStats.get(a.name) || { bursts: 0, msgs: 0, max: 0 };
  const media = (a.image || 0) + (a.video || 0) + (a.document || 0) + (a.sticker || 0) + (a.other_media || 0);
  const pct = (a.total / totalMsgs * 100).toFixed(1);
  const avgLen = a.text > 0 ? Math.round(a.chars / a.text) : 0;
  rows += `<tr><td>${i + 1}</td><td>${esc(a.name)}</td><td>${a.total}</td><td>${pct}%</td><td>${a.text}</td><td>${a.audio}</td><td>${a.image || 0}</td><td>${a.video || 0}</td><td>${a.sticker}</td><td>${a.document}</td><td>${a.forwarded}</td><td>${a.deleted || 0}</td><td>${media}</td><td>${a.days.size}</td><td>${avgLen}</td><td>${bs.bursts}</td><td>${bs.msgs}</td><td>${bs.max}</td></tr>`;
});

const topBursts = [...bursts].sort((a, b) => b.n - a.n).slice(0, 15);
let burstRows = '';
for (const b of topBursts) {
  const s = new Date(b.start);
  const fmt = d => `${d.toLocaleDateString('es')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const mins = Math.round((b.end - b.start) / 60000);
  burstRows += `<tr><td>${esc(b.author)}</td><td>${b.n}</td><td>${b.audios}</td><td>${b.media}</td><td>${fmt(s)}</td><td>${mins} min</td></tr>`;
}

const saturacion5 = sorted.slice(0, 5).reduce((s, a) => s + a.total, 0);
const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Informe del grupo — FEDECO - TQ</title>
<style>
body{font-family:system-ui,Segoe UI,Arial,sans-serif;background:#111b21;color:#e9edef;margin:0;padding:24px;max-width:980px;margin:auto}
h1{color:#25d366} h2{color:#00a884;border-bottom:1px solid #2a3942;padding-bottom:6px;margin-top:40px}
.card{background:#202c33;border-radius:10px;padding:16px 20px;margin:14px 0}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:6px 8px;border-bottom:1px solid #2a3942;text-align:right}
th{color:#00a884} td:first-child,th:first-child,td:nth-child(2),th:nth-child(2){text-align:left}
.kpi{display:flex;flex-wrap:wrap;gap:14px}.kpi .box{flex:1;min-width:140px;background:#2a3942;border-radius:8px;padding:12px;text-align:center}
.kpi .num{font-size:26px;font-weight:700;color:#25d366}.kpi .lbl{font-size:12px;color:#8696a0}
.warn{background:#3a2a2a;border-left:4px solid #ee5253}.ok{background:#1f3a2a;border-left:4px solid #25d366}
ul{line-height:1.7}.small{font-size:12px;color:#8696a0}
tr:hover{background:#2a3942}
</style></head><body>
<h1>Informe de actividad del grupo de WhatsApp</h1>
<p class="small">Generado a partir de <code>chat.md</code> — período: <b>${new Date(firstTs).toLocaleDateString('es')}</b> a <b>${new Date(lastTs).toLocaleDateString('es')}</b> (${totalDays} días)</p>

<div class="kpi card">
<div class="box"><div class="num">${totalMsgs}</div><div class="lbl">mensajes totales</div></div>
<div class="box"><div class="num">${sorted.length}</div><div class="lbl">participantes que escribieron</div></div>
<div class="box"><div class="num">${mediaTotals.audio}</div><div class="lbl">audios / notas de voz</div></div>
<div class="box"><div class="num">${mediaTotals.image + mediaTotals.video}</div><div class="lbl">imágenes + videos</div></div>
<div class="box"><div class="num">${mediaTotals.sticker}</div><div class="lbl">stickers</div></div>
<div class="box"><div class="num">${mediaTotals.document}</div><div class="lbl">documentos</div></div>
<div class="box"><div class="num">${mediaTotals.deleted}</div><div class="lbl">mensajes eliminados</div></div>
<div class="box"><div class="num">${(totalMsgs / totalDays).toFixed(1)}</div><div class="lbl">mensajes/día (promedio)</div></div>
<div class="box"><div class="num">${bursts.length}</div><div class="lbl">ráfagas (≥3 msg seguidos)</div></div>
</div>

<h2>1. Participación por persona (top 15)</h2>
<div class="card">${chartMsgs}
<p class="small">Los 5 participantes más activos concentran el <b>${(saturacion5 / totalMsgs * 100).toFixed(1)}%</b> de todos los mensajes del grupo.</p></div>

<h2>2. Audios por persona</h2>
<div class="card">${chartAudios}</div>

<h2>3. Stickers por persona</h2>
<div class="card">${chartStickers}</div>

<h2>4. Archivos enviados por persona (documentos + imágenes + videos)</h2>
<div class="card">${chartDocs}</div>

<h2>5. Saturación y ráfagas</h2>
<div class="card warn"><b>¿Quiénes saturan el grupo?</b><br>
${sorted.slice(0, 5).map(a => `• <b>${esc(a.name)}</b>: ${a.total} mensajes (${(a.total / totalMsgs * 100).toFixed(1)}% del grupo)`).join('<br>')}
</div>
<div class="card">${chartBursts}
<p class="small">Ráfaga = ≥3 mensajes consecutivos de la misma persona con menos de 5 minutos entre cada uno. La etiqueta muestra: mensajes en ráfagas (nº de ráfagas, ráfaga más larga).</p></div>

<h3>Mayores ráfagas individuales</h3>
<div class="card"><table><tr><th>Autor</th><th>Mensajes</th><th>Audios</th><th>Media</th><th>Inicio</th><th>Duración</th></tr>${burstRows}</table></div>

<h2>6. Actividad en el tiempo</h2>
<div class="card">${chartTimeline}</div>
<div class="card"><b>Actividad por hora del día</b>${chartHours}</div>

<h2>7. Tabla completa de participantes</h2>
<div class="card" style="overflow-x:auto"><table>
<tr><th>#</th><th>Participante</th><th>Total</th><th>%</th><th>Texto</th><th>Audios</th><th>Imgs</th><th>Videos</th><th>Stickers</th><th>Docs</th><th>Reenv.</th><th>Elim.</th><th>Media tot.</th><th>Días activo</th><th>Long. prom.</th><th>Ráfagas</th><th>Msgs en ráfaga</th><th>Ráfaga máx.</th></tr>
${rows}</table></div>

<h2>8. Cómo se está "contaminando" el grupo</h2>
<div class="card warn"><ul>
<li><b>Concentración:</b> "${esc(sorted[0]?.name || '')}" genera por sí sola el ${(sorted[0].total / totalMsgs * 100).toFixed(1)}% del tráfico${sorted[1] ? `, y junto a "${esc(sorted[1].name)}" suman el ${((sorted[0].total + sorted[1].total) / totalMsgs * 100).toFixed(1)}%` : ''}. Dos personas producen más de la mitad del grupo.</li>
<li><b>Audios:</b> ${mediaTotals.audio} notas de voz (${(mediaTotals.audio / totalMsgs * 100).toFixed(1)}% del total). Es el formato más contaminante: no se puede buscar ni escanear, obliga a escuchar en tiempo real, y en ráfaga convierte el grupo en un podcast.</li>
<li><b>Ráfagas:</b> ${bursts.length} ráfagas de ≥3 mensajes seguidos, con ${burstMsgsTotal} mensajes (${(burstMsgsTotal / totalMsgs * 100).toFixed(1)}% del total). Una parte importante del grupo es monólogo, no conversación.</li>
<li><b>Reenviados:</b> ${fwdTotal} mensajes reenviados — contenido no original que suele aportar ruido (cadenas, promociones, noticias ajenas al objetivo del grupo).</li>
<li><b>Multimedia:</b> ${mediaTotals.image + mediaTotals.video + mediaTotals.sticker + mediaTotals.document} archivos/stickers/videos — consumen el almacenamiento de todos los miembros y entierran los mensajes importantes.</li>
<li><b>Mensajes eliminados:</b> ${mediaTotals.deleted} mensajes borrados (${(mediaTotals.deleted / totalMsgs * 100).toFixed(1)}% del total). Eliminar mensajes en un grupo de coordinación rompe el hilo de las conversaciones y genera desconfianza.</li>
<li><b>Mayor emisor de ráfagas:</b> ${esc(burstRank[0]?.[0] || '')} — ${burstRank[0]?.[1].msgs} mensajes dentro de ${burstRank[0]?.[1].bursts} ráfagas (récord: ${burstRank[0]?.[1].max} mensajes seguidos), de los cuales ${burstRank[0]?.[1].audioMsgs} fueron audios y ${burstRank[0]?.[1].mediaMsgs} multimedia.</li>
</ul></div>

<h2>9. Sugerencias</h2>
<div class="card ok"><ul>
<li><b>Regla "un mensaje, una idea":</b> redactar antes de enviar en vez de escribir frase por frase. Un mensaje largo contamina menos que 10 cortos seguidos.</li>
<li><b>Limitar notas de voz:</b> pedir un resumen escrito al final de cada audio largo, o mover las respuestas de voz a un hilo/grupo aparte. Las decisiones tomadas por voz no quedan buscables.</li>
<li><b>Desactivar la descarga automática de multimedia</b> en cada miembro (Ajustes → Almacenamiento y datos) para que stickers y videos no llenen los teléfonos.</li>
<li><b>Dos canales:</b> un grupo de anuncios (solo admins: decisiones, reuniones, documentos clave) y otro de debate libre. Así lo importante no queda enterrado.</li>
<li><b>Usar encuestas y eventos de WhatsApp</b> para decisiones y reuniones en lugar de largas cadenas de propuestas.</li>
<li><b>Norma de reenviados:</b> prohibir cadenas sin contexto; cada reenvío debe explicar por qué es relevante para el grupo.</li>
<li><b>Resumen semanal fijado:</b> un admin publica las decisiones y archivos clave de la semana como mensaje destacado.</li>
<li><b>Hablar en privado con los mayores emisores de ráfagas:</b> los datos muestran quiénes son; una conversación amable con las 2-3 personas que más saturan reduce la mayor parte del ruido.</li>
</ul></div>
<p class="small">Eventos del sistema en el período: ${systemEvents.joins} incorporaciones, ${systemEvents.leaves} salidas/expulsiones, ${systemEvents.notifications} notificaciones del sistema.</p>
</body></html>`;

fs.writeFileSync(path.join(__dirname, 'informe_chat.html'), html);
console.log('OK: informe_chat.html generado');
