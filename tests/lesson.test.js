import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPayload,moviePlan} from '../src/lesson.js';
test('tool output preserves call identity and serializes observed data',()=>{
 const call=inspectPayload('call','rain').output[0];
 const followup=inspectPayload('result','rain');
 assert.equal(followup.input[0].call_id,call.call_id);
 assert.equal(followup.previous_response_id,'resp_demo_01');
 assert.deepEqual(JSON.parse(call.arguments),{city:'Portland'});
 assert.equal(JSON.parse(followup.input[0].output).condition,'rain');
});
test('weather choice changes both tool observation and final recommendation',()=>{
 assert.equal(JSON.parse(inspectPayload('result','clear').input[0].output).condition,'clear');
 assert.match(moviePlan('rain'),/indoors/);
 assert.match(moviePlan('clear'),/backyard/);
 assert.match(moviePlan('clear'),/\$24/);
});
