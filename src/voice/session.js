import { openMicrophone, preferredMicrophoneId, microphoneErrorMessage, microphoneSupportError } from './microphone.js';
import { closeAudioContext, resumeAudioContext } from './audioContext.js';
import { WavStreamPlayer } from './wavtools/wav_stream_player.js';

// Capture, PCM conversion, playback, and shutdown adapted from voice_chat_mcp.
export function pcm16(input, sampleRate) {
  const ratio = sampleRate / 24000;
  const output = new Int16Array(Math.floor(input.length / ratio));
  for (let index = 0; index < output.length; index++) {
    const offset = index * ratio, left = Math.floor(offset), fraction = offset - left;
    const value = Math.max(-1, Math.min(1, input[left] * (1 - fraction) + (input[Math.min(left + 1, input.length - 1)] || 0) * fraction));
    output[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return output;
}
function encodeAudio(pcm) {
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export class VoiceSession {
  constructor({ executeTool, onState, onTranscript, onError, onEvent, onLevel }) {
    Object.assign(this, { executeTool, onState, onTranscript, onError, onEvent, onLevel });
    this.state = 'idle'; this.generation = 0; this.calls = new Set(); this.toolQueue = Promise.resolve();
  }
  setState(state) { this.state = state; this.onState(state); }
  send(event) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event)); }
  async start() {
    if (this.state !== 'idle') return;
    const generation = ++this.generation;
    this.abort = new AbortController(); this.calls.clear(); this.toolQueue = Promise.resolve();
    this.setState('connecting');
    try {
      const supportError = microphoneSupportError();
      if (supportError) throw new Error(supportError);
      // Audio contexts start in the button gesture, before permission resolves.
      this.player = new WavStreamPlayer({ sampleRate: 24000, onError: error => this.fail(error) });
      this.input = new AudioContext({ sampleRate: 24000 });
      this.input.onerror = () => this.fail(new Error('The microphone audio device failed.'));
      const audioReady = Promise.all([this.player.connect(), resumeAudioContext(this.input)]);
      audioReady.catch(() => {});
      const devices = await navigator.mediaDevices.enumerateDevices();
      const { stream } = await openMicrophone(preferredMicrophoneId(devices), { signal: this.abort.signal });
      if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      await audioReady;
      if (generation !== this.generation) return;
      stream.getAudioTracks()[0].onended = () => this.fail(new Error('The microphone disconnected. Connect it and start again.'));
      const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/voice`;
      const socket = this.socket = new WebSocket(url);
      socket.onopen = () => this.send({ type: 'session.start' });
      socket.onmessage = message => { if (generation === this.generation) this.receive(JSON.parse(message.data), generation); };
      socket.onerror = () => { if (generation === this.generation) this.fail(new Error('The voice connection failed. Try again.')); };
      socket.onclose = () => {
        if (generation !== this.generation) return;
        if (this.state !== 'stopping') this.onError('Voice disconnected. Start again to reconnect.');
        this.finish();
      };
      this.startTimer = setTimeout(() => this.fail(new Error('Voice did not connect. Try again.')), 20000);
    } catch (error) {
      if (generation === this.generation) this.fail(new Error(microphoneErrorMessage(error)));
    }
  }
  receive(event, generation) {
    if (event.type === 'voice.request') { this.onEvent('request', event.event); return; }
    if (['session.started', 'session.closed', 'session.delegation.created', 'error', 'voice.failure'].includes(event.type) || (event.type === 'response.event' && ['response.created', 'response.output_item.done', 'response.completed', 'response.failed'].includes(event.event?.type))) this.onEvent('response', event);
    if (event.type === 'voice.ended') { if (!event.finalized) this.onError('Voice stopped. Final provider usage could not be confirmed.'); this.finish(); return; }
    if (event.type === 'voice.ending') { this.stop(); return; }
    if (this.state === 'stopping') return;
    if (event.type === 'session.started') {
      clearTimeout(this.startTimer);
      if (this.state === 'listening') return;
      this.setState('listening');
      this.source = this.input.createMediaStreamSource(this.stream);
      this.processor = this.input.createScriptProcessor(2048, 1, 1);
      this.processor.onaudioprocess = e => {
        if (this.state !== 'listening') return;
        const samples = e.inputBuffer.getChannelData(0);
        this.onLevel(Math.min(1, Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length) * 5));
        if (this.socket.bufferedAmount > 500000) return this.fail(new Error('Voice connection is too slow. Start again.'));
        this.send({ type: 'session.input_audio.append', audio: encodeAudio(pcm16(samples, this.input.sampleRate)) });
      };
      this.silent = this.input.createGain(); this.silent.gain.value = 0;
      this.source.connect(this.processor); this.processor.connect(this.silent); this.silent.connect(this.input.destination);
    } else if (event.type === 'session.output_audio.delta' && event.delta) {
      try {
        const binary = atob(event.delta), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        this.player.add16BitPCM(bytes.buffer, 'assistant');
      } catch { this.fail(new Error('Voice playback failed. Start again.')); }
    } else if (event.type === 'session.input_transcript.delta' || event.type === 'session.output_transcript.delta') {
      this.onTranscript(event.type.includes('input_') ? 'user' : 'assistant', event.delta || '');
    } else if (event.type === 'error') this.fail(new Error(event.error?.message || 'Voice request failed.'));
    else if (event.type === 'voice.failure') this.onError(event.message);
    else if (event.type === 'response.event' && event.event?.type === 'response.output_item.done') {
      const call = event.event.item;
      if (call?.type !== 'function_call' || this.calls.has(call.call_id)) return;
      this.calls.add(call.call_id);
      this.toolQueue = this.toolQueue.then(async () => {
        if (generation !== this.generation || this.state !== 'listening') return;
        const result = call.name === 'end_conversation' ? { output: '{"ended":true}' } : await this.executeTool(call);
        if (generation === this.generation && this.state === 'listening' && result) this.send({ type: 'tool.result', call_id: call.call_id, ...result });
      }).catch(error => this.fail(error));
    }
  }
  releaseAudio() {
    this.abort?.abort();
    clearTimeout(this.startTimer);
    if (this.processor) { this.processor.onaudioprocess = null; this.processor.disconnect(); this.processor = null; }
    this.source?.disconnect(); this.source = null;
    this.silent?.disconnect(); this.silent = null;
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); }); this.stream = null;
    this.player?.close(); this.player = null;
    closeAudioContext(this.input); this.input = null;
    this.onLevel(0);
  }
  stop() {
    if (this.state === 'idle' || this.state === 'stopping') return;
    this.setState('stopping'); this.releaseAudio();
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'session.close' });
      this.closeTimer = setTimeout(() => { this.onError('Voice stopped. Final provider usage could not be confirmed.'); this.finish(); }, 17000);
    } else this.finish();
  }
  fail(error) { this.onError(error.message); this.stop(); }
  finish() {
    this.generation++; clearTimeout(this.closeTimer); this.releaseAudio();
    if (this.socket) { this.socket.onclose = null; this.socket.onmessage = null; this.socket.onerror = null; this.socket.close(); this.socket = null; }
    this.setState('idle');
  }
  dispose() { this.stop(); }
}
