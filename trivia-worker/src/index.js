// tdc-trivia: syncs the private Box spreadsheet into KV on a schedule and serves
// today's question at /api/trivia (site) and /api/trivia/bot (WhatsApp bot).
// The correct answer never leaves this Worker before 8 p.m. Eastern.
import { OPEN, REVEAL, nowET, label, parseWorkbook, withChoices, questionText, pollLines, answerText } from './trivia.js';

/* ---------- Box ---------- */
async function boxToken(env){
  const r = await fetch('https://api.box.com/oauth2/token', { method: 'POST', body: new URLSearchParams({
    grant_type: 'client_credentials', client_id: env.BOX_CLIENT_ID, client_secret: env.BOX_CLIENT_SECRET,
    box_subject_type: 'enterprise', box_subject_id: env.BOX_ENTERPRISE_ID }) });
  if (!r.ok) throw new Error('box auth ' + r.status);
  return (await r.json()).access_token;
}

/* ---------- sync ---------- */
// Downloads only when Box's SHA-1 of the file changes. A file with no valid rows
// throws before anything is written, so the last good schedule stays live.
async function sync(env, force = false){
  const h = { Authorization: 'Bearer ' + await boxToken(env) };
  const info = await (await fetch('https://api.box.com/2.0/files/' + env.BOX_FILE_ID + '?fields=sha1,modified_at', { headers: h })).json();
  if (!info.sha1) throw new Error('box file info: ' + (info.code || info.message || 'no sha1'));
  if (!force && info.sha1 === await env.TRIVIA_KV.get('file:sha1')) return { changed: false };

  const file = await fetch('https://api.box.com/2.0/files/' + env.BOX_FILE_ID + '/content', { headers: h });
  if (!file.ok) throw new Error('box download ' + file.status);
  const { schedule, skipped, rows } = parseWorkbook(new Uint8Array(await file.arrayBuffer()));
  if (!rows) throw new Error('no valid rows; keeping previous schedule. ' + skipped.slice(0, 3).join('; '));

  await env.TRIVIA_KV.put('schedule', JSON.stringify(schedule));
  await env.TRIVIA_KV.put('file:sha1', info.sha1);
  const report = { at: new Date().toISOString(), modified: info.modified_at, rows, skipped };
  await env.TRIVIA_KV.put('sync:last', JSON.stringify(report));
  return { changed: true, ...report };
}

/* ---------- today ---------- */
// Once a day goes live its question and A–D order are frozen, so a later edit to
// that row can't change the question under people who already answered.
async function itemFor(env, date, lock){
  const locked = await env.TRIVIA_KV.get('lock:' + date, 'json');
  if (locked) return locked;
  const schedule = await env.TRIVIA_KV.get('schedule', 'json') || {};
  const item = schedule[date] ? withChoices(date, schedule[date]) : null;
  if (item && lock) await env.TRIVIA_KV.put('lock:' + date, JSON.stringify(item), { expirationTtl: 60 * 60 * 48 });
  return item;
}

/* ---------- helpers ---------- */
// An unset secret must never match: without the length guard, a missing BOT_KEY
// would make "Bearer undefined" a valid credential.
function matches(given, secret){
  if (!secret || !given) return false;
  const a = new TextEncoder().encode(given), b = new TextEncoder().encode(secret);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

const json = (body, status = 200, cache = 'public, max-age=60', extra = {}) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': cache, ...extra } });
const text = t => new Response(t, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
const notFound = () => new Response('Not found', { status: 404 });

// Public data, read by the site from tdcreboot.com and from preview hosts.
const CORS = { 'Access-Control-Allow-Origin': '*' };

export default {
  async scheduled(event, env, ctx){
    try { await sync(env); } catch (e) { console.error('sync failed', e.message); }
    const { date, minutes } = nowET();
    if (minutes >= OPEN) await itemFor(env, date, true);
  },

  async fetch(req, env){
    const url = new URL(req.url);

    if (url.pathname === '/api/trivia'){
      const { date, minutes } = nowET();
      if (minutes < OPEN) return json({ live: false }, 200, undefined, CORS);
      const item = await itemFor(env, date, true);
      if (!item) return json({ live: false }, 200, undefined, CORS);
      const out = { live: true, date, dateLabel: label(date), question: item.question, choices: item.choices };
      if (minutes >= REVEAL) out.correctIndex = item.correctIndex;
      return json(out, 200, undefined, CORS);
    }

    if (url.pathname === '/api/trivia/bot'){
      const auth = req.headers.get('Authorization') || '';
      if (!matches(auth.replace(/^Bearer /, ''), env.BOT_KEY)) return notFound();
      const what = url.searchParams.get('what');

      // Test mode: ?date=YYYY-MM-DD returns that day's message right away, ignoring
      // the clock and never locking, marked [TEST] so it can't pass for a real post.
      const testDate = url.searchParams.get('date');
      if (testDate){
        const item = /^\d{4}-\d{2}-\d{2}$/.test(testDate) ? await itemFor(env, testDate, false) : null;
        if (!item) return text('NO_REPLY');
        if (what === 'answer') return text('[TEST] ' + answerText(testDate, item, env.SITE_URL));
        if (what === 'poll') return text('[TEST] ' + pollLines(testDate, item));
        return text('[TEST] ' + questionText(testDate, item));
      }

      const { date, minutes } = nowET();
      if (minutes < OPEN) return text('NO_REPLY');
      const item = await itemFor(env, date, true);
      if (!item) return text('NO_REPLY');
      if (what === 'answer') return text(minutes >= REVEAL ? answerText(date, item, env.SITE_URL) : 'NO_REPLY');
      if (what === 'poll') return text(pollLines(date, item));
      return text(questionText(date, item));
    }

    if (!matches(url.searchParams.get('key'), env.ADMIN_KEY)) return notFound();

    if (url.pathname === '/api/trivia/sync')
      return json(await sync(env, true).catch(e => ({ error: e.message })), 200, 'no-store');
    if (url.pathname === '/api/trivia/status')
      return json(await env.TRIVIA_KV.get('sync:last', 'json') || {}, 200, 'no-store');
    if (url.pathname === '/api/trivia/preview'){
      const d = url.searchParams.get('date') || nowET().date;
      return json({ date: d, ...(await itemFor(env, d, false)) }, 200, 'no-store');
    }
    return notFound();
  }
};
