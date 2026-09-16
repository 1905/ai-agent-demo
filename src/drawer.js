import './drawer.css';
import { createDrawingStore, shapeMarkup, exportDrawing, COLORS, MAX_MODEL_CALLS } from './drawing-tools.js';
import { captureCanvas, toolOutput } from './drawing-canvas.js';
import { planDemo } from './drawing-demo.js';
import { mountApiLog, resetApiLog, requestDrawing, logVoiceEvent } from './drawing-log.js';
import { VoiceSession } from './voice/session.js';

const store = createDrawingStore();
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
let root, busy = false, session = 0, controller, mode = 'live', liveAvailable = false, checkingApi = true;
let transcript = [], messages = [], events = [], requestCount = 0, nextCall = 0;
let voiceView = false, voiceSession;
const colorName = hex => Object.entries(COLORS).find(([, value]) => value === hex)?.[0] || hex;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const find = selector => root?.querySelector(selector);

const durationText = ms => ms < 1 ? '<1 ms' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
function resultText(result) {
  if (result.error) return result.error;
  if (result.imageUrl) return `Canvas checked. ${result.shapes.length} ${result.shapes.length === 1 ? 'shape' : 'shapes'}.`;
  if (result.shapes) return result.shapes.length ? result.shapes.map(shape => `${shape.id} · ${colorName(shape.fill)} ${shape.shape}`).join(' / ') : 'Canvas is empty';
  return `${result.shape.id} ${result.action} · ${colorName(result.shape.fill)}`;
}
function paint() {
  if (!root?.isConnected) return;
  find('#drawing-chat').innerHTML = messages.length ? messages.map(message => `<div class="draw-message ${message.role}"><span>${message.role === 'user' ? 'You' : 'Agent'}</span><p>${escape(message.text)}</p></div>`).join('') : '';
  find('#drawing-calls').innerHTML = events.length ? events.map(event => `<article class="draw-tool ${escape(event.name)} ${event.status}" data-call-id="${escape(event.id)}"${event.status === 'error' ? ' aria-label="Tool failed"' : ''}><h3>${escape(event.name)}</h3><span class="draw-tool-duration" title="Tool execution time">${event.status === 'running' ? '…' : escape(durationText(event.durationMs))}</span></article>`).join('') : '';
  const snapshot = store.read();
  // Preserve SVG nodes so changing a fill visibly updates the same circle.
  const layer = find('#shape-layer');
  for (const shape of snapshot.shapes) {
    const previous = layer.querySelector(`[data-shape-id="${shape.id}"]`);
    if (!previous) layer.insertAdjacentHTML('beforeend', shapeMarkup(shape));
    else {
      previous.setAttribute('fill', shape.fill);
      if (shape.shape === 'circle') { previous.setAttribute('cx', shape.x); previous.setAttribute('cy', shape.y); previous.setAttribute('r', shape.width / 2); }
      else if (shape.shape === 'ellipse') { previous.setAttribute('cx', shape.x); previous.setAttribute('cy', shape.y); previous.setAttribute('rx', shape.width / 2); previous.setAttribute('ry', shape.height / 2); }
      else { previous.setAttribute('x', shape.x - shape.width / 2); previous.setAttribute('y', shape.y - shape.height / 2); previous.setAttribute('width', shape.width); previous.setAttribute('height', shape.height); }
    }
  }
  find('#draw-export').disabled = snapshot.shapes.length === 0;
  const unavailable = mode === 'live' && (!liveAvailable || checkingApi);
  find('#draw-send').disabled = busy || unavailable;
  find('#draw-prompt').disabled = busy;
  find('#draw-mode').disabled = busy;
  find('#draw-status').textContent = voiceView ? '' : busy ? 'Working…' : mode === 'demo' ? 'Demo · no LLM calls' : checkingApi ? 'Connecting to API…' : !liveAvailable ? 'Live · API unavailable' : `Live · ${requestCount} API ${requestCount === 1 ? 'call' : 'calls'}`;
  if (voiceView) {
    const state = voiceSession?.state || 'idle';
    find('#voice-button').disabled = unavailable || state === 'stopping';
    find('#voice-button').dataset.state = state;
    find('#voice-button').setAttribute('aria-label', state === 'idle' ? 'Start voice' : 'Stop voice');
    find('#voice-state').textContent = { idle: 'Start voice', connecting: 'Connecting…', listening: 'Listening', stopping: 'Stopping…' }[state];
  }
  for (const selector of ['#drawing-chat', '#drawing-calls']) { const pane = find(selector); pane.scrollTop = pane.scrollHeight; }
}

async function execute(call, token) {
  if (token !== session) return null;
  let args;
  try { args = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments; }
  catch { args = null; }
  const invalidArgs = !args || typeof args !== 'object' || Array.isArray(args);
  if (invalidArgs) args = {};
  const event = { id: call.call_id || `demo-${++nextCall}`, name: call.name, args, status: 'running' };
  events.push(event); paint();
  await sleep(mode === 'demo' ? 650 : 220);
  if (token !== session) return null;
  // Measure execution only; the presentation delay is not tool work.
  const started = performance.now();
  try {
    if (invalidArgs) throw new Error('Tool arguments must be an object.');
    event.result = store.execute(call.name, args);
    if (call.name === 'read_canvas') event.result.imageUrl = await captureCanvas(event.result);
    event.status = 'done';
  }
  catch (error) { event.result = { error: error.message }; event.status = 'error'; }
  event.durationMs = performance.now() - started;
  paint();
  return event.result;
}

async function submit(text) {
  text = text.trim();
  if (!text || busy) return;
  if (mode === 'live' && (!liveAvailable || checkingApi)) { find('#draw-error').textContent = checkingApi ? 'The API connection is still loading.' : 'Live mode needs a configured server API key. Demo mode is available if selected.'; return; }
  if (text.length > 2000) { find('#draw-error').textContent = 'Keep the message under 2,000 characters.'; return; }
  const token = session;
  busy = true; find('#draw-error').textContent = ''; find('#draw-prompt').value = '';
  messages.push({ role: 'user', text }); paint();
  try {
    if (mode === 'demo') {
      const plan = planDemo(text, store.read());
      let failure;
      for (const call of plan.calls) {
        const result = await execute(call, token);
        if (token !== session) return;
        if (result?.error) { failure = result.error; break; }
      }
      messages.push({ role: 'assistant', text: failure || plan.reply });
    } else {
      // A cancelled turn can leave a requested tool without its matching result.
      // Complete those entries before adding the next user message.
      const completedIds = new Set(transcript.filter(item => item.type === 'function_call_output').map(item => item.call_id));
      for (const call of transcript.filter(item => item.type === 'function_call')) {
        if (!completedIds.has(call.call_id)) transcript.push({ type: 'function_call_output', call_id: call.call_id, output: toolOutput(events.find(event => event.id === call.call_id)?.result || { error: 'Tool execution was cancelled.' }) });
      }
      transcript.push({ role: 'user', content: text });
      const turnEventStart = events.length;
      let completed = false;
      for (let round = 0; round < MAX_MODEL_CALLS; round++) {
        controller = new AbortController();
        requestCount++; paint();
        const data = await requestDrawing(transcript, controller.signal);
        if (token !== session) return;
        transcript.push(...data.inputItems);
        const calls = data.calls;
        if (!calls.length) {
          const lastResult = events.slice(turnEventStart).filter(event => event.result).at(-1)?.result;
          const toolSummary = lastResult ? resultText(lastResult) : '';
          messages.push({ role: 'assistant', text: data.text?.trim() || toolSummary || 'The model returned no text.' });
          completed = true; break;
        }
        for (const call of calls) {
          const result = await execute(call, token);
          if (token !== session) return;
          transcript.push({ type: 'function_call_output', call_id: call.call_id, output: toolOutput(result) });
        }
      }
      if (!completed) throw new Error(`Stopped after ${MAX_MODEL_CALLS} model calls. Try a shorter instruction.`);
    }
  } catch (error) {
    if (token !== session) return;
    find('#draw-error').textContent = error.name === 'AbortError' ? 'Request cancelled.' : error.message;
  } finally {
    if (token === session) { busy = false; paint(); find('#draw-prompt')?.focus(); }
  }
}

function reset() {
  voiceSession?.dispose(); voiceSession = null;
  session++; controller?.abort(); busy = false; store.reset(); transcript = []; messages = []; events = []; requestCount = 0; nextCall = 0;
  resetApiLog();
  if (voiceView) find('#voice-caption').textContent = '';
  find('#shape-layer').innerHTML = ''; find('#draw-error').textContent = ''; paint(); find('#draw-prompt').focus();
}

function toggleVoice() {
  if (voiceSession && voiceSession.state !== 'idle') { session++; voiceSession.stop(); return; }
  find('#draw-error').textContent = '';
  const mounted = root;
  let caption = '', speaker = '';
  const current = () => root === mounted && voiceSession === connection;
  const connection = new VoiceSession({
    executeTool: async call => {
      const token = session;
      const result = await execute(call, token);
      return token === session && result ? { output: toolOutput(result), failed: Boolean(result.error) } : null;
    },
    onState: state => {
      if (!current()) return;
      if (state === 'idle') { caption = ''; find('#voice-caption').textContent = ''; }
      paint();
    },
    onError: message => { if (current()) find('#draw-error').textContent = message; },
    onTranscript: (role, delta) => {
      if (!current()) return;
      if (role !== speaker || caption.length > 300) caption = '';
      speaker = role; caption += delta;
      find('#voice-caption').textContent = caption;
    },
    onEvent: (direction, event) => { if (current()) logVoiceEvent(direction, event); },
    onLevel: level => { if (current()) find('#voice-button').style.setProperty('--voice-level', level); },
  });
  voiceSession = connection;
  connection.start();
}

export function mountDrawer(container, options = {}) {
  root = container;
  voiceView = options.voice === true;
  if (voiceView) mode = 'live';
  checkingApi = true;
  root.innerHTML = `<header class="draw-header"><a href="#" class="brand"><span class="brand-mark"></span>agent lab</a><nav class="view-switch" aria-label="Views"><a href="#">Lesson</a><a href="#draw" ${voiceView ? '' : 'aria-current="page"'}>Chat</a><a href="#voice" ${voiceView ? 'aria-current="page"' : ''}>Voice</a></nav><select id="draw-mode" aria-label="Model mode" ${voiceView ? 'hidden' : ''}><option value="demo">Demo</option><option value="live" disabled>Live · key needed</option></select></header><main class="drawer-main"><div class="draw-intro"><h1>${voiceView ? 'Voice' : 'Draw'}</h1><button id="draw-reset" type="button">Reset</button></div><div class="drawer-grid"><section class="draw-chat-column" aria-labelledby="chat-title"><div class="draw-column-title"><h2 id="chat-title">${voiceView ? 'Voice' : 'Chat'}</h2>${arrow}</div><div id="drawing-chat" ${voiceView ? 'hidden' : ''} class="draw-scroll" role="log" aria-label="Conversation"></div>${voiceView ? `<div class="voice-panel"><button type="button" id="voice-button" aria-label="Start voice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6"/></svg></button><span id="voice-state" role="status">Start voice</span><p id="voice-caption" aria-live="polite"></p></div>` : ''}<form id="draw-form" ${voiceView ? 'hidden' : ''}><label class="sr-only" for="draw-prompt">Tell the agent what to draw</label><textarea id="draw-prompt" rows="2" maxlength="2000" placeholder="Draw a red circle…"></textarea><button id="draw-send" type="submit" aria-label="Send message">${arrow}</button></form><p id="draw-error" role="alert"></p></section><section class="draw-calls-column" aria-labelledby="calls-title"><div class="draw-column-title"><h2 id="calls-title">Tool calls</h2>${arrow}</div><div id="drawing-calls" class="draw-scroll" role="log" aria-label="Tool calls"></div><span id="draw-status" class="draw-status"></span></section><section class="draw-canvas-column" aria-labelledby="canvas-title"><div class="draw-column-title"><h2 id="canvas-title">Drawing</h2><button id="draw-export" type="button">Save SVG ↓</button></div><div class="drawing-square"><svg id="drawing-svg" viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your SVG drawing"><g id="shape-layer"></g></svg></div></section></div><section id="api-log" class="api-log" aria-label="Raw API log"></section></main>`;
  mountApiLog(find('#api-log'));
  find('#draw-form').onsubmit = event => { event.preventDefault(); submit(find('#draw-prompt').value); };
  find('#draw-prompt').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(event.currentTarget.value); } };
  find('#draw-reset').onclick = reset;
  if (voiceView) find('#voice-button').onclick = toggleVoice;
  find('#draw-mode').onchange = event => { mode = event.target.value; reset(); };
  find('#draw-export').onclick = () => {
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([exportDrawing(store.read())], { type: 'image/svg+xml' })); link.download = 'agent-drawing.svg'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  // Canvas belongs to the application and survives switching back to the lesson.
  find('#draw-mode').value = mode;
  paint();
  const panes = [find('#drawing-chat'), find('#drawing-calls')];
  const resizeObserver = new ResizeObserver(() => {
    if (!root?.isConnected) return;
    for (const pane of panes) pane.scrollTop = pane.scrollHeight;
  });
  panes.forEach(pane => resizeObserver.observe(pane));
  const mounted = find('#draw-mode');
  fetch('/api/draw/status').then(response => { if (!response.ok) throw new Error('API unavailable'); return response.json(); }).then(status => {
    if (find('#draw-mode') !== mounted) return;
    checkingApi = false;
    liveAvailable = Boolean(status?.configured);
    const option = find('#draw-mode').querySelector('[value="live"]');
    option.disabled = !liveAvailable; option.textContent = liveAvailable ? 'Live' : 'Live · key needed';
    if (mode === 'live' && !liveAvailable) find('#draw-error').textContent = 'Live mode needs OPENAI_API_KEY on the server. Configure it and restart the server.';
    find('#draw-mode').value = mode; paint();
  }).catch(() => {
    if (find('#draw-mode') !== mounted) return;
    checkingApi = false; liveAvailable = false;
    if (mode === 'live') find('#draw-error').textContent = 'The drawing API is unavailable. Start the project server and reload.';
    paint();
  });
  return () => { voiceSession?.dispose(); voiceSession = null; session++; controller?.abort(); resizeObserver.disconnect(); busy = false; root = null; };
}
