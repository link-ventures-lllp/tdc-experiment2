const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const script = '/*' + html.split('/* ========================= DAILY TRIVIA =========================')[1]
  .split('/* ========================= INTEREST FORM =========================')[0];

async function renderTrivia(search, response) {
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
    location: { search }, URLSearchParams,
    fetch: async () => { fetches++; return { ok: true, json: async () => response }; },
    setTimeout: (_fn, ms) => timers.push(ms)
  });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, timers, fetches };
}

const sample = { live: true, question: 'Question?', choices: ['A', 'B', 'C', 'D'], correctIndex: 1 };
const posted = 'Answer posted. Stay tuned for the next trivia question.';
const voting = 'Vote in today’s poll in the brotherhood WhatsApp group. The answer goes up there and here at 8 p.m. Eastern.';

for (const [name, search] of [['normal API', ''], ['existing revealed demo', '?trivia=revealed']]) {
  test(`${name}: post-reveal copy and correct answer are preserved`, async () => {
    const { elements, timers, fetches } = await renderTrivia(search, sample);
    assert.equal(elements.get('triviaStatus').textContent, posted);
    assert.equal(elements.get('trivia').hidden, false);
    assert.equal(elements.get('trivia').toggles['is-revealed'], true);
    assert.deepEqual(Array.from(elements.get('triviaChoices').children, e => e.toggles['is-correct']), [false, true, false, false]);
    assert.equal(elements.get('triviaCtaLabel').textContent, 'See it in WhatsApp');
    assert.equal(fetches, search ? 0 : 1);
    assert.equal(timers.length, 0);
  });
}

test('pre-reveal copy, answer withholding and recheck interval are unchanged', async () => {
  const { correctIndex, ...unrevealed } = sample;
  const { elements, timers } = await renderTrivia('', unrevealed);
  assert.equal(elements.get('triviaStatus').textContent, voting);
  assert.equal(elements.get('trivia').toggles['is-revealed'], false);
  assert.ok(elements.get('triviaChoices').children.every(e => !e.toggles['is-correct']));
  assert.equal(elements.get('triviaCtaLabel').textContent, 'Vote in WhatsApp');
  assert.deepEqual(timers, [5 * 60 * 1000]);
});

test('existing live demo bypasses API and remains unrevealed', async () => {
  const { elements, fetches } = await renderTrivia('?trivia=live');
  assert.equal(elements.get('triviaStatus').textContent, voting);
  assert.equal(elements.get('trivia').toggles['is-revealed'], false);
  assert.equal(fetches, 0);
});

test('inactive API round stays hidden', async () => {
  const { elements } = await renderTrivia('', { live: false });
  assert.equal(elements.get('trivia').hidden, true);
});
