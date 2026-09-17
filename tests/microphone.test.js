import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_MIC_ID, DEFAULT_MIC_ID, getMicrophoneId, setMicrophoneId, preferredMicrophoneId, openMicrophone } from '../src/voice/microphone.js';

function mediaEnvironment(t, getUserMedia) {
  for (const [name, value] of Object.entries({ window: { isSecureContext: true }, navigator: { mediaDevices: { getUserMedia } } })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => original ? Object.defineProperty(globalThis, name, original) : delete globalThis[name]);
  }
}

test('explicit microphone selection overrides automatic AirPods preference and survives session creation', async t => {
  const devices = [{ kind: 'audioinput', deviceId: 'airpods', label: 'AirPods' }, { kind: 'audioinput', deviceId: 'usb', label: 'USB mic' }];
  const previous = getMicrophoneId();
  t.after(() => setMicrophoneId(previous));
  assert.equal(preferredMicrophoneId(devices, AUTO_MIC_ID), 'airpods');
  assert.equal(preferredMicrophoneId(devices, DEFAULT_MIC_ID), DEFAULT_MIC_ID);
  setMicrophoneId('usb');
  assert.equal(preferredMicrophoneId(devices), 'usb');
  const { VoiceSession } = await import('../src/voice/session.js');
  const voice = new VoiceSession({});
  setMicrophoneId('airpods');
  assert.equal(voice.microphoneId, 'usb', 'active sessions keep their starting device choice');
});

test('selected input requests an exact device; missing device fallback is reported', async t => {
  const constraints = [];
  const stream = { getTracks: () => [] };
  mediaEnvironment(t, async input => {
    constraints.push(input);
    if (input.audio.deviceId?.exact === 'missing') throw new DOMException('Disconnected', 'OverconstrainedError');
    return stream;
  });
  assert.deepEqual(await openMicrophone('usb'), { stream, usedDefault: false });
  assert.deepEqual(constraints[0].audio.deviceId, { exact: 'usb' });
  assert.deepEqual(await openMicrophone('missing'), { stream, usedDefault: true });
  assert.equal(constraints.at(-1).audio.deviceId, undefined);
});

test('cancelled microphone permission releases a stream that arrives later', async t => {
  let grant, stopped = 0;
  mediaEnvironment(t, () => new Promise(resolve => { grant = resolve; }));
  const control = new AbortController();
  const pending = openMicrophone('usb', { signal: control.signal });
  control.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  grant({ getTracks: () => [{ stop() { stopped++; } }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped, 1);
});

test('permission denial does not silently try another input', async t => {
  let calls = 0;
  mediaEnvironment(t, async () => { calls++; throw new DOMException('Blocked', 'NotAllowedError'); });
  await assert.rejects(openMicrophone('usb'), { name: 'NotAllowedError' });
  assert.equal(calls, 1);
});
