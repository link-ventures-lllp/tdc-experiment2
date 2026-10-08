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
// Text dates are accepted as 2026-10-12, 10/12/2026, or 12-Oct-26 / 12 Oct 2026.
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
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
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{2}|\d{4})$/);
  if (m && MONTHS.includes(m[2].toLowerCase())){
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + pad(MONTHS.indexOf(m[2].toLowerCase()) + 1) + '-' + pad(m[1]);
  }
  return '';
}

// Header names, compared after lowercasing and dropping spaces and punctuation.
const DATE_COLS = ['publishdate', 'date'];
const CORRECT_COLS = ['correctanswer', 'correct', 'answer'];
const isWrong = k => /^(wrong|incorrect)/.test(k);

// The header row is the first row (in the first 20) with a "question" cell, so a
// title row above the table or an empty first column doesn't matter. The first
// sheet that has one is used; other sheets (notes, etc.) are ignored.
function findTable(wb){
  for (const name of wb.SheetNames){
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true, blankrows: true });
    for (let r = 0; r < Math.min(grid.length, 20); r++){
      const keys = grid[r].map(norm);
      if (keys.includes('question')) return { grid, headerRow: r, keys };
    }
  }
  return null;
}

export function parseWorkbook(buf){
  const wb = XLSX.read(buf, { type: 'array' });
  const schedule = {}, skipped = [];
  const table = findTable(wb);
  if (!table) return { schedule, skipped: ['no sheet has a "Question" header'], rows: 0 };

  const { grid, headerRow, keys } = table;
  const col = names => keys.findIndex(k => names.includes(k));
  const cDate = col(DATE_COLS), cQ = keys.indexOf('question'), cCorrect = col(CORRECT_COLS);
  const cWrong = keys.map((k, i) => isWrong(k) ? i : -1).filter(i => i >= 0).slice(0, 3);
  if (cDate < 0 || cCorrect < 0 || cWrong.length < 3)
    return { schedule, skipped: ['header row ' + (headerRow + 1) + ' needs Date, Correct answer and three Incorrect/Wrong answer columns'], rows: 0 };

  for (let r = headerRow + 1; r < grid.length; r++){
    const row = grid[r];
    const date = toISO(row[cDate]);
    const q = String(row[cQ] ?? '').trim();
    const correct = String(row[cCorrect] ?? '').trim();
    const wrong = cWrong.map(i => String(row[i] ?? '').trim()).filter(Boolean);
    const line = 'row ' + (r + 1);
    if (!date && !q) continue;                                 // blank row
    if (!date) { skipped.push(line + ': no date'); continue; }
    if (!q || !correct || wrong.length < 3) { skipped.push(line + ' (' + date + '): missing question or answers'); continue; }
    if (schedule[date]) { skipped.push(line + ' (' + date + '): duplicate date'); continue; }
    schedule[date] = { q, correct, wrong };
  }
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
