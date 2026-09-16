import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drawingApi } from '../server/drawing-api.js';

async function serverFor(t, create, env = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'drawing-api-test-'));
  const handler = drawingApi({ OPENAI_API_KEY: 'test-only-placeholder', DRAW_LOG_DIR: directory, ...env }, { client: { responses: { create } } });
  const server = createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  return { url: `http://127.0.0.1:${server.address().port}`, directory };
}

test('live endpoint preserves model calls and records usage without content or secrets', async t => {
  let sent;
  const call = { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'read_svg', arguments: '{}', status: 'completed' };
  const { url, directory } = await serverFor(t, async args => {
    sent = args;
    return { id: 'response_1', status: 'completed', output: [call], output_text: '', usage: { input_tokens: 120, output_tokens: 20, total_tokens: 140 } };
  });
  const input = [{ role: 'user', content: 'private drawing instruction' }];
  const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.calls[0].call_id, 'call_1');
  assert.equal(data.inputItems[0].call_id, 'call_1');
  assert.deepEqual(sent.input, input);
  assert.equal(sent.store, false);
  assert.deepEqual(sent.tools.map(tool => tool.name), ['read_canvas', 'read_svg', 'create_svg', 'update_svg']);
  assert.deepEqual(data.trace.request, sent);
  assert.equal(data.trace.response.id, 'response_1');
  assert.doesNotMatch(JSON.stringify(data.trace), /test-only-placeholder/);
  let log;
  for (let i = 0; i < 30; i++) {
    try { log = await readFile(join(directory, 'draw-api.jsonl'), 'utf8'); if (log.trim()) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const record = JSON.parse(log.trim());
  assert.equal(record.usage.total_tokens, 140);
  assert.equal(record.cost_usd, null);
  assert.equal(record.provider_response_id, 'response_1');
  assert.equal(typeof record.duration_ms, 'number');
  assert.doesNotMatch(log, /private drawing instruction|test-only-placeholder/);
});

test('model message text is preserved without the SDK output_text convenience field', async t => {
  const { url } = await serverFor(t, async () => ({ id: 'response_text', status: 'completed', output: [{ type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'The circle is blue.', annotations: [] }] }] }));
  const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', body: JSON.stringify({ input: [{ role: 'user', content: 'Make it blue' }] }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, 'The circle is blue.');
});

test('provider failure is visible and is not silently replaced by a demo response', async t => {
  const { url } = await serverFor(t, async () => { throw Object.assign(new Error('private provider details'), { status: 429 }); });
  const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', body: JSON.stringify({ input: [{ role: 'user', content: 'Draw a red circle' }] }) });
  assert.equal(response.status, 429);
  const data = await response.json();
  assert.match(data.error, /rate or usage limit/);
  assert.doesNotMatch(JSON.stringify(data), /private provider details/);
});

test('exhausted quota tells the user to fix billing instead of retrying', async t => {
  for (const code of ['insufficient_quota', 'credit_balance_exhausted', 'project_spend_limit_exceeded']) {
    const { url } = await serverFor(t, async () => { throw Object.assign(new Error('provider details'), { status: 429, code }); });
    const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', body: JSON.stringify({ input: [{ role: 'user', content: 'Draw a red circle' }] }) });
    const body = await response.json();
    assert.equal(response.status, 429);
    assert.equal(body.code, code);
    assert.match(body.error, /credits|billing|spending limit/);
    assert.doesNotMatch(body.error, /Try again later/);
  }
});

test('unconfigured key, malformed origin, and invalid input do not call the provider', async t => {
  let calls = 0;
  const { url } = await serverFor(t, async () => { calls++; });
  for (const origin of ['not-a-url', 'https://unrelated.example']) {
    const result = await fetch(`${url}/api/draw/turn`, { method: 'POST', headers: { Origin: origin }, body: '{}' });
    assert.equal(result.status, 403);
  }
  const invalid = await fetch(`${url}/api/draw/turn`, { method: 'POST', body: '{' });
  assert.equal(invalid.status, 400);
  const missing = await fetch(`${url}/api/draw/turn`, { method: 'POST', body: '{}' });
  assert.equal(missing.status, 400);
  assert.equal(calls, 0);
  const noKey = await serverFor(t, async () => { calls++; }, { OPENAI_API_KEY: '' });
  assert.equal((await fetch(`${noKey.url}/api/draw/status`).then(res => res.json())).configured, false);
  assert.equal((await fetch(`${noKey.url}/api/draw/turn`, { method: 'POST', body: '{}' })).status, 503);
  assert.equal(calls, 0);
});
