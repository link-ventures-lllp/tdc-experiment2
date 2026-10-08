import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { nowET, toISO, parseWorkbook, withChoices, questionText, answerText } from '../src/trivia.js';

function workbook(rows){
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

test('dates: serial numbers, ISO text and US text all land on the same day', () => {
  assert.equal(toISO(46304), '2026-10-09');        // Excel serial for 2026-10-09
  assert.equal(toISO('2026-10-09'), '2026-10-09');
  assert.equal(toISO('10/9/2026'), '2026-10-09');
  assert.equal(toISO(''), '');
});

test('parse: loose headers, real date cells, skips and duplicates', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Publish Date', 'Question', 'Correct_Answer', 'wrong answer 1', 'Wrong Answer 2', 'WRONG_ANSWER_3'],
    [new Date(2026, 9, 9), 'What year?', '1966', '1958', '1972', '1981'],
    ['2026-10-10', 'Which river?', 'Charles', 'Mystic', 'Neponset', 'Merrimack'],
    ['2026-10-10', 'Duplicate', 'a', 'b', 'c', 'd'],
    ['2026-10-11', 'No wrongs', 'x', '', '', ''],
    ['', '', '', '', '', ''],
    ['', 'Orphan question', 'a', 'b', 'c', 'd']
  ], { cellDates: true });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'S');
  const { schedule, skipped, rows } = parseWorkbook(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
  assert.equal(rows, 2);
  assert.deepEqual(Object.keys(schedule).sort(), ['2026-10-09', '2026-10-10']);
  assert.equal(schedule['2026-10-10'].q, 'Which river?');
  assert.deepEqual(schedule['2026-10-09'].wrong, ['1958', '1972', '1981']);
  assert.equal(skipped.length, 3);
  assert.match(skipped[0], /row 4 .*duplicate/);
  assert.match(skipped[1], /row 5 .*missing/);
  assert.match(skipped[2], /row 7: no publish_date/);
});

test('choices: stable per date, correctIndex points at the right answer', () => {
  const item = { q: 'What year?', correct: '1966', wrong: ['1958', '1972', '1981'] };
  const a = withChoices('2026-10-09', item), b = withChoices('2026-10-09', item);
  assert.deepEqual(a, b);
  assert.equal(a.choices[a.correctIndex], '1966');
  assert.equal(new Set(a.choices).size, 4);
});

test('messages', () => {
  const item = { question: 'Q?', choices: ['w', 'right', 'x', 'y'], correctIndex: 1 };
  const q = questionText('2026-10-09', item);
  assert.match(q, /Fri, Oct 9/);
  assert.match(q, /B\. right/);
  assert.doesNotMatch(q, /Answer:/);
  assert.match(answerText('2026-10-09', item, 'https://tdcreboot.com/#trivia'), /Answer: \*B\. right\*\n\nNew question tomorrow at 7 a\.m\.\nhttps:/);
});

test('clock: Eastern time across DST', () => {
  assert.deepEqual(nowET(new Date('2026-10-09T11:00:00Z')), { date: '2026-10-09', minutes: 7 * 60 });  // EDT
  assert.deepEqual(nowET(new Date('2026-12-09T12:00:00Z')), { date: '2026-12-09', minutes: 7 * 60 });  // EST
  assert.deepEqual(nowET(new Date('2026-10-10T03:59:00Z')), { date: '2026-10-09', minutes: 23 * 60 + 59 });
});
