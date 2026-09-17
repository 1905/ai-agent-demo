import { AUTO_MIC_ID, DEFAULT_MIC_ID, getMicrophoneId, setMicrophoneId, preferredMicrophoneId, openMicrophone, microphoneSupportError, microphoneErrorMessage } from './voice/microphone.js';
import { closeAudioContext, resumeAudioContext } from './voice/audioContext.js';

export function mountMicrophoneSettings(dialog, { voiceConnected = () => false } = {}) {
  dialog.querySelector('.settings-done').insertAdjacentHTML('beforebegin', `<section class="microphone-settings" aria-label="Microphone settings">
    <label for="microphone-device">Microphone</label>
    <select id="microphone-device" aria-describedby="microphone-note"></select>
    <p id="microphone-note">Applies when Voice starts.</p>
    <div class="microphone-test-row"><button type="button" id="microphone-test">Test microphone</button><div class="microphone-meter" role="meter" aria-label="Microphone input level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></div>
    <p id="microphone-test-status" role="status">Test your input before connecting.</p>
  </section>`);
  const select = dialog.querySelector('#microphone-device');
  const button = dialog.querySelector('#microphone-test');
  const status = dialog.querySelector('#microphone-test-status');
  const meter = dialog.querySelector('.microphone-meter');
  let test, disposed = false, refreshVersion = 0;
  const level = value => {
    meter.firstElementChild.style.transform = `scaleX(${value})`;
    meter.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };
  const stop = (message = 'Test stopped.') => {
    const previous = test;
    test = null;
    if (previous) {
      previous.control.abort();
      cancelAnimationFrame(previous.frame);
      previous.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
      previous.source?.disconnect();
      previous.analyser?.disconnect();
      closeAudioContext(previous.context);
    }
    level(0);
    button.textContent = 'Test microphone';
    button.disabled = voiceConnected() || Boolean(microphoneSupportError());
    status.textContent = message;
  };
  async function refresh() {
    const version = ++refreshVersion;
    const options = [new Option('Automatic', AUTO_MIC_ID), new Option('System default', DEFAULT_MIC_ID)];
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices() || [];
      if (disposed || version !== refreshVersion) return;
      const microphones = devices.filter(device => device.kind === 'audioinput' && device.deviceId && device.deviceId !== DEFAULT_MIC_ID);
      for (const [index, device] of microphones.entries()) options.push(new Option(device.label || `Microphone ${index + 1}`, device.deviceId));
    } catch { /* Keep the default choices when device enumeration is blocked. */ }
    if (disposed || version !== refreshVersion) return;
    const choice = getMicrophoneId();
    if (!options.some(option => option.value === choice)) options.push(new Option('Selected microphone (unavailable)', choice));
    select.replaceChildren(...options);
    select.value = choice;
  }
  async function start() {
    if (test) { stop(); return; }
    if (voiceConnected()) { stop('Stop Voice to test a microphone.'); return; }
    const supportError = microphoneSupportError();
    if (supportError) { stop(supportError); return; }
    const run = test = { control: new AbortController() };
    button.textContent = 'Cancel';
    status.textContent = 'Allow microphone access…';
    try {
      // Start Web Audio in the click gesture, before the permission prompt.
      run.context = new AudioContext();
      const audioReady = resumeAudioContext(run.context);
      audioReady.catch(() => {});
      const devices = await navigator.mediaDevices.enumerateDevices();
      const deviceId = preferredMicrophoneId(devices);
      const { stream, usedDefault } = await openMicrophone(deviceId, { signal: run.control.signal });
      if (test !== run || disposed || !dialog.open) { stream.getTracks().forEach(track => track.stop()); return; }
      run.stream = stream;
      await audioReady;
      if (test !== run) return;
      const track = stream.getAudioTracks()[0];
      track.onended = () => { if (test === run) stop('Microphone disconnected. Choose another input.'); };
      run.source = run.context.createMediaStreamSource(stream);
      run.analyser = run.context.createAnalyser();
      run.analyser.fftSize = 1024;
      run.source.connect(run.analyser);
      const samples = new Float32Array(run.analyser.fftSize);
      button.textContent = 'Stop test';
      status.textContent = usedDefault && deviceId !== DEFAULT_MIC_ID
        ? 'Selected microphone unavailable. Testing system default.'
        : `Speak to test${track.label ? `: ${track.label}` : ' your microphone'}.`;
      refresh();
      const tick = () => {
        if (test !== run) return;
        run.analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
        level(Math.min(1, rms * 5));
        run.frame = requestAnimationFrame(tick);
      };
      tick();
    } catch (error) {
      if (test === run) stop(microphoneErrorMessage(error));
    }
  }
  select.onchange = () => {
    stop(voiceConnected() ? 'Reconnect Voice to use this microphone.' : 'Test your selected input before connecting.');
    setMicrophoneId(select.value);
  };
  button.onclick = start;
  const opened = () => {
    stop(microphoneSupportError() || (voiceConnected() ? 'Stop Voice to test a microphone.' : 'Test your input before connecting.'));
    refresh();
  };
  const closed = () => stop();
  dialog.addEventListener('close', closed);
  window.addEventListener('pagehide', closed);
  navigator.mediaDevices?.addEventListener('devicechange', refresh);
  refresh();
  return { open: opened, dispose() {
    disposed = true; refreshVersion++;
    stop();
    dialog.removeEventListener('close', closed);
    window.removeEventListener('pagehide', closed);
    navigator.mediaDevices?.removeEventListener('devicechange', refresh);
  } };
}
