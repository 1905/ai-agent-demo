import test from 'node:test';
import assert from 'node:assert/strict';
import { simplifyApiEntry } from '../src/log-summary.js';

test('simple API view keeps text and tool meaning while raw entries stay intact', () => {
  const entry = {
    request: { model: 'gpt-5.6-luna', reasoning: { effort: 'medium' }, instructions: 'long system prompt', input: [{ role: 'user', content: 'Draw a circle' }], tools: [{ type: 'function', name: 'create_svg', description: 'long schema description', strict: true, parameters: { type: 'object' } }] },
    response: { output: [{ type: 'reasoning', encrypted_content: 'PRIVATE_REASONING' }, { type: 'function_call', name: 'create_svg', arguments: '{"shape":"circle","fill":"red"}' }], usage: { total_tokens: 10 } },
  };
  const before = structuredClone(entry);
  const simple = simplifyApiEntry(entry);
  assert.deepEqual(simple.request, { text: 'Draw a circle', tools: 'create_svg' });
  assert.deepEqual(simple.response, { call: 'create_svg' });
  assert.doesNotMatch(JSON.stringify(simple), /PRIVATE_REASONING|parameters|strict|long system|total_tokens|medium|luna|red/);
  assert.deepEqual(entry, before);
});

test('simple view shows carried tool results without image payloads and handles failures', () => {
  const simple = simplifyApiEntry({ request: { input: [
    { role: 'user', content: 'Check canvas' },
    { type: 'function_call', name: 'read_canvas', arguments: '{}' },
    { type: 'function_call_output', output: [{ type: 'input_text', text: '{"shapes":[]}' }, { type: 'input_image', image_url: 'data:image/png;base64,PRIVATE_IMAGE' }] },
  ] }, response: { output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Canvas is empty.' }] }] } });
  assert.equal(simple.request.context.length, 3);
  assert.deepEqual(simple.request.context, ['You: Check canvas', 'AI: read_canvas()', 'Tool: Canvas is empty']);
  assert.equal(simple.response.text, 'Canvas is empty.');
  assert.doesNotMatch(JSON.stringify(simple), /PRIVATE_IMAGE/);
  assert.deepEqual(simplifyApiEntry({ request: { input: [] }, response: { error: 'Provider failed' } }).response, { error: 'Provider failed' });
  assert.equal(simplifyApiEntry({ request: { input: [] }, response: null }).response, 'Waiting…');
});

test('Simple hides drawing source and long history; raw entries keep all details', () => {
  const code = 'PRIVATE_CODE_'.repeat(1000);
  const input = [{ role: 'user', content: 'Draw a city' }];
  for (let i = 0; i < 10; i++) input.push(
    { type: 'function_call', name: 'draw_js', arguments: JSON.stringify({ code }) },
    { type: 'function_call_output', output: JSON.stringify({ action: 'drawn', version: i }) },
  );
  input.push({ type: 'function_call_output', output: [{ type: 'input_text', text: JSON.stringify({ artwork: { code }, shapes: [] }) }, { type: 'input_image', image_url: 'PRIVATE_IMAGE' }] });
  const entry = { request: { input }, response: { calls: [{ name: 'draw_svg', arguments: '{"svg":"PRIVATE_SVG"}' }] } };
  const before = structuredClone(entry);
  const simple = simplifyApiEntry(entry);
  assert.equal(simple.request.context.length, 7);
  assert.equal(simple.request.context[0], '… 16 earlier messages');
  assert.equal(simple.request.context.at(-1), 'Tool: Drawing returned');
  assert.deepEqual(simple.response, { call: 'draw_svg' });
  assert.doesNotMatch(JSON.stringify(simple), /PRIVATE_|version|arguments/);
  assert.deepEqual(entry, before);
});

test('Simple makes an empty tool selection explicit', () => {
  for (const selection of [{ tools: [] }, { enabledTools: [] }]) {
    assert.equal(simplifyApiEntry({ request: { input: [{ role: 'user', content: 'Draw' }], ...selection }, response: null }).request.tools, 'None');
  }
});
