// OpenAI's reference AudioWorklet for PCM16 playback, taken verbatim from
// openai/openai-cookbook:
//   examples/voice_solutions/one_way_translation_using_realtime_api/
//   src/lib/wavtools/lib/worklets/stream_processor.js
//
// Do not rewrite this. The previous hand-rolled player started a separate
// BufferSource per 100ms chunk and waited for onended before starting the
// next, which inserts a gap at every chunk boundary — roughly ten audible
// clicks per second. A single persistent worklet has no boundaries to click at.
//
// ONE deliberate change from the reference, marked JITTER below. gpt-live-1
// streams at exactly realtime: 100ms of audio arrives every 100ms, so there is
// zero slack. Measured on this app, 7 of 87 chunk gaps exceeded 110ms. The
// reference worklet posts 'stop' and tears the node down the instant its
// buffer runs dry, and the next chunk builds a fresh node — so every network
// hiccup became a hard stop/restart. Now it pre-rolls a small buffer before
// starting and plays silence through an underrun instead of stopping. 'stop'
// only fires on an explicit interrupt.

export const StreamProcessorWorklet = `
class StreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hasStarted = false;
    this.hasInterrupted = false;
    this.outputBuffers = [];
    this.bufferLength = 128;
    // JITTER: frames to accumulate before (re)starting output. 24kHz * 0.25s.
    this.prerollFrames = 6000;
    this.buffering = true;
    this.write = { buffer: new Float32Array(this.bufferLength), trackId: null };
    this.writeOffset = 0;
    this.trackSampleOffsets = {};
    this.port.onmessage = (event) => {
      if (event.data) {
        const payload = event.data;
        if (payload.event === 'write') {
          const int16Array = payload.buffer;
          const float32Array = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 0x8000; // Convert Int16 to Float32
          }
          this.writeData(float32Array, payload.trackId);
        } else if (
          payload.event === 'offset' ||
          payload.event === 'interrupt'
        ) {
          const requestId = payload.requestId;
          const trackId = this.write.trackId;
          const offset = this.trackSampleOffsets[trackId] || 0;
          this.port.postMessage({
            event: 'offset',
            requestId,
            trackId,
            offset,
          });
          if (payload.event === 'interrupt') {
            this.hasInterrupted = true;
          }
        } else {
          throw new Error(\`Unhandled event "\${payload.event}"\`);
        }
      }
    };
  }

  writeData(float32Array, trackId = null) {
    let { buffer } = this.write;
    let offset = this.writeOffset;
    for (let i = 0; i < float32Array.length; i++) {
      buffer[offset++] = float32Array[i];
      if (offset >= buffer.length) {
        this.outputBuffers.push(this.write);
        this.write = { buffer: new Float32Array(this.bufferLength), trackId };
        buffer = this.write.buffer;
        offset = 0;
      }
    }
    this.writeOffset = offset;
    return true;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputChannelData = output[0];
    const outputBuffers = this.outputBuffers;
    if (this.hasInterrupted) {
      this.port.postMessage({ event: 'stop' });
      return false;
    }

    // JITTER: hold output until enough is queued, then play; on underrun go
    // back to holding rather than tearing the node down.
    const queuedFrames = outputBuffers.length * this.bufferLength + this.writeOffset;
    if (this.buffering) {
      if (queuedFrames >= this.prerollFrames) {
        this.buffering = false;
      } else {
        outputChannelData.fill(0);
        return true;
      }
    }

    if (outputBuffers.length) {
      this.hasStarted = true;
      const { buffer, trackId } = outputBuffers.shift();
      for (let i = 0; i < outputChannelData.length; i++) {
        outputChannelData[i] = buffer[i] || 0;
      }
      if (trackId) {
        this.trackSampleOffsets[trackId] =
          this.trackSampleOffsets[trackId] || 0;
        this.trackSampleOffsets[trackId] += buffer.length;
      }
      return true;
    }

    // Underrun. Silence, and refill to preroll before resuming.
    this.buffering = true;
    outputChannelData.fill(0);
    return true;
  }
}

registerProcessor('stream_processor', StreamProcessor);
`;

const script = new Blob([StreamProcessorWorklet], {
  type: 'application/javascript',
});
const src = URL.createObjectURL(script);
export const StreamProcessorSrc = src;
