import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drawingApi } from '../server/drawing-api.js';
import { readDrawingResponse } from '../src/drawing-stream.js';

async function serverFor(t, create, env = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'drawing-api-test-'));
  const handler = drawingApi({ OPENAI_API_KEY: 'test-only-placeholder', DRAW_LOG_DIR: directory, ...env }, { client: { responses: { create } } });
  let requests = 0;
  const server = createServer((req, res) => { requests++; return handler(req, res, () => { res.statusCode = 404; res.end(); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    // Responses finish before their async metadata writes; do not delete the log directory early.
    let records = 0;
    for (let i = 0; i < 100 && records < requests; i++) {
      try { records = (await readFile(join(directory, 'draw-api.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).length; } catch {}
      if (records < requests) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(records, requests, 'every request persisted metadata before cleanup');
    await rm(directory, { recursive: true, force: true });
  });
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
  assert.equal(sent.model, 'gpt-5.6-terra');
  assert.deepEqual(sent.reasoning, { effort: 'medium' });
  assert.deepEqual(sent.tools.map(tool => tool.name), ['draw_js', 'draw_svg', 'update_svg', 'read_site_css', 'edit_site_css', 'replace_site_css', 'reset_site_css']);
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
  assert.equal(record.model, 'gpt-5.6-terra');
  assert.equal(record.reasoning_effort, 'medium');
  assert.equal(record.provider_response_id, 'response_1');
  assert.equal(typeof record.duration_ms, 'number');
  assert.doesNotMatch(log, /private drawing instruction|test-only-placeholder/);
});

test('thinking model selection reaches the provider and invalid choices are rejected', async t => {
  const sent = [];
  const { url } = await serverFor(t, async request => {
    sent.push(request);
    return { id: 'selection_test', status: 'completed', output: [], output_text: 'Done.' };
  });
  for (const model of ['gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol', 'not-allowed', null]) {
    const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', body: JSON.stringify({ model, reasoningEffort: 'high', input: [{ role: 'user', content: 'Draw' }] }) });
    assert.equal(response.status, ['gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol'].includes(model) ? 200 : 400);
  }
  for (const reasoningEffort of ['invalid', null, 3]) {
    const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', body: JSON.stringify({ reasoningEffort, input: [{ role: 'user', content: 'Draw' }] }) });
    assert.equal(response.status, 400);
  }
  assert.deepEqual(sent.map(request => request.model), ['gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol']);
  assert.ok(sent.every(request => request.reasoning.effort === 'high'));
  const status = await fetch(`${url}/api/draw/status`).then(response => response.json());
  assert.equal(status.model, 'gpt-5.6-terra');
  assert.equal(status.voiceModel, 'gpt-5.6-terra');
});

test('tool selection reaches the provider, including zero tools, without accepting tool schemas', async t => {
  const sent = [];
  const { url } = await serverFor(t, async request => {
    sent.push(request);
    return { id: 'tools_test', status: 'completed', output: [], output_text: 'Text only.' };
  });
  for (const enabledTools of [[], ['draw_js'], ['update_svg', 'draw_svg'], ['end_conversation']]) {
    const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', body: JSON.stringify({ enabledTools, input: [{ role: 'user', content: 'Draw a city' }] }) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.trace.request.tools.map(tool => tool.name).sort(), enabledTools.filter(name => name !== 'end_conversation').sort());
  }
  assert.match(sent[0].instructions, /No tools are available/);
  assert.doesNotMatch(sent[0].instructions, /Use create_svg/);
  assert.equal(sent[1].tools[0].strict, true);
  assert.match(sent[1].instructions, /Available tools: draw_js/);
  for (const enabledTools of [null, 'all', ['unknown'], ['draw_js', 'draw_js'], [{ name: 'draw_js', parameters: {} }]]) {
    const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', body: JSON.stringify({ enabledTools, input: [{ role: 'user', content: 'Draw' }] }) });
    assert.equal(response.status, 400);
  }
  assert.equal(sent.length, 4);
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

test('streaming announces the tool before generation finishes and preserves full response context', { timeout: 5000 }, async t => {
  let release, finished = false, requested;
  const gate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  const call = { type: 'function_call', id: 'fc_stream', call_id: 'stream_1', name: 'draw_svg', arguments: '{"svg":"<svg/>"}', status: 'completed' };
  const final = { id: 'response_stream', status: 'completed', output: [call], usage: { total_tokens: 200 } };
  const { url } = await serverFor(t, request => {
    requested = request;
    return (async function* () {
      yield { type: 'response.output_item.added', item: { ...call, arguments: '' } };
      await gate;
      finished = true;
      yield { type: 'response.completed', response: final };
    })();
  });
  const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', headers: { Accept: 'application/x-ndjson' }, body: JSON.stringify({ input: [{ role: 'user', content: 'Draw' }], enabledTools: ['draw_svg'] }) });
  let progress = 0, sentRequest = false;
  const data = await readDrawingResponse(response, event => {
    assert.equal(finished, false);
    if (event.type === 'request.sent') {
      assert.deepEqual(event.request, requested);
      assert.equal(event.request.input[0].content, 'Draw');
      assert.deepEqual(event.request.tools.map(tool => tool.name), ['draw_svg']);
      sentRequest = true;
      return;
    }
    assert.equal(sentRequest, true);
    assert.deepEqual(event, { type: 'tool.started', call: { call_id: 'stream_1', name: 'draw_svg' } });
    progress++; release();
  });
  assert.equal(progress, 1);
  assert.equal(requested.stream, true);
  assert.deepEqual(data.trace.response, final);
  assert.deepEqual(data.trace.request, requested);
  assert.equal(data.inputItems[0].arguments, call.arguments);
});

test('stream failures remain errors after HTTP headers and persist an error outcome', async t => {
  const { url, directory } = await serverFor(t, () => (async function* () {
    yield { type: 'response.output_item.added', item: { type: 'function_call', name: 'draw_svg', call_id: 'broken' } };
    throw new Error('private upstream failure');
  })());
  const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', headers: { Accept: 'application/x-ndjson' }, body: JSON.stringify({ input: [{ role: 'user', content: 'Draw' }] }) });
  await assert.rejects(readDrawingResponse(response), /model request failed/);
  let log;
  for (let i = 0; i < 30; i++) {
    try { log = JSON.parse((await readFile(join(directory, 'draw-api.jsonl'), 'utf8')).trim()); break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(log.status, 502);
  assert.equal(log.outcome, 'error');
  assert.doesNotMatch(JSON.stringify(log), /private upstream failure/);
});

test('disconnecting the client aborts the provider stream', { timeout: 5000 }, async t => {
  let aborted;
  const cancellation = new Promise(resolve => { aborted = resolve; });
  const { url } = await serverFor(t, (_request, { signal }) => (async function* () {
    yield { type: 'response.output_item.added', item: { type: 'function_call', name: 'draw_svg', call_id: 'cancel' } };
    await new Promise(resolve => { signal.addEventListener('abort', () => { aborted(); resolve(); }, { once: true }); });
    throw new Error('cancelled');
  })());
  const control = new AbortController();
  const response = await fetch(`${url}/api/draw/turn`, { method: 'POST', signal: control.signal, headers: { Accept: 'application/x-ndjson' }, body: JSON.stringify({ input: [{ role: 'user', content: 'Draw' }] }) });
  const reader = response.body.getReader();
  await reader.read(); control.abort();
  await cancellation;
  await reader.cancel().catch(() => {});
});
