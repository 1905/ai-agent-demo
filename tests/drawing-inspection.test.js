import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingStore } from '../src/drawing-tools.js';
import { toolOutput } from '../src/drawing-canvas.js';
import { highlightJson } from '../src/drawing-log.js';

test('canvas read includes every shape and packages image as image input', () => {
  const store = createDrawingStore();
  for (const x of [120, 320, 520]) store.execute('create_svg', { shape: 'circle', fill: 'red', x, y: 320, width: 80, height: 80 });
  const snapshot = store.execute('read_canvas', {});
  assert.equal(snapshot.shapes.length, 3);
  assert.equal(snapshot.version, 3);
  const imageUrl = 'data:image/png;base64,test-fixture';
  const output = toolOutput({ ...snapshot, imageUrl });
  assert.deepEqual(JSON.parse(output[0].text), snapshot);
  assert.equal(output[1].type, 'input_image');
  assert.equal(output[1].image_url, imageUrl);
  snapshot.shapes[0].fill = 'blue';
  assert.notEqual(store.read().shapes[0].fill, 'blue');
  assert.equal(toolOutput({ error: 'Preview failed' }), '{"error":"Preview failed"}');
});

test('JSON highlighting preserves data and escapes model-controlled HTML', () => {
  const value = { text: '</code><img src=x onerror=alert(1)>', count: 2, ok: true, empty: null };
  const html = highlightJson(value);
  assert.doesNotMatch(html, /<img|<\/code>/);
  for (const type of ['key', 'string', 'number', 'literal']) assert.match(html, new RegExp(`class="json-${type}"`));
  const plain = html.replace(/<\/?span[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.deepEqual(JSON.parse(plain), value);
});
