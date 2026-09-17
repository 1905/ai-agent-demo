import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { attachVoiceApi, voiceSessionConfig } from '../server/voice-api.js';
import { agentTools } from '../src/agent-tools.js';

async function until(check) {
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) { const value = check(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 5)); }
  throw new Error('Expected voice event did not arrive.');
}
async function setup(t, provider, env = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'agent-voice-test-'));
  const upstream = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(upstream, 'listening');
  const sent = [];
  upstream.on('connection', socket => socket.on('message', bytes => {
    const event = JSON.parse(bytes.toString()); sent.push(event);
    provider(socket, event);
  }));
  const server = createServer((req, res) => res.end());
  const dispose = attachVoiceApi(server, { OPENAI_API_KEY: 'voice-test-secret', DRAW_LOG_DIR: directory, ...env }, { upstreamUrl: `ws://127.0.0.1:${upstream.address().port}`, timeoutMs: 100 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const host = `127.0.0.1:${server.address().port}`;
  const received = [], client = new WebSocket(`ws://${host}/api/voice`, { origin: `http://${host}` });
  client.on('message', bytes => received.push(JSON.parse(bytes.toString())));
  client.on('error', () => {});
  await once(client, 'open');
  t.after(async () => {
    client.terminate();
    for (const socket of upstream.clients) socket.terminate();
    await new Promise(resolve => setTimeout(resolve, 20));
    await dispose();
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => upstream.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { client, sent, received, directory, host };
}
const send = (socket, value) => socket.send(JSON.stringify(value));
const startProvider = socket => send(socket, { type: 'session.started', session: { id: 'live_test' } });

test('voice defaults to Terra with server-owned speech and tools; image outputs continue the delegation', async t => {
  const { client, sent, received, directory } = await setup(t, (socket, event) => {
    if (event.type === 'session.start') startProvider(socket);
    if (event.type === 'session.input_audio.append') {
      send(socket, { type: 'response.event', delegation_id: 'delegation_1', event: { type: 'response.created', response: { id: 'response_1', model: 'gpt-5.6-terra' } } });
      for (const type of ['response.output_item.added', 'response.output_item.done']) send(socket, { type: 'response.event', event: { type, item: { type: 'function_call', name: 'read_canvas', call_id: 'call_1', arguments: '{}' } } });
    }
    if (event.type === 'response.create') send(socket, { type: 'response.event', delegation_id: 'delegation_1', event: { type: 'response.completed', response: { id: 'response_1', model: 'gpt-5.6-terra', usage: { total_tokens: 42 } } } });
    if (event.type === 'session.close') send(socket, { type: 'session.closed', usage: { seconds: 3 } });
  });
  send(client, { type: 'session.start', session: { model: 'client-override', instructions: 'private client text', delegation: { responses: { tools: [] } } } });
  await until(() => received.find(event => event.type === 'session.started'));
  const configuration = sent.find(event => event.type === 'session.start').session;
  assert.deepEqual(configuration, voiceSessionConfig({}));
  assert.equal(configuration.delegation.responses.model, 'gpt-5.6-terra');
  assert.deepEqual(configuration.delegation.responses.tools.slice(0, -1), agentTools);
  assert.equal(configuration.delegation.responses.parallel_tool_calls, false);
  send(client, { type: 'session.update', session: { delegation: { responses: { model: 'override' } } } });
  send(client, { type: 'session.input_audio.append', audio: 'AAAA' });
  await until(() => received.find(event => event.event?.type === 'response.output_item.done'));
  const output = [{ type: 'input_text', text: 'private canvas data' }, { type: 'input_image', image_url: 'data:image/png;base64,fixture', detail: 'high' }];
  send(client, { type: 'tool.result', call_id: 'call_1', output });
  await until(() => sent.find(event => event.type === 'response.create'));
  assert.deepEqual(sent.find(event => event.type === 'response.item.create').item.output, output);
  assert.equal(sent.filter(event => event.type === 'response.create').length, 1);
  assert.equal(sent.some(event => event.type === 'session.update'), false);
  send(client, { type: 'session.close' });
  await until(() => received.find(event => event.type === 'voice.ended'));
  assert.equal(received.find(event => event.type === 'voice.ended').finalized, true);
  let records;
  for (let i = 0; i < 50; i++) {
    const text = await readFile(join(directory, 'voice-api.jsonl'), 'utf8');
    records = text.trim().split('\n').map(JSON.parse);
    if (records.some(record => record.event === 'session.finished')) {
      assert.doesNotMatch(text, /private client text|private canvas data|voice-test-secret|base64/);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(records.find(record => record.event === 'session.finished').usage.seconds, 3);
  assert.equal(records.find(record => record.event === 'response.completed').usage.total_tokens, 42);
  assert.equal(records.find(record => record.event === 'response.completed').model, 'gpt-5.6-terra');
  assert.equal(records.find(record => record.event === 'response.completed').cost_usd, null);
});

test('voice allows a thinking model choice only at session start', async t => {
  const { client, sent, received } = await setup(t, (socket, event) => {
    if (event.type === 'session.start') startProvider(socket);
    if (event.type === 'session.close') send(socket, { type: 'session.closed' });
  });
  send(client, { type: 'session.start', model: 'gpt-6-astra', session: { model: 'override', instructions: 'override' } });
  await until(() => received.find(event => event.type === 'session.started'));
  const config = sent[0].session;
  assert.equal(config.delegation.responses.model, 'gpt-6-astra');
  assert.equal(config.model, 'gpt-live-1');
  assert.deepEqual(config.delegation.responses.tools.slice(0, -1), agentTools);
  send(client, { type: 'session.start', model: 'gpt-5.6-terra' });
  send(client, { type: 'session.close' });
  await until(() => received.find(event => event.type === 'voice.ended'));
  assert.equal(sent.filter(event => event.type === 'session.start').length, 1);
});

test('invalid voice thinking model never opens a provider connection', async t => {
  const { client, sent, received } = await setup(t, () => assert.fail('Provider must not receive a request'));
  send(client, { type: 'session.start', model: 'not-allowed' });
  await until(() => received.find(event => event.type === 'voice.ended'));
  assert.match(received.find(event => event.type === 'error').error.message, /Settings/);
  assert.equal(sent.length, 0);
});

test('stop waits for final usage but closes on a provider timeout', async t => {
  const { client, sent, received } = await setup(t, (socket, event) => { if (event.type === 'session.start') startProvider(socket); });
  send(client, { type: 'session.start' });
  await until(() => received.find(event => event.type === 'session.started'));
  send(client, { type: 'session.close' });
  send(client, { type: 'session.input_audio.append', audio: 'AAAA' });
  await until(() => received.find(event => event.type === 'voice.ended'));
  assert.equal(received.find(event => event.type === 'voice.ended').finalized, false);
  assert.equal(sent.filter(event => event.type === 'session.close').length, 1);
  assert.equal(sent.some(event => event.type === 'session.input_audio.append'), false);
});

test('unrequested tool results are rejected without reaching the provider', async t => {
  const { client, sent, received } = await setup(t, (socket, event) => {
    if (event.type === 'session.start') startProvider(socket);
    if (event.type === 'session.close') send(socket, { type: 'session.closed', usage: { seconds: 1 } });
  });
  send(client, { type: 'session.start' });
  await until(() => received.find(event => event.type === 'session.started'));
  send(client, { type: 'tool.result', call_id: 'invented', output: 'pretend success' });
  await until(() => received.find(event => event.type === 'error'));
  assert.equal(sent.some(event => event.type === 'response.item.create'), false);
  const denied = new WebSocket(`ws://${'127.0.0.1'}:${new URL(client.url).port}/api/voice`, { origin: 'https://unrelated.example' });
  denied.on('error', () => {});
  const [, response] = await once(denied, 'unexpected-response');
  assert.equal(response.statusCode, 403);
  response.resume(); denied.terminate();
});
