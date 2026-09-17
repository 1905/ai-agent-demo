import { validateArtworkArgs } from './artwork-tools.js';

const SIZE = 640;

// This function becomes a blob worker inside an opaque-origin sandbox frame.
// Generated code never runs in the application window or its origin.
function drawWorker() {
  self.onmessage = ({ data: code }) => {
    try {
      const canvas = new OffscreenCanvas(640, 640);
      const ctx = canvas.getContext('2d');
      const pixels = ctx.getImageData.bind(ctx);
      const send = self.postMessage.bind(self);
      new Function('ctx', 'width', 'height', '"use strict";\n' + code)(ctx, 640, 640);
      const buffer = pixels(0, 0, 640, 640).data.buffer;
      send({ pixels: buffer }, [buffer]);
    } catch (error) { self.postMessage({ error: String(error.message).slice(0, 500) }); }
  };
}

function sandboxFrame(workerSource) {
  let worker, timer;
  const finish = data => {
    clearTimeout(timer);
    worker?.terminate();
    parent.postMessage(data, '*');
  };
  addEventListener('message', event => {
    if (event.source !== parent || worker) return;
    try {
      const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
      worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = ({ data }) => finish(data);
      worker.onerror = event => { event.preventDefault(); finish({ error: 'Drawing JavaScript failed.' }); };
      timer = setTimeout(() => finish({ error: 'Drawing exceeded the 2-second limit. Simplify the code.' }), 2000);
      worker.postMessage(event.data.code);
    } catch (error) { finish({ error: String(error.message).slice(0, 500) }); }
  }, { once: true });
  parent.postMessage({ ready: true }, '*');
}

export function renderJavaScript(code, signal) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'Isolated drawing renderer';
    frame.setAttribute('sandbox', 'allow-scripts');
    const nonce = crypto.randomUUID();
    const worker = `(${drawWorker.toString()})()`;
    // Blob workers inherit this CSP. Network and external scripts are denied.
    // Only trusted bootstrap code is in srcdoc; model code arrives via a message.
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval'; worker-src blob:; connect-src 'none'"><script nonce="${nonce}">(${sandboxFrame.toString()})(${JSON.stringify(worker)})<\/script>`;
    let settled = false;
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); signal?.removeEventListener('abort', abort); frame.remove(); };
    const finish = (error, value) => { if (settled) return; settled = true; cleanup(); error ? reject(error) : resolve(value); };
    const abort = () => finish(new Error('Drawing cancelled.'));
    const receive = event => {
      if (event.source !== frame.contentWindow || !event.data) return;
      if (event.data.ready) { frame.contentWindow.postMessage({ code }, '*'); return; }
      if (typeof event.data.error === 'string') { finish(new Error(event.data.error.slice(0, 500))); return; }
      try {
        const buffer = event.data.pixels;
        if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== SIZE * SIZE * 4) throw new Error('Drawing returned invalid pixels.');
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = SIZE;
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buffer), SIZE, SIZE), 0, 0);
        finish(null, canvas.toDataURL('image/png'));
      } catch (error) { finish(error); }
    };
    const timer = setTimeout(() => finish(new Error('Drawing renderer timed out.')), 5000);
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    document.body.append(frame);
  });
}

export async function renderArtwork(name, args, signal) {
  const source = validateArtworkArgs(name, args);
  if (name === 'draw_js') return { type: 'js', code: source, imageUrl: await renderJavaScript(source, signal) };
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
