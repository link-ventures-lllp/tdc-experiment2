import { test } from 'node:test';
import assert from 'node:assert/strict';
import { galleryHtml } from '../src/renderings.js';

test('gallery: first image leads, captions from filenames, names escaped', () => {
  const html = galleryHtml([
    { name: 'Dining Room.png', sha1: 'a'.repeat(40), ext: 'png' },
    { name: 'Pub <script>.png', sha1: 'b'.repeat(40), ext: 'png' }
  ]);
  assert.match(html, /<div class="lead"><figure>.*img\/a{40}\.png.*Dining Room<\/figcaption>/s);
  assert.match(html, /Pub &lt;script&gt;/);
  assert.doesNotMatch(html, /Pub <script>/);
  assert.match(html, /noindex/);
});

test('gallery: empty folder shows a placeholder line', () => {
  assert.match(galleryHtml([]), /Renderings are on their way/);
});
