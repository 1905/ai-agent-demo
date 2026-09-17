import { validateArtworkArgs, updateSvgSource } from './artwork-tools.js';

// Runs in a worker owned by an opaque-origin sandbox, never in the app window.
function drawWorker() {
  let canvas, ctx, draw;
  const send = self.postMessage.bind(self);
  self.onmessage = ({ data }) => {
    try {
      if (data.canvas) {
        canvas = data.canvas;
        ctx = canvas.getContext('2d');
        draw = new Function('ctx', 'width', 'height', 'time', '"use strict";\n' + data.code);
      }
      ctx.reset();
      draw(ctx, 640, 640, data.time);
      // The browser presents the transferred canvas directly. No pixel copies or encoding.
      send({ drawn: true });
    } catch (error) { send({ error: String(error.message || error).slice(0, 500) }); }
  };
}

function sandboxFrame(workerSource) {
  const canvas = document.querySelector('canvas');
  let worker, timer;
  const fail = message => {
    clearTimeout(timer); worker?.terminate();
    parent.postMessage({ error: message }, '*');
  };
  addEventListener('message', event => {
    if (event.source !== parent) return;
    if (event.data.capture) {
      try { parent.postMessage({ capture: event.data.capture, imageUrl: canvas.toDataURL('image/png') }, '*'); }
      catch { parent.postMessage({ capture: event.data.capture, captureError: 'PNG export failed.' }, '*'); }
      return;
    }
    try {
      let data = event.data;
      if (!worker) {
        const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
        worker = new Worker(url); URL.revokeObjectURL(url);
        worker.onmessage = ({ data }) => {
          clearTimeout(timer);
          if (data.error) fail(data.error);
          else parent.postMessage({ drawn: true }, '*');
        };
        worker.onerror = event => { event.preventDefault(); fail('Drawing JavaScript failed.'); };
        data = { ...data, canvas: canvas.transferControlToOffscreen() };
      }
      timer = setTimeout(() => fail('Animation frame exceeded the 2-second limit.'), 2000);
      worker.postMessage(data, data.canvas ? [data.canvas] : []);
    } catch (error) { fail(String(error.message).slice(0, 500)); }
  });
  parent.postMessage({ ready: true }, '*');
}

export function renderJavaScript(code, signal, { surface: frame, onError = () => {}, onReady = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    if (!frame) { reject(new Error('A drawing surface is required.')); return; }
    frame.setAttribute('sandbox', 'allow-scripts');
    const nonce = crypto.randomUUID();
    const worker = `(${drawWorker.toString()})()`;
    // Keep the visible canvas and its worker in the same sandbox document.
    // Only trusted bootstrap is embedded here; model code arrives through a message.
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src 'nonce-${nonce}'; worker-src blob:; connect-src 'none'"><style nonce="${nonce}">html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}</style><canvas width="640" height="640"></canvas><script nonce="${nonce}">(${sandboxFrame.toString()})(${JSON.stringify(worker)})<\/script>`;
    let settled = false, closed = false, stopped = false, animation, started, captureId = 0;
    const captures = new Map();
    const capture = () => new Promise((resolve, reject) => {
      if (closed) { reject(new Error('The drawing is no longer active.')); return; }
      const id = ++captureId;
      const timeout = setTimeout(() => { captures.delete(id); reject(new Error('PNG export timed out.')); }, 3000);
      captures.set(id, { resolve, reject, timeout });
      frame.contentWindow.postMessage({ capture: id }, '*');
    });
    const cleanup = () => {
      closed = true; clearTimeout(timer); cancelAnimationFrame(animation);
      window.removeEventListener('message', receive); signal?.removeEventListener('abort', abort);
      for (const item of captures.values()) { clearTimeout(item.timeout); item.reject(new Error('Drawing cancelled.')); }
      captures.clear(); frame.remove();
    };
    const fail = error => {
      if (closed || stopped) return;
      stopped = true; clearTimeout(timer); cancelAnimationFrame(animation);
      if (!settled) { cleanup(); reject(error); }
      else onError(error);
    };
    const abort = () => { if (!settled) reject(new Error('Drawing cancelled.')); cleanup(); };
    const receive = event => {
      if (closed || event.source !== frame.contentWindow || !event.data) return;
      try {
        const pending = captures.get(event.data.capture);
        if (pending) {
          clearTimeout(pending.timeout); captures.delete(event.data.capture);
          if (typeof event.data.imageUrl === 'string' && event.data.imageUrl.startsWith('data:image/png;base64,')) pending.resolve(event.data.imageUrl);
          else pending.reject(new Error('PNG export failed.'));
          return;
        }
        if (stopped) return;
        if (event.data.ready) {
          started = performance.now();
          frame.contentWindow.postMessage({ code, time: 0 }, '*');
        } else if (typeof event.data.error === 'string') fail(new Error(event.data.error.slice(0, 500)));
        else if (event.data.drawn) {
          if (!settled) { settled = true; clearTimeout(timer); onReady({ capture }); resolve(); }
          // One frame in flight. Background tabs pause; slow frames never queue up.
          animation = requestAnimationFrame(now => {
            if (!closed && !stopped) frame.contentWindow.postMessage({ time: (now - started) / 1000 }, '*');
          });
        }
      } catch (error) { fail(error); }
    };
    const timer = setTimeout(() => fail(new Error('Drawing renderer timed out.')), 5000);
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export async function renderArtwork(name, args, signal, options = {}, currentSvg) {
  const source = name === 'update_svg' ? updateSvgSource(currentSvg, args) : validateArtworkArgs(name, args);
  if (name === 'draw_js') { await renderJavaScript(source, signal, options); return { type: 'js', code: source }; }
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Use SVG markup without a DOCTYPE or entity declarations.');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.localName !== 'svg' || svg.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Provide valid SVG with xmlns="http://www.w3.org/2000/svg".');
  // SVG stays in image context, including export. Never inject it as page markup.
  const imageUrl = `data:image/svg+xml;base64,${btoa(Array.from(new TextEncoder().encode(source), byte => String.fromCharCode(byte)).join(''))}`;
  const image = new Image();
  image.src = imageUrl;
  await image.decode();
  if (signal?.aborted) throw new Error('Drawing cancelled.');
  return { type: 'svg', svg: source, imageUrl };
}
