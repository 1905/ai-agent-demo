import test from 'node:test';
import assert from 'node:assert/strict';
import { pcm16 } from '../src/voice/session.js';

test('voice capture converts clipped samples to mono PCM16 at 24 kHz', () => {
  assert.deepEqual([...pcm16(new Float32Array([2, 0, -2, 0, .5, 0]), 48000)], [32767, -32768, 16383]);
  assert.deepEqual([...pcm16(new Float32Array([0, 1, -1]), 24000)], [0, 32767, -32768]);
});
