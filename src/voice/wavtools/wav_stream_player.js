// OpenAI's reference PCM16 stream player, from openai/openai-cookbook:
//   examples/voice_solutions/one_way_translation_using_realtime_api/
//   src/lib/wavtools/lib/wav_stream_player.js
//
// Trimmed to what this app uses: the frequency-analysis helper and its
// AudioAnalysis dependency are dropped. Device errors and shutdown are handled
// locally; PCM playback still uses the reference worklet.
//
// sampleRate is 24000 here rather than the reference's 44100 default, because
// gpt-live-1 emits 24kHz PCM16 and the context must run at the rate of the
// samples being written into it.

import { StreamProcessorSrc } from './stream_processor.js';
import { closeAudioContext, resumeAudioContext } from '../audioContext.js';

export class WavStreamPlayer {
  constructor({ sampleRate = 24000, onError = () => {} } = {}) {
    this.scriptSrc = StreamProcessorSrc;
    this.sampleRate = sampleRate;
    this.context = null;
    this.stream = null;
    this.analyser = null;
    this.trackSampleOffsets = {};
    this.interruptedTrackIds = {};
    this.onError = onError;
  }

  async connect() {
    const context = new AudioContext({ sampleRate: this.sampleRate });
    this.context = context;
    context.onerror = () => this.onError(new Error('The audio output device or renderer failed.'));
    try {
      await resumeAudioContext(context);
      await context.audioWorklet.addModule(this.scriptSrc);
      if (this.context !== context || context.state === 'closed') throw new Error('Audio output was closed during startup.');
      await resumeAudioContext(context);
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.1;
      this.analyser = analyser;
      return true;
    } catch (e) {
      await this.close();
      throw e;
    }
  }

  stop() {
    if (!this.stream) return;
    this.stream.port.onmessage = null;
    this.stream.port.close();
    this.stream.disconnect();
    this.stream = null;
  }

  async close() {
    this.stop();
    this.analyser?.disconnect();
    this.analyser = null;
    const context = this.context;
    this.context = null;
    await closeAudioContext(context);
  }

  _start() {
    const streamNode = new AudioWorkletNode(this.context, 'stream_processor');
    streamNode.connect(this.context.destination);
    streamNode.port.onmessage = (e) => {
      const { event } = e.data;
      if (event === 'stop') {
        streamNode.disconnect();
        this.stream = null;
      } else if (event === 'offset') {
        const { requestId, trackId, offset } = e.data;
        const currentTime = offset / this.sampleRate;
        this.trackSampleOffsets[requestId] = { trackId, offset, currentTime };
      }
    };
    this.analyser.disconnect();
    streamNode.connect(this.analyser);
    this.stream = streamNode;
    return true;
  }

  /**
   * Adds 16BitPCM data to the currently playing audio stream.
   * Chunks added beyond the current play point are queued.
   */
  add16BitPCM(arrayBuffer, trackId = 'default') {
    if (typeof trackId !== 'string') {
      throw new Error(`trackId must be a string`);
    } else if (this.interruptedTrackIds[trackId]) {
      return;
    }
    if (!this.stream) {
      this._start();
    }
    let buffer;
    if (arrayBuffer instanceof Int16Array) {
      buffer = arrayBuffer;
    } else if (arrayBuffer instanceof ArrayBuffer) {
      buffer = new Int16Array(arrayBuffer);
    } else {
      throw new Error(`argument must be Int16Array or ArrayBuffer`);
    }
    this.stream.port.postMessage({ event: 'write', buffer, trackId });
    return buffer;
  }

  async getTrackSampleOffset(interrupt = false) {
    if (!this.stream || this.context?.state !== 'running') {
      return null;
    }
    const stream = this.stream;
    const requestId = crypto.randomUUID();
    this.stream.port.postMessage({
      event: interrupt ? 'interrupt' : 'offset',
      requestId,
    });
    let trackSampleOffset;
    const deadline = Date.now() + 1000;
    while (!trackSampleOffset && this.stream === stream && this.context?.state === 'running' && Date.now() < deadline) {
      trackSampleOffset = this.trackSampleOffsets[requestId];
      if (!trackSampleOffset) await new Promise((r) => setTimeout(r, 10));
    }
    delete this.trackSampleOffsets[requestId];
    if (!trackSampleOffset) return null;
    const { trackId } = trackSampleOffset;
    if (interrupt && trackId) {
      this.interruptedTrackIds[trackId] = true;
    }
    return trackSampleOffset;
  }

  /** Stops the current stream and returns its sample offset. */
  async interrupt() {
    const stream = this.stream;
    try { return await this.getTrackSampleOffset(true); }
    finally { if (this.stream === stream) this.stop(); }
  }
}
