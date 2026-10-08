// Renderings gallery: images live in a private Box folder, are copied into KV by the
// scheduled sync, and are served by this Worker at /r/<RENDERINGS_PATH>/. Neither the
// images nor the path are in git; RENDERINGS_PATH is a Worker secret.

const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const KV_MAX = 25 * 1024 * 1024;   // KV's per-value limit

/* ---------- sync from Box ---------- */
// Lists the folder, downloads only files whose SHA-1 is new, and drops images that
// were removed from the folder. Images are keyed by SHA-1, so a replaced file gets a
// new URL and browsers never show a stale cached copy.
export async function syncRenderings(env, token){
  if (!env.RENDERINGS_FOLDER_ID) return { skipped: 'RENDERINGS_FOLDER_ID not set' };
  const h = { Authorization: 'Bearer ' + token };
  const res = await fetch('https://api.box.com/2.0/folders/' + env.RENDERINGS_FOLDER_ID +
    '/items?fields=id,name,sha1,extension,size&limit=1000', { headers: h });
  if (!res.ok) throw new Error('box folder ' + res.status);
  const entries = (await res.json()).entries || [];

  const prev = await env.TRIVIA_KV.get('renderings:manifest', 'json') || [];
  const have = new Set(prev.map(f => f.sha1));
  const manifest = [], skipped = [];
  let downloaded = 0;

  for (const e of entries){
    const ext = String(e.extension || '').toLowerCase();
    if (e.type !== 'file' || !IMAGE_TYPES[ext]) continue;
    if (e.size > KV_MAX){ skipped.push(e.name + ': larger than 25 MB'); continue; }
    if (!have.has(e.sha1)){
      const file = await fetch('https://api.box.com/2.0/files/' + e.id + '/content', { headers: h });
      if (!file.ok){ skipped.push(e.name + ': download ' + file.status); continue; }
      await env.TRIVIA_KV.put('renderings:img:' + e.sha1, await file.arrayBuffer(), { metadata: { type: IMAGE_TYPES[ext] } });
      downloaded++;
    }
    manifest.push({ name: e.name, sha1: e.sha1, ext });
  }

  manifest.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  await env.TRIVIA_KV.put('renderings:manifest', JSON.stringify(manifest));
  const keep = new Set(manifest.map(f => f.sha1));
  for (const f of prev) if (!keep.has(f.sha1)) await env.TRIVIA_KV.delete('renderings:img:' + f.sha1);

  return { images: manifest.length, downloaded, removed: prev.filter(f => !keep.has(f.sha1)).length, skipped };
}

/* ---------- serve ---------- */
const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
const notFound = () => new Response('Not found', { status: 404, headers: NOINDEX });

// Handles everything under /r/. Only the exact secret path answers; any other /r/
// URL is a plain 404, the same as a wrong guess anywhere else.
export async function serveRenderings(req, env, matches){
  const url = new URL(req.url);
  const parts = url.pathname.split('/');            // ['', 'r', secret, ...rest]
  if (!matches(parts[2] || '', env.RENDERINGS_PATH)) return notFound();
  const base = '/r/' + parts[2] + '/';

  if (parts.length === 3) return Response.redirect(url.origin + base, 301);

  if (parts.length === 4 && parts[3] === ''){
    const manifest = await env.TRIVIA_KV.get('renderings:manifest', 'json') || [];
    return new Response(galleryHtml(manifest), { headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60', ...NOINDEX } });
  }

  const m = parts.length === 5 && parts[3] === 'img' && parts[4].match(/^([0-9a-f]{40})\.[a-z]+$/);
  if (m){
    const { value, metadata } = await env.TRIVIA_KV.getWithMetadata('renderings:img:' + m[1], 'arrayBuffer');
    if (!value) return notFound();
    return new Response(value, { headers: {
      'Content-Type': metadata?.type || 'application/octet-stream',
      'Cache-Control': 'private, max-age=31536000, immutable', ...NOINDEX } });
  }
  return notFound();
}

/* ---------- page ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const caption = name => name.replace(/\.[a-z0-9]+$/i, '');

function figure(f, lazy){
  const title = esc(caption(f.name));
  return `<figure><div class="frame"><img src="img/${f.sha1}.${f.ext}" alt="Concept rendering: ${title}"${lazy ? ' loading="lazy"' : ''} decoding="async"></div><figcaption>${title}</figcaption></figure>`;
}

const CREST = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="crest" viewBox="0 0 48 56"><path class="crest-fill" d="M3 3h42v29c0 9.5-9.4 14.2-21 21C12.4 46.2 3 41.5 3 32z"/><path class="crest-outline" d="M3 3h42v29c0 9.5-9.4 14.2-21 21C12.4 46.2 3 41.5 3 32z"/><path class="crest-outline" d="M3 15h42" style="stroke-width:1.2;opacity:.55"/><text class="crest-letters" x="24" y="32" font-size="13.5" text-anchor="middle">ΘΔΧ</text><path class="crest-bolt" d="M25.6 36.5l-5.6 7.6h3.4l-.7 5 5.9-7.9h-3.9z"/></symbol></svg>`;

export function galleryHtml(manifest){
  const [first, ...rest] = manifest;
  const body = first
    ? `<div class="lead">${figure(first, false)}</div>` + (rest.length ? `<div class="grid">${rest.map(f => figure(f, true)).join('')}</div>` : '')
    : `<p class="empty">Renderings are on their way.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<title>Renderings — 372 Memorial Drive</title>
<meta name="theme-color" content="#06080d">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%2306080d'/%3E%3Cpath d='M12 12h40v26c0 8-8 12-20 18-12-6-20-10-20-18z' fill='none' stroke='%234c86d9' stroke-width='3'/%3E%3Ctext x='32' y='36' font-family='Georgia,serif' font-size='17' fill='%23f2f5fa' text-anchor='middle'%3E%CE%98%CE%94%CE%A7%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --black:#06080d; --black-2:#0b0f18; --line:#1e2a41; --line-soft:#161f31;
    --blue:#1b4fa0; --blue-bright:#4c86d9; --blue-light:#9fc3f0;
    --white:#f2f5fa; --white-dim:#b7c2d4; --white-faint:#7c8799;
    --serif:'Fraunces', Georgia, serif; --sans:'IBM Plex Sans', system-ui, sans-serif; --mono:'IBM Plex Mono', ui-monospace, monospace;
    --gutter:clamp(18px, 5vw, 40px); --maxw:1120px;
  }
  *{box-sizing:border-box;}
  body{margin:0;background:var(--black);color:var(--white);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden;}
  h1{font-family:var(--serif);font-weight:600;margin:0;letter-spacing:-0.015em;line-height:1.12;font-size:clamp(32px,6.4vw,58px);margin-top:16px;max-width:15em;}
  h1 em{font-style:italic;font-weight:400;color:var(--blue-light);}
  p{margin:0;}
  a{color:var(--blue-bright);text-decoration:none;} a:hover{color:var(--blue-light);}
  :focus-visible{outline:2px solid var(--blue-bright);outline-offset:3px;border-radius:2px;}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 var(--gutter);}
  header{position:sticky;top:0;z-index:50;background:rgba(6,8,13,.82);backdrop-filter:blur(10px);border-bottom:1px solid var(--line-soft);}
  .bar{display:flex;align-items:center;gap:16px;padding-top:12px;padding-bottom:12px;}
  .brand{display:flex;align-items:center;gap:11px;min-width:0;}
  .brand svg{width:26px;height:30px;flex:none;}
  .brand-text{display:flex;flex-direction:column;line-height:1.15;min-width:0;}
  .brand-greek{font-family:var(--serif);font-weight:700;font-size:15px;letter-spacing:.06em;color:var(--white);}
  .brand-sub{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--white-faint);white-space:nowrap;}
  .tag{margin-left:auto;font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--blue-light);padding:6px 10px;border:1px solid var(--line);border-radius:2px;white-space:nowrap;}
  .intro{position:relative;padding:clamp(48px,8vh,88px) 0 clamp(28px,4vh,40px);overflow:hidden;}
  .intro::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(70% 60% at 50% 0%, rgba(27,79,160,.28), transparent 70%);}
  .intro .wrap{position:relative;}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--blue-light);display:flex;align-items:center;gap:9px;}
  .eyebrow::before{content:'';width:22px;height:1px;background:var(--blue);flex:none;}
  .lede{margin-top:16px;max-width:58ch;color:var(--white-dim);font-size:clamp(15px,1.9vw,17px);}
  .gallery{padding-bottom:clamp(64px,10vh,110px);}
  .gallery .wrap{display:flex;flex-direction:column;gap:clamp(20px,3vw,32px);}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:clamp(20px,3vw,32px);}
  figure{margin:0;}
  .frame{border:1px solid var(--line);border-radius:3px;overflow:hidden;background:var(--black-2);}
  .frame img{display:block;width:100%;height:auto;}
  figcaption{margin-top:10px;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--white-faint);}
  .empty{color:var(--white-dim);}
  footer{border-top:1px solid var(--line-soft);padding:34px 0 46px;background:var(--black-2);}
  .foot{display:flex;flex-wrap:wrap;gap:18px 26px;align-items:center;}
  .foot svg{width:24px;height:28px;flex:none;opacity:.85;}
  .foot-text{font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:var(--white-faint);line-height:1.7;}
  .foot a{margin-left:auto;font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--blue-light);}
  .crest-outline{fill:none;stroke:var(--blue-bright);stroke-width:2.4;}
  .crest-fill{fill:rgba(27,79,160,.22);}
  .crest-letters{fill:var(--white);font-family:var(--serif);font-weight:700;}
  .crest-bolt{fill:var(--blue-light);}
</style>
</head>
<body>
${CREST}
<header>
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="Theta Deuteron Charge — home">
      <svg aria-hidden="true"><use href="#crest"></use></svg>
      <span class="brand-text"><span class="brand-greek">ΘΔΧ</span><span class="brand-sub">Theta Deuteron Charge · MIT</span></span>
    </a>
    <span class="tag">Private preview</span>
  </div>
</header>
<main>
  <section class="intro">
    <div class="wrap">
      <span class="eyebrow">Renderings · 372 Memorial Drive</span>
      <h1>The house, <em>re-imagined.</em></h1>
      <p class="lede">Early concept renderings of the renovation. These are directions, not final designs. Please don&rsquo;t share this link beyond the brotherhood.</p>
    </div>
  </section>
  <section class="gallery"><div class="wrap">${body}</div></section>
</main>
<footer>
  <div class="wrap foot">
    <svg aria-hidden="true"><use href="#crest"></use></svg>
    <div class="foot-text">Theta Delta Chi · Theta Deuteron Charge · MIT<br>Concept renderings. Subject to change.</div>
    <a href="/">Back to the site</a>
  </div>
</footer>
</body>
</html>`;
}
