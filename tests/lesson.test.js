import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonFlow, lessonExample, weatherToolResult } from '../src/lesson.js';
import { COLORS } from '../src/drawing-tools.js';

test('weather lesson carries the question, tool call and matching data into a new stateless request', () => {
  const { request, call, result, followup } = createLessonFlow();
  assert.equal(request.input[0].content, lessonExample.weatherRequest);
  assert.deepEqual(followup.input.slice(0, 2), [...request.input, call]);
  assert.equal(followup.input[2].call_id, call.call_id);
  assert.deepEqual(JSON.parse(followup.input[2].output), result);
  assert.equal(call.name, 'get_weather');
  assert.deepEqual(result, weatherToolResult);
  assert.equal(result.condition, 'moderate rain');
  assert.doesNotMatch(JSON.stringify(result), /[а-яё]/i);
  assert.equal(Object.keys(result).length, 10);
  assert.deepEqual(followup.tools, request.tools);
  assert.equal(followup.store, false);
  assert.equal(followup.previous_response_id, undefined);
});

test('command lesson draws a circle without returning data or making a followup request', () => {
  const { command } = createLessonFlow();
  assert.equal(command.call.name, 'draw_circle');
  assert.equal(command.result, undefined);
  assert.equal(command.shape.fill, COLORS.red);
  assert.equal(command.shape.shape, 'circle');
  assert.equal(command.followup, undefined);
});
