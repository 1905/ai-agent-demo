import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import { weatherToolResult } from '../src/lesson.js';

test('downloaded lesson stops after the command and sends weather data in a fresh API call', async () => {
  const source = await readFile(new URL('../examples/lesson.mjs', import.meta.url), 'utf8');
  const requests = [], writes = [], messages = [];
  const weatherOutput = [
    { type: 'reasoning', id: 'reasoning_1', summary: [], encrypted_content: 'encrypted-fixture' },
    { type: 'function_call', id: 'fc_weather', call_id: 'weather_1', name: 'get_weather', arguments: '{"city":"Москва"}', status: 'completed' },
  ];
  class MockOpenAI {
    responses = { create: async request => {
      requests.push(request);
      if (requests.length === 1) return { status: 'completed', output: [{ type: 'function_call', call_id: 'draw_1', name: 'draw_circle', arguments: '{"color":"red"}' }] };
      if (requests.length === 2) {
        assert.equal(writes.length, 1, 'drawing finishes before the weather example starts');
        return { status: 'completed', output: weatherOutput };
      }
      assert.equal(requests.length, 3, 'example makes exactly three requests');
      return { status: 'completed', output: [], output_text: 'Да, нужен зонт.' };
    } };
  }
  // Run the exact downloadable source with only its I/O imports substituted.
  const runnable = source.replace(/^import .+;\n/gm, '');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction('OpenAI', 'toResponseInputItems', 'writeFile', 'process', 'console', runnable)(
    MockOpenAI, toResponseInputItems, async (...args) => writes.push(args), { env: {} }, { log: message => messages.push(message) },
  );
  assert.equal(requests.length, 3);
  assert.equal(writes[0][0], 'drawing.svg');
  assert.match(writes[0][1], /<circle.*fill="red"/);
  assert.equal(requests[0].tools[0].name, 'draw_circle');
  assert.equal(requests[1].tools[0].name, 'get_weather');
  assert.deepEqual(requests[2].input.slice(1, -1), toResponseInputItems(weatherOutput));
  assert.equal(requests[2].input.at(-1).call_id, 'weather_1');
  assert.deepEqual(JSON.parse(requests[2].input.at(-1).output), weatherToolResult);
  assert.equal(requests[2].previous_response_id, undefined);
  assert.equal(requests[2].store, false);
  assert.equal(messages.at(-1), 'Да, нужен зонт.');
});
