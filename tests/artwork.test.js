import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArtworkArgs, artworkTools } from '../src/artwork-tools.js';
import { createDrawingStore, exportDrawing } from '../src/drawing-tools.js';
import { agentTools } from '../src/agent-tools.js';
import { voiceSessionConfig } from '../server/voice-api.js';

test('complete scenes replace basic shapes; source remains readable and reset clears it', () => {
  const store = createDrawingStore();
  store.execute('create_svg', { shape: 'circle', fill: 'red', x: 320, y: 320, width: 220, height: 220 });
  const scene = { type: 'js', code: 'ctx.fillRect(0, 0, width, height);', imageUrl: 'data:image/png;base64,fixture' };
  assert.deepEqual(store.replaceArtwork(scene), { action: 'drawn', format: 'js', version: 2, width: 640, height: 640 });
  scene.code = 'changed outside store';
  assert.deepEqual(store.read().shapes, []);
  const snapshot = store.execute('read_svg', {});
  assert.equal(snapshot.artwork.code, 'ctx.fillRect(0, 0, width, height);');
  snapshot.artwork.code = 'changed copy';
  assert.notEqual(store.read().artwork.code, snapshot.artwork.code);
  store.execute('create_svg', { shape: 'circle', fill: 'blue', x: 100, y: 100, width: 50, height: 50 });
  const exported = exportDrawing(store.read());
  assert.match(exported, /<image.*data:image\/png;base64,fixture/);
  assert.match(exported, /<circle/);
  assert.ok(exported.indexOf('<image') < exported.indexOf('<circle'));
  store.reset();
  assert.deepEqual(store.read(), { width: 640, height: 640, version: 0, shapes: [] });
});

test('SVG export keeps untrusted markup inside image context', () => {
  const store = createDrawingStore();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0L20 20"/></svg>';
  store.replaceArtwork({ type: 'svg', svg, imageUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` });
  assert.equal(store.read().artwork.svg, svg);
  const output = exportDrawing(store.read());
  assert.doesNotMatch(output, /<script|<path|alert/);
  assert.match(output, /<image.*data:image\/svg\+xml;base64,/);
});

test('artwork arguments allow unrestricted drawing source but reject invalid envelopes', () => {
  for (const [name, key] of [['draw_js', 'code'], ['draw_svg', 'svg']]) {
    const source = name === 'draw_js' ? 'for(let i=0;i<500;i++)ctx.fillRect(i,i,2,2);' : '<svg><path fill="rebeccapurple" d="M-10 -10L800 800"/></svg>';
    assert.equal(validateArtworkArgs(name, { [key]: source }), source);
    for (const args of [null, [], {}, { [key]: '' }, { [key]: 123 }, { [key]: source, extra: true }, { [key]: 'x'.repeat(100_001) }]) assert.throws(() => validateArtworkArgs(name, args));
  }
  assert.throws(() => validateArtworkArgs('unknown', { code: 'x' }));
});

test('Chat and Voice expose the same complete-scene tools', () => {
  const voiceTools = voiceSessionConfig({}).delegation.responses.tools;
  for (const tool of artworkTools) {
    assert.equal(agentTools.find(item => item.name === tool.name), tool);
    assert.equal(voiceTools.find(item => item.name === tool.name), tool);
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters.additionalProperties, false);
  }
});
