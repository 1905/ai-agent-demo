import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingStore, exportDrawing, COLORS } from '../src/drawing-tools.js';
import { planDemo } from '../src/drawing-demo.js';

test('red circle -> read -> blue update preserves identity and count', () => {
  const store = createDrawingStore();
  const first = planDemo('Draw a red circle', store.read());
  for (const call of first.calls) store.execute(call.name, call.arguments);
  const red = store.read().shapes[0];
  assert.equal(red.fill, COLORS.red);
  const second = planDemo('No, make it blue', store.read());
  assert.deepEqual(second.calls.map(call => call.name), ['read_canvas', 'update_svg', 'read_canvas']);
  for (const call of second.calls) store.execute(call.name, call.arguments);
  assert.equal(store.read().shapes.length, 1);
  assert.equal(store.read().shapes[0].id, red.id);
  assert.equal(store.read().shapes[0].fill, COLORS.blue);
  assert.match(exportDrawing(store.read()), /<circle/);
});

test('invalid updates never corrupt the drawing', () => {
  const store = createDrawingStore();
  store.execute('create_svg', { shape: 'circle', fill: 'red', x: 320, y: 320, width: 220, height: 220 });
  const original = store.read();
  for (const args of [{ id: 'missing', fill: 'blue' }, { id: 'shape-1', fill: 'url(javascript:alert(1))' }, { id: 'shape-1', x: -100 }, { id: 'shape-1', width: 300 }, { id: 'shape-1', onclick: 'alert(1)' }]) {
    assert.throws(() => store.execute('update_svg', args));
    assert.deepEqual(store.read(), original);
  }
});

test('read returns a copy; unsupported tools and markup are rejected', () => {
  const store = createDrawingStore();
  assert.throws(() => store.execute('eval', {}));
  assert.throws(() => store.execute('create_svg', { shape: '<script>', fill: 'red', x: 320, y: 320, width: 50, height: 50 }));
  const read = store.execute('read_svg', {}); read.shapes.push({ id: 'bad' });
  assert.equal(store.read().shapes.length, 0);
  assert.equal(planDemo('make it blue', store.read()).calls.length, 0);
});
