import test from 'node:test';
import assert from 'node:assert/strict';
import { readDrawingResponse } from '../src/drawing-stream.js';

function streamed(chunks) {
  return new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } }), { headers: { 'content-type': 'application/x-ndjson' } });
}
const encode = text => new TextEncoder().encode(text);

test('stream parser handles arbitrary chunk boundaries, UTF-8 and final trace without a newline', async () => {
  const data = { calls: [], text: 'Круг 🔵', trace: { request: { stream: true }, response: { output: [] } } };
  const bytes = encode(JSON.stringify({ type: 'tool.started', call: { name: 'draw_svg', call_id: '1' } }) + '\n' + JSON.stringify({ type: 'complete', data }));
  const progress = [];
  assert.deepEqual(await readDrawingResponse(streamed([...bytes].map(byte => Uint8Array.of(byte))), event => progress.push(event)), data);
  assert.equal(progress.length, 1);
  assert.equal(progress[0].call.name, 'draw_svg');
});

test('stream parser rejects provider errors and truncated completion; JSON fallback remains supported', async () => {
  await assert.rejects(readDrawingResponse(streamed([encode('{"type":"tool.started","call":{}}\n')])), /before its response was complete/);
  await assert.rejects(readDrawingResponse(streamed([encode('{"type":"error","data":{"error":"Quota exhausted"}}\n')])), /Quota exhausted/);
  const data = { calls: [], text: 'Text only' };
  assert.deepEqual(await readDrawingResponse(Response.json(data)), data);
});
