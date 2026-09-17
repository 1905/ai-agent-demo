import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonFlow, lessonExample } from '../src/lesson.js';
import { createDrawingStore, COLORS } from '../src/drawing-tools.js';

test('drawing lesson carries the question, tool call and matching result into a new stateless request', () => {
  const { request, call, result, followup } = createLessonFlow();
  assert.equal(request.input[0].content, lessonExample.drawRequest);
  assert.deepEqual(followup.input.slice(0, 2), [...request.input, call]);
  assert.equal(followup.input[2].call_id, call.call_id);
  assert.deepEqual(JSON.parse(followup.input[2].output), result);
  assert.equal(result.shape.fill, COLORS.red);
  assert.deepEqual(followup.tools, request.tools);
  assert.equal(followup.store, false);
  assert.equal(followup.previous_response_id, undefined);
});

test('the correction changes the same circle from red to blue', () => {
  const { call } = createLessonFlow();
  const store = createDrawingStore();
  const { shape } = store.execute(call.name, JSON.parse(call.arguments));
  store.execute('update_svg', { id: shape.id, fill: 'blue' });
  assert.equal(store.read().shapes.length, 1);
  assert.deepEqual(store.read().shapes[0], { ...shape, fill: COLORS.blue });
});
