import { simplifyApiEntry } from './log-summary.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let root, entries = [], selected = 0, side = 'simple';

export function highlightJson(value, spacing = 2) {
  const json = JSON.stringify(value, null, spacing);
  return json.replace(/"(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token, offset) => {
    // Non-token text is only JSON punctuation/whitespace. Escape every token.
    const kind = token.startsWith('"') ? token.trimEnd().endsWith(':') ? 'key' : 'string' : /^(true|false|null)$/.test(token) ? 'literal' : 'number';
    return `<span class="json-${kind}">${escape(token)}</span>`;
  });
}

function paint() {
  if (!root?.isConnected) return;
  const entry = entries[selected];
  const shown = entry ? side === 'simple' ? simplifyApiEntry(entry) : entry[side] : null;
  root.innerHTML = `<div class="api-log-toolbar"><h2>API log</h2><div class="api-log-calls" aria-label="API calls">${entries.map((item, index) => `<button type="button" data-call="${index}" aria-pressed="${index === selected}">${index + 1}</button>`).join('')}</div></div>${entry ? `<div class="api-log-controls"><div class="api-log-tabs" aria-label="JSON view"><button type="button" data-side="simple" aria-pressed="${side === 'simple'}">Simple</button><button type="button" data-side="request" aria-pressed="${side === 'request'}">Request</button><button type="button" data-side="response" aria-pressed="${side === 'response'}">Response</button></div><span class="api-log-meta">${escape(entry.endpoint)}${entry.status ? ` · ${entry.status}${entry.duration == null ? '' : ` · ${(entry.duration / 1000).toFixed(2)} s`}` : ' · …'}</span><button type="button" id="copy-api-json">Copy</button></div><pre tabindex="0" aria-label="${side === 'simple' ? 'Simplified explanation' : side === 'request' ? 'Request' : 'Response'} JSON"><code>${side === 'response' && !entry.response ? '…' : highlightJson(shown)}</code></pre>` : ''}`;
  root.querySelector('.api-log-meta')?.toggleAttribute('hidden', side === 'simple');
  root.querySelectorAll('[data-call]').forEach(button => button.onclick = () => { selected = Number(button.dataset.call); paint(); });
  root.querySelectorAll('[data-side]').forEach(button => button.onclick = () => { side = button.dataset.side; paint(); });
  const copy = root.querySelector('#copy-api-json');
  if (copy) copy.onclick = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(shown, null, 2)); copy.textContent = 'Copied'; }
    catch { copy.textContent = 'Copy failed'; }
  };
}

export function mountApiLog(container) { root = container; paint(); }
export function resetApiLog() { entries = []; selected = 0; side = 'simple'; paint(); }
export function logVoiceEvent(direction, event) {
  entries.push({ request: direction === 'request' ? event : null, response: direction === 'response' ? event : null, endpoint: `WS · ${event.type}`, status: direction === 'request' ? 'Sent' : 'Received', duration: null });
  // Audio frames and transcript fragments are handled by the voice UI, not this inspector.
  if (entries.length > 200) entries.shift();
  selected = entries.length - 1; side = 'simple'; paint();
}

export async function requestDrawing(input, signal, model, reasoningEffort, enabledTools) {
  const entry = { request: structuredClone({ input, model, reasoningEffort, enabledTools }), response: null, endpoint: '/api/draw/turn', status: null };
  entries.push(entry); selected = entries.length - 1; side = 'simple'; paint();
  const started = performance.now();
  try {
    const response = await fetch('/api/draw/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry.request), signal });
    const data = await response.json();
    entry.status = response.status;
    entry.request = data.trace?.request || entry.request;
    entry.response = data.trace?.response || data;
    if (data.trace) entry.endpoint = 'POST /v1/responses';
    if (!response.ok) throw new Error(data.error || 'The model request failed.');
    return data;
  } catch (error) {
    entry.status ||= error.name === 'AbortError' ? 'Cancelled' : 'Failed';
    entry.response ||= { error: error.name === 'AbortError' ? 'Request cancelled.' : error.message };
    throw error;
  } finally {
    entry.duration = performance.now() - started;
    paint();
  }
}
