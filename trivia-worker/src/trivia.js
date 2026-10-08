// Pure trivia logic: parsing the spreadsheet, the Eastern-time clock, the per-day
// choice order, and the WhatsApp message text. No Cloudflare or Box APIs here, so
// it runs under `node --test` as-is.
import * as XLSX from 'xlsx';

export const TZ = 'America/New_York';
export const OPEN = 7 * 60;      // 7:00 a.m. ET, minutes after midnight
export const REVEAL = 20 * 60;   // 8:00 p.m. ET

export function nowET(d = new Date()){
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: p.year + '-' + p.month + '-' + p.day, minutes: +p.hour * 60 + +p.minute };
}

export const label = iso => new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric'
}).format(new Date(iso + 'T12:00:00Z'));

/* ---------- parse ---------- */
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const pad = n => String(n).padStart(2, '0');

// Date cells arrive as Excel serial numbers (cellDates is off on purpose: a JS Date
// built from a serial can land a day early depending on the runtime's timezone).
export function toISO(v){
  if (typeof v === 'number' && v > 0){
    const d = XLSX.SSF.parse_date_code(v);
    return d ? d.y + '-' + pad(d.m) + '-' + pad(d.d) : '';
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + pad(m[1]) + '-' + pad(m[2]);
  return '';
}

export function parseWorkbook(buf){
  const wb = XLSX.read(buf, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true });
  const schedule = {}, skipped = [];
  rows.forEach(raw => {
    const r = {}; for (const k in raw) r[norm(k)] = raw[k];
    const date = toISO(r.publishdate);
    const q = String(r.question ?? '').trim();
    const correct = String(r.correctanswer ?? r.correct ?? '').trim();
    const wrong = Object.keys(r).filter(k => k.startsWith('wrong')).sort()
      .map(k => String(r[k]).trim()).filter(Boolean).slice(0, 3);
    const line = 'row ' + (raw.__rowNum__ + 1);                // sheet row, blank rows included
    if (!date && !q) return;                                   // blank row
    if (!date) return skipped.push(line + ': no publish_date');
    if (!q || !correct || wrong.length < 3) return skipped.push(line + ' (' + date + '): missing question or answers');
    if (schedule[date]) return skipped.push(line + ' (' + date + '): duplicate date');
    schedule[date] = { q, correct, wrong };
  });
  return { schedule, skipped, rows: Object.keys(schedule).length };
}

/* ---------- choice order ---------- */
// Seeded by date + question, so every visitor and the bot see the same A–D.
function seeded(str){
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}
export function withChoices(date, item){
  const rnd = seeded(date + item.q), choices = [item.correct, ...item.wrong];
  for (let i = choices.length - 1; i > 0; i--){
    const j = Math.floor(rnd() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { question: item.q, choices, correctIndex: choices.indexOf(item.correct) };
}

/* ---------- WhatsApp text ---------- */
const lettered = item => item.choices.map((c, i) => 'ABCD'[i] + '. ' + c);

export function questionText(date, item){
  return ['*ΘΔΧ Daily Trivia · ' + label(date) + '*', '', item.question, '', ...lettered(item), '',
    'Reply with A, B, C or D. Answer at 8 p.m.'].join('\n');
}
export function answerText(date, item, siteUrl){
  const lines = ['*ΘΔΧ Daily Trivia answer · ' + label(date) + '*', '', item.question, '',
    'Answer: *' + lettered(item)[item.correctIndex] + '*', '', 'New question tomorrow at 7 a.m.'];
  if (siteUrl) lines.push(siteUrl);
  return lines.join('\n');
}
