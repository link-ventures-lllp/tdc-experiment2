const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const script = '/*' + html.split('/* ========================= DAILY TRIVIA =========================')[1]
  .split('/* ========================= INTEREST FORM =========================')[0];

async function renderTrivia(search, response, hostname = 'tdcreboot.com') {
  const elements = new Map();
  const element = () => ({
    hidden: true, textContent: '', dataset: {}, toggles: {},
    classList: { toggle(name, value) { this.owner.toggles[name] = value; } },
    replaceChildren(...children) { this.children = children; }
  });
  const makeElement = () => { const e = element(); e.classList.owner = e; return e; };
  const timers = [];
  let fetches = 0;
  vm.runInNewContext(script, {
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, makeElement()); return elements.get(id); },
      createElement: makeElement
    },
    TRIVIA_API: 'https://example.invalid/api/trivia', WHATSAPP_URL: 'https://example.invalid/group',
    location: { search, hostname }, URLSearchParams,
    fetch: async () => { fetches++; return { ok: true, json: async () => response }; },
    setTimeout: (_fn, ms) => timers.push(ms)
  });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, timers, fetches };
}

const sample = { live: true, question: 'Unrelated next-day round', choices: ['A', 'B', 'C', 'D'], correctIndex: 0 };
const posted = 'Stay tuned for the next trivia question.';
const voting = 'Vote in today’s poll in the brotherhood WhatsApp group. The answer goes up there and here at 8 p.m. Eastern.';

for (const nextRound of [sample, { live: false }, undefined]) {
  test(`normal site stays pinned regardless of shared API state ${JSON.stringify(nextRound)}`, async () => {
    const { elements, timers, fetches } = await renderTrivia('', nextRound);
    assert.equal(elements.get('triviaStatus').textContent, voting);
    assert.equal(elements.get('triviaDate').textContent, 'Tue, Oct 27');
    assert.equal(elements.get('triviaQ').textContent, "What architectural boast appears in the house section of the 1990s books?");
    assert.deepEqual(Array.from(elements.get('triviaChoices').children, e => e.textContent), ["The only fraternity with a moat", "The only fraternity with an elevator", "The only fraternity with windows on all four sides", "The tallest fraternity on Memorial Drive"]);
    assert.deepEqual(Array.from(elements.get('triviaChoices').children, e => e.toggles['is-correct']), [false, false, false, false]);
    assert.equal(elements.get('trivia').hidden, false);
    assert.equal(elements.get('trivia').toggles['is-revealed'], false);
    assert.equal(elements.get('triviaCtaLabel').textContent, 'Vote in WhatsApp');
    assert.equal(fetches, 0);
    assert.equal(timers.length, 0);
  });
}

test('existing revealed demo remains explicitly labeled Sample', async () => {
  const { elements, fetches, timers } = await renderTrivia('?trivia=revealed');
  assert.equal(elements.get('triviaDate').textContent, 'Sample');
  assert.equal(elements.get('triviaStatus').textContent, posted);
  assert.deepEqual(Array.from(elements.get('triviaChoices').children, e => e.toggles['is-correct']), [false, true, false, false]);
  assert.equal(fetches, 0);
  assert.equal(timers.length, 0);
});

test('existing live demo remains Sample and withholds answer highlight', async () => {
  const { elements, fetches } = await renderTrivia('?trivia=live');
  assert.equal(elements.get('triviaDate').textContent, 'Sample');
  assert.equal(elements.get('triviaStatus').textContent, voting);
  assert.equal(elements.get('trivia').toggles['is-revealed'], false);
  assert.ok(elements.get('triviaChoices').children.every(e => !e.toggles['is-correct']));
  assert.equal(fetches, 0);
});

test('October 27 question payload has no key; preview simulation is hostname gated, not timed', () => {
  const payload = JSON.parse(html.match(/const questionRound = (\{[\s\S]*?\});/)[1]);
  assert.equal(payload.date, '2026-10-27');
  assert.deepEqual(Object.keys(payload).sort(), ['choices', 'date', 'dateLabel', 'live', 'question']);
  assert.ok(!('correctIndex' in payload));
  assert.ok(!html.includes('const answeredRound'));
  assert.ok(html.includes("location.hostname === 'preview-tdcreboot.link-ventures.workers.dev'"));
  assert.ok(html.includes('Trivia Tuesdays — New question at 7 a.m. Eastern. Answer at 8 p.m.'));
});

test('preview shows the source-verified October 27 answer with intended cutoff label', async () => {
  const { elements, fetches, timers } = await renderTrivia('', undefined, 'preview-tdcreboot.link-ventures.workers.dev');
  assert.equal(elements.get('triviaDate').textContent, 'Simulated preview — Tue, Oct 27, 8 p.m. Eastern (Oct 28, 00:00 UTC)');
  assert.equal(elements.get('trivia').toggles['is-revealed'], true);
  assert.deepEqual(Array.from(elements.get('triviaChoices').children, e => e.toggles['is-correct']), [false, false, true, false]);
  assert.equal(elements.get('triviaStatus').textContent, posted);
  assert.equal(elements.get('triviaCtaLabel').textContent, 'See it in WhatsApp');
  assert.equal(fetches, 0);
  assert.equal(timers.length, 0);
});

test('an unrelated hostname never activates the preview reveal', async () => {
  const { elements, timers } = await renderTrivia('', undefined, 'unrelated.example');
  assert.equal(elements.get('trivia').toggles['is-revealed'], false);
  assert.ok(elements.get('triviaChoices').children.every(e => !e.toggles['is-correct']));
  assert.equal(timers.length, 0);
});
