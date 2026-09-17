import test from 'node:test';
import assert from 'node:assert/strict';
import { pcm16, VoiceSession } from '../src/voice/session.js';

test('voice capture converts clipped samples to mono PCM16 at 24 kHz', () => {
  assert.deepEqual([...pcm16(new Float32Array([2, 0, -2, 0, .5, 0]), 48000)], [32767, -32768, 16383]);
  assert.deepEqual([...pcm16(new Float32Array([0, 1, -1]), 24000)], [0, 32767, -32768]);
});

test('mic mute sends silence while playback and tool calls keep working', async () => {
  const sent = [], levels = [], playback = [], tools = [];
  const voice = new VoiceSession({
    onState() {}, onTranscript() {}, onError: message => assert.fail(message), onEvent() {},
    onLevel: level => levels.push(level),
    executeTool: async call => { tools.push(call.name); return { output: 'done' }; },
  });
  const track = { enabled: true };
  voice.stream = { getAudioTracks: () => [track] };
  voice.setMicMuted(true);
  assert.equal(voice.micMuted, false, 'disconnected sessions cannot be muted');
  voice.socket = { bufferedAmount: 0 };
  voice.send = event => sent.push(event);
  voice.player = { add16BitPCM: audio => playback.push(audio) };
  const node = () => ({ connect() {} });
  voice.input = {
    sampleRate: 24000, createMediaStreamSource: node,
    createScriptProcessor: node, createGain: () => ({ ...node(), gain: {} }), destination: {},
  };
  voice.receive({ type: 'session.started' }, voice.generation);
  const frame = { inputBuffer: { getChannelData: () => new Float32Array([0.5, -0.5]) } };
  voice.processor.onaudioprocess(frame);
  const audible = sent.at(-1).audio;
  assert.notEqual(audible, 'AAAAAA==');
  voice.setMicMuted(true);
  assert.equal(track.enabled, false);
  assert.equal(levels.at(-1), 0);
  voice.processor.onaudioprocess(frame);
  assert.equal(sent.at(-1).audio, 'AAAAAA==', 'buffered speech is replaced by silence');
  voice.receive({ type: 'session.output_audio.delta', delta: 'AAAAAA==' }, voice.generation);
  voice.receive({ type: 'response.event', event: { type: 'response.output_item.done', item: { type: 'function_call', name: 'read_canvas', call_id: 'muted-tool', arguments: '{}' } } }, voice.generation);
  await voice.toolQueue;
  assert.equal(playback.length, 1);
  assert.deepEqual(tools, ['read_canvas']);
  assert.equal(sent.at(-1).type, 'tool.result');
  assert.equal(voice.state, 'listening');
  voice.setMicMuted(false);
  assert.equal(track.enabled, true);
  voice.processor.onaudioprocess(frame);
  assert.equal(sent.at(-1).audio, audible);
  voice.setState('stopping');
  voice.setMicMuted(true);
  assert.equal(voice.micMuted, false, 'stopping sessions ignore mute controls');
});
