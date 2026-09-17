import { createDrawingStore, shapeMarkup, exportDrawing, COLORS, MAX_MODEL_CALLS } from './drawing-tools.js';
import { captureCanvas, toolOutput } from './drawing-canvas.js';
import { artworkTools } from './artwork-tools.js';
import { renderArtwork } from './drawing-artwork.js';
import { mountApiLog, resetApiLog, requestDrawing, logVoiceEvent } from './drawing-log.js';
import { VoiceSession } from './voice/session.js';
import { mountVoiceBubble } from './voice/bubble.js';
import { themeTools } from './theme-tools.js';
import { executeThemeTool, bindThemeControls } from './site-theme.js';
import { getThinkingModel, getReasoningEffort, settingsButton, mountSettings } from './settings.js';
import { getEnabledTools, mountToolSettings } from './tool-settings.js';
import { renderChatMessage } from './chat-message.js';
import { thinkingModels } from './thinking-models.js';

const store = createDrawingStore();
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const micIcon = muted => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6"/>${muted ? '<path d="m3 3 18 18"/>' : ''}</svg>`;
let root, busy = false, session = 0, controller, activeChatModel, liveAvailable = false, checkingApi = true;
let transcript = [], messages = [], events = [], requestCount = 0, nextCall = 0;
let voiceView = false, voiceSession, drawingController, animationController, nativeCanvas, nativeCapture, drawingError, modelActivity;
const colorName = hex => Object.entries(COLORS).find(([, value]) => value === hex)?.[0] || hex;
const find = selector => root?.querySelector(selector);

const durationText = ms => ms < 1 ? '<1 ms' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
function timingLabel(event) {
  const elapsed = durationText(event.durationMs ?? performance.now() - event.started);
  return `${event.status === 'generating' ? 'Generating · ' : event.status === 'running' ? 'Running · ' : event.status === 'cancelled' ? 'Cancelled · ' : event.status === 'error' ? 'Failed · ' : ''}${elapsed}${(event.generationMs != null || event.status === 'done') && !['generating', 'running'].includes(event.status) ? ' total' : ''}`;
}
function startTool(call, started = performance.now()) {
  if (events.some(event => event.id === call.call_id)) return;
  events.push({ id: call.call_id, name: call.name, started, status: 'generating' });
  modelActivity = null; paint();
}
function cancelPending(status = 'cancelled') {
  modelActivity = null;
  for (const event of events) if (['generating', 'running'].includes(event.status)) {
    event.status = status; event.durationMs = performance.now() - event.started;
  }
}
function paintTimers() {
  for (const row of root?.querySelectorAll('[data-call-id]') || []) {
    const event = events.find(item => item.id === row.dataset.callId);
    if (event) row.querySelector('.tool-duration').textContent = timingLabel(event);
  }
  const timer = find('.model-activity .tool-duration');
  if (timer && modelActivity) timer.textContent = durationText(performance.now() - modelActivity.started);
}
function showDrawingError(error, event) {
  drawingError = `JavaScript error: ${error.message}. Send a new message to retry.`;
  find('#draw-error').textContent = drawingError;
  if (event) { event.status = 'error'; event.result = { error: error.message, retryByUser: true }; }
  if (busy) controller?.abort();
  paint();
}
async function startNativeScene(code, control, event) {
  const canvas = document.createElement('iframe');
  canvas.title = 'Animated JavaScript drawing';
  canvas.className = 'drawing-native-canvas';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Animated JavaScript drawing');
  canvas.style.visibility = 'hidden';
  find('.canvas-surface').append(canvas);
  try {
    let capture;
    const artwork = await renderArtwork('draw_js', { code }, control.signal, { surface: canvas, onReady: runtime => { capture = runtime.capture; }, onError: error => {
      if (animationController === control && !control.signal.aborted) { store.setArtworkError(error.message); showDrawingError(error, event); }
    } });
    if (control.signal.aborted) throw new Error('Drawing cancelled.');
    animationController?.abort(); nativeCanvas?.remove();
    animationController = control; nativeCanvas = canvas; nativeCapture = capture;
    canvas.style.visibility = '';
    return artwork;
  } catch (error) { canvas.remove(); throw error; }
}
function resultText(result) {
  if (result.error) return result.error;
  if (result.action === 'drawn') return 'Drawing updated.';
  if (result.view && result.imageUrl) return 'Page screenshot captured.';
  if (result.action === 'theme_updated') return 'Theme updated.';
  if (result.action === 'theme_reset') return 'Original theme restored.';
  if (result.css) return 'Site stylesheet read.';
  if (result.imageUrl) return result.artwork ? 'Drawing checked.' : `Canvas checked. ${result.shapes.length} ${result.shapes.length === 1 ? 'shape' : 'shapes'}.`;
  if (result.artwork) return 'Drawing source read.';
  if (result.shapes) return result.shapes.length ? result.shapes.map(shape => `${shape.id} · ${colorName(shape.fill)} ${shape.shape}`).join(' / ') : 'Canvas is empty';
  return `${result.shape.id} ${result.action} · ${colorName(result.shape.fill)}`;
}
function paint() {
  if (!root?.isConnected) return;
  find('#drawing-chat').innerHTML = messages.length ? messages.map(message => `<div class="chat-message ${message.role}"><span>${message.role === 'user' ? 'You' : 'Agent'}</span>${renderChatMessage(message.text)}</div>`).join('') : '';
  find('#drawing-calls').innerHTML = events.map(event => `<article class="tool-entry ${escape(event.name)} ${event.status}" data-call-id="${escape(event.id)}"${event.status === 'error' ? ' aria-label="Tool failed"' : ''}><h3>${escape(event.name)}</h3><span class="tool-duration" title="${event.executionMs == null ? (event.status === 'done' ? 'Total time until the tool result was sent' : 'Waiting for the model to finish the tool arguments') : `Model + transfer: ${durationText(event.generationMs || 0)}; execution: ${durationText(event.executionMs)}`}">${escape(timingLabel(event))}</span></article>`).join('') + (modelActivity ? '<div class="tool-entry model-activity" role="status"><h3>Thinking…</h3><span class="tool-duration"></span></div>' : '');
  paintTimers();
  const snapshot = store.read();
  // Preserve SVG nodes so changing a fill visibly updates the same circle.
  const layer = find('#shape-layer');
  for (const node of [...layer.children]) if (!snapshot.shapes.some(shape => shape.id === node.dataset.shapeId)) node.remove();
  let artwork = find('#artwork-layer');
  if (snapshot.artwork?.type === 'svg') {
    if (!artwork) {
      artwork = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      artwork.id = 'artwork-layer'; artwork.setAttribute('width', '640'); artwork.setAttribute('height', '640');
      layer.before(artwork);
    }
    if (artwork.getAttribute('href') !== snapshot.artwork.imageUrl) artwork.setAttribute('href', snapshot.artwork.imageUrl);
  } else artwork?.remove();
  find('#drawing-svg').style.display = snapshot.artwork?.type === 'js' ? 'none' : '';
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
  find('#draw-export').disabled = (snapshot.shapes.length === 0 && !snapshot.artwork) || (snapshot.artwork?.type === 'js' && !nativeCapture);
  find('#draw-export').textContent = snapshot.artwork?.type === 'js' ? 'Save PNG ↓' : 'Save SVG ↓';
  const unavailable = !liveAvailable || checkingApi;
  find('#draw-send').disabled = busy || unavailable;
  find('#draw-prompt').disabled = busy;
  const model = voiceView && voiceSession && voiceSession.state !== 'idle' ? voiceSession.model : busy ? activeChatModel : getThinkingModel();
  const label = thinkingModels.find(item => item.id === model)?.label || model;
  find('#current-model').textContent = label;
  find('#current-model').title = `Thinking model: ${model}`;
  find('#current-model').setAttribute('aria-label', `Current model: ${label}`);
  find('#draw-status').textContent = voiceView ? '' : busy ? 'Working…' : checkingApi ? 'Connecting to API…' : !liveAvailable ? 'API unavailable' : `${requestCount} API ${requestCount === 1 ? 'call' : 'calls'}`;
  if (voiceView) {
    const state = voiceSession?.state || 'idle';
    const mic = find('#voice-mic-toggle');
    const muted = Boolean(voiceSession?.micMuted);
    mic.hidden = state !== 'listening';
    mic.disabled = state !== 'listening';
    mic.setAttribute('aria-pressed', String(!muted));
    mic.title = muted ? 'Turn microphone on' : 'Turn microphone off';
    mic.innerHTML = micIcon(muted);
    find('#voice-button').disabled = unavailable || state === 'stopping';
    find('#voice-button').dataset.state = state;
    find('#voice-button').setAttribute('aria-label', state === 'idle' ? 'Start voice' : 'Stop voice');
    find('#voice-state').textContent = { idle: 'Start voice', connecting: 'Connecting…', listening: muted ? 'Mic off' : 'Listening', stopping: 'Stopping…' }[state];
  }
  for (const selector of ['#drawing-chat', '#drawing-calls']) { const pane = find(selector); pane.scrollTop = pane.scrollHeight; }
}

async function execute(call, token, enabledTools) {
  if (token !== session) return null;
  let args;
  try { args = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments; }
  catch { args = null; }
  const invalidArgs = !args || typeof args !== 'object' || Array.isArray(args);
  if (invalidArgs) args = {};
  const started = performance.now();
  let event = events.find(item => item.id === call.call_id);
  if (!event) { event = { id: call.call_id || `call-${++nextCall}`, name: call.name, started }; events.push(event); }
  event.args = args; event.generationMs = started - event.started; event.status = 'running'; paint();
  try {
    if (invalidArgs) throw new Error('Tool arguments must be an object.');
    if (!enabledTools.includes(call.name)) throw new Error(`${call.name} is disabled in Tool settings.`);
    if (call.name === 'draw_js' && drawingError) throw new Error('Send a new message to retry the JavaScript drawing.');
    if (themeTools.some(tool => tool.name === call.name)) event.result = await executeThemeTool(call.name, args, () => token === session);
    else if (artworkTools.some(tool => tool.name === call.name)) {
      drawingController = new AbortController();
      const control = drawingController;
      const artwork = call.name === 'draw_js'
        ? await startNativeScene(args.code, control, event)
        : await renderArtwork(call.name, args, control.signal, {}, store.read().artwork?.svg);
      if (token !== session) return null;
      if (artwork.type !== 'js') { animationController?.abort(); animationController = null; nativeCanvas?.remove(); nativeCanvas = null; }
      event.result = store.replaceArtwork(artwork);
    }
    else {
      event.result = store.execute(call.name, args);
      if (call.name === 'read_canvas') event.result.imageUrl = await captureCanvas(event.result);
      if (event.result.artwork) delete event.result.artwork.imageUrl;
    }
    event.status = 'done';
  }
  catch (error) {
    event.result = { error: error.message }; event.status = 'error';
    if (token === session && call.name === 'draw_js') showDrawingError(error, event);
  }
  if (token !== session) return null;
  event.executionMs = performance.now() - started;
  event.durationMs = performance.now() - event.started;
  paint();
  return event.result;
}

async function submit(text) {
  text = text.trim();
  if (!text || busy) return;
  if (!liveAvailable || checkingApi) { find('#draw-error').textContent = checkingApi ? 'The API connection is still loading.' : 'Configure the server API key to use Chat.'; return; }
  if (text.length > 2000) { find('#draw-error').textContent = 'Keep the message under 2,000 characters.'; return; }
  const token = session;
  const model = getThinkingModel();
  activeChatModel = model;
  const reasoningEffort = getReasoningEffort();
  const enabledTools = getEnabledTools();
  busy = true; drawingError = null; find('#draw-error').textContent = ''; find('#draw-prompt').value = '';
  messages.push({ role: 'user', text }); paint();
  try {
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
      const requestStarted = performance.now();
      modelActivity = { started: requestStarted };
      requestCount++; paint();
      const data = await requestDrawing(transcript, controller.signal, model, reasoningEffort, enabledTools, progress => {
        if (token === session && progress.type === 'tool.started') startTool(progress.call, requestStarted);
      });
      if (token !== session) return;
      modelActivity = null;
      transcript.push(...data.inputItems);
      const calls = data.calls;
      for (const call of calls) startTool(call, requestStarted);
      if (!calls.length) {
        const lastResult = events.slice(turnEventStart).filter(event => event.result).at(-1)?.result;
        const toolSummary = lastResult ? resultText(lastResult) : '';
        messages.push({ role: 'assistant', text: data.text?.trim() ? data.text : toolSummary || 'The model returned no text.' });
        completed = true; break;
      }
      for (const call of calls) {
        const result = await execute(call, token, enabledTools);
        if (token !== session) return;
        transcript.push({ type: 'function_call_output', call_id: call.call_id, output: toolOutput(result) });
        if (result.retryByUser) return;
      }
    }
    if (!completed) throw new Error(`Stopped after ${MAX_MODEL_CALLS} model calls. Try a shorter instruction.`);
  } catch (error) {
    if (token !== session) return;
    cancelPending(error.name === 'AbortError' ? 'cancelled' : 'error');
    find('#draw-error').textContent = drawingError || (error.name === 'AbortError' ? 'Request cancelled.' : error.message);
  } finally {
    if (token === session) { cancelPending(); busy = false; paint(); find('#draw-prompt')?.focus(); }
  }
}

function reset() {
  voiceSession?.dispose(); voiceSession = null;
  session++; controller?.abort(); drawingController?.abort(); animationController?.abort(); busy = false; store.reset(); transcript = []; messages = []; events = []; requestCount = 0; nextCall = 0;
  modelActivity = null;
  nativeCanvas?.remove(); nativeCanvas = null; drawingError = null;
  resetApiLog();
  if (voiceView) find('#voice-caption').textContent = '';
  find('#shape-layer').innerHTML = ''; find('#draw-error').textContent = ''; paint(); find('#draw-prompt').focus();
}

function toggleVoice() {
  if (voiceSession && voiceSession.state !== 'idle') { session++; drawingController?.abort(); cancelPending(); voiceSession.stop(); return; }
  find('#draw-error').textContent = '';
  const mounted = root;
  let caption = '', speaker = '';
  const enabledTools = getEnabledTools(true);
  const current = () => root === mounted && voiceSession === connection;
  const connection = new VoiceSession({
    model: getThinkingModel(),
    reasoningEffort: getReasoningEffort(),
    enabledTools,
    executeTool: async call => {
      const token = session;
      const result = await execute(call, token, enabledTools);
      return token === session && result ? { output: toolOutput(result), failed: Boolean(result.error) } : null;
    },
    onState: state => {
      if (!current()) return;
      if (state === 'idle') { cancelPending(); caption = ''; find('#voice-caption').textContent = ''; }
      paint();
    },
    onError: message => { if (current()) find('#draw-error').textContent = message; },
    onTranscript: (role, delta) => {
      if (!current()) return;
      if (role === 'user') { drawingError = null; find('#draw-error').textContent = ''; }
      if (role !== speaker || caption.length > 300) caption = '';
      speaker = role; caption += delta;
      find('#voice-caption').textContent = caption;
    },
    onEvent: (direction, event) => {
      if (!current()) return;
      logVoiceEvent(direction, event);
      // Voice handles end_conversation internally; its acknowledged result completes the row.
      if (direction === 'request' && event.type === 'response.item.create' && event.item?.type === 'function_call_output') {
        const tool = events.find(item => item.id === event.item.call_id);
        if (tool?.status === 'generating') { tool.status = 'done'; tool.durationMs = performance.now() - tool.started; }
      }
      const response = event.event;
      if (response?.type === 'response.created') modelActivity = { started: performance.now() };
      if (response?.type === 'response.output_item.added' && response.item?.type === 'function_call') startTool(response.item, modelActivity?.started);
      if (['response.completed', 'response.failed', 'response.incomplete'].includes(response?.type)) modelActivity = null;
      if (['response.failed', 'response.incomplete'].includes(response?.type) || ['error', 'voice.failure'].includes(event.type)) cancelPending();
      paint();
    },
    onLevel: level => { if (current()) find('#voice-button').style.setProperty('--voice-level', level); },
  });
  voiceSession = connection;
  connection.start();
}

export function mountDrawer(container, options = {}) {
  root = container;
  voiceView = options.voice === true;
  checkingApi = true;
  root.innerHTML = `<header class="workspace-header"><a href="#" class="brand"><span class="brand-mark"></span>agent lab</a><nav class="view-tabs" aria-label="Views"><a href="#">Lesson</a><a href="#draw" ${voiceView ? '' : 'aria-current="page"'}>Chat</a><a href="#voice" ${voiceView ? 'aria-current="page"' : ''}>Voice</a></nav><span id="current-model" class="current-model" aria-live="polite"></span></header><main class="workspace-page"><div class="workspace-heading"><h1>${voiceView ? 'Voice' : 'Draw'}</h1><div class="workspace-actions"><button class="theme-reset-button" type="button" data-reset-theme>Reset theme</button><button id="draw-reset" class="reset-canvas-button" type="button">Reset canvas</button></div></div><div class="workspace-columns"><section class="chat-panel" aria-labelledby="chat-title"><div class="panel-heading"><h2 id="chat-title">${voiceView ? 'Voice' : 'Chat'}</h2>${arrow}</div><div id="drawing-chat" ${voiceView ? 'hidden' : ''} class="panel-scroll" role="log" aria-label="Conversation"></div>${voiceView ? `<div class="voice-panel"><div id="voice-bubble" class="agent-voice"></div><div class="voice-controls"><button type="button" id="voice-button" class="voice-toggle" aria-label="Start voice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6"/></svg></button><span id="voice-state" role="status">Start voice</span></div><p id="voice-caption" class="voice-caption" aria-live="polite"></p></div>` : ''}<form id="draw-form" class="chat-form" ${voiceView ? 'hidden' : ''}><label class="sr-only" for="draw-prompt">Tell the agent what to draw</label><textarea id="draw-prompt" class="chat-input" rows="2" maxlength="2000" placeholder="Draw a red circle…"></textarea><button id="draw-send" class="send-button" type="submit" aria-label="Send message">${arrow}</button></form><p id="draw-error" role="alert"></p></section><section class="tool-panel" aria-labelledby="calls-title"><div class="panel-heading"><h2 id="calls-title">Tool calls</h2>${arrow}</div><div id="drawing-calls" class="panel-scroll" role="log" aria-label="Tool calls"></div><span id="draw-status" class="workspace-status"></span></section><section class="canvas-panel" aria-labelledby="canvas-title"><div class="panel-heading"><h2 id="canvas-title">Drawing</h2><button id="draw-export" class="export-button" type="button">Save SVG ↓</button></div><div class="canvas-surface"><svg id="drawing-svg" viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your SVG drawing"><g id="shape-layer"></g></svg></div></section></div><section id="api-log" class="api-log" aria-label="Raw API log"></section></main>`;
  mountApiLog(find('#api-log'));
  find('.workspace-header').insertAdjacentHTML('beforeend', settingsButton);
  if (voiceView) {
    find('.settings-button').insertAdjacentHTML('beforebegin', `<button id="voice-mic-toggle" type="button" class="mic-toggle-button" aria-label="Microphone" aria-pressed="true" hidden disabled>${micIcon(false)}</button>`);
    find('#voice-mic-toggle').onclick = () => {
      voiceSession?.setMicMuted(!voiceSession.micMuted);
      paint();
    };
  }
  const unmountSettings = mountSettings(root, { onChange: paint, voiceConnected: () => Boolean(voiceSession && voiceSession.state !== 'idle') });
  mountToolSettings(root, { voice: voiceView, voiceConnected: () => Boolean(voiceSession && voiceSession.state !== 'idle') });
  bindThemeControls();
  find('#draw-form').onsubmit = event => { event.preventDefault(); submit(find('#draw-prompt').value); };
  find('#draw-prompt').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(event.currentTarget.value); } };
  find('#draw-reset').onclick = reset;
  if (voiceView) find('#voice-button').onclick = toggleVoice;
  const unmountBubble = voiceView ? mountVoiceBubble(find('#voice-bubble'), () => voiceSession) : null;
  find('#draw-export').onclick = async () => {
    try {
      const snapshot = store.read();
      const png = snapshot.artwork?.type === 'js';
      const link = document.createElement('a');
      link.href = png ? await nativeCapture() : URL.createObjectURL(new Blob([exportDrawing(snapshot)], { type: 'image/svg+xml' }));
      link.download = `agent-drawing.${png ? 'png' : 'svg'}`; link.click();
      if (!png) setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) { find('#draw-error').textContent = error.message; }
  };
  // Chat and Voice share the drawing store.
  paint();
  const timer = setInterval(paintTimers, 100);
  const savedArtwork = store.read().artwork;
  if (savedArtwork?.type === 'js' && savedArtwork.error) {
    showDrawingError(new Error(savedArtwork.error));
  } else if (savedArtwork?.type === 'js') {
    const control = new AbortController();
    drawingController = control;
    startNativeScene(savedArtwork.code, control).then(() => { if (!control.signal.aborted) paint(); }).catch(error => {
      if (!control.signal.aborted) showDrawingError(error);
    });
  }
  const panes = [find('#drawing-chat'), find('#drawing-calls')];
  const resizeObserver = new ResizeObserver(() => {
    if (!root?.isConnected) return;
    for (const pane of panes) pane.scrollTop = pane.scrollHeight;
  });
  panes.forEach(pane => resizeObserver.observe(pane));
  const mounted = find('#current-model');
  fetch('/api/draw/status').then(response => { if (!response.ok) throw new Error('API unavailable'); return response.json(); }).then(status => {
    if (find('#current-model') !== mounted) return;
    checkingApi = false;
    liveAvailable = Boolean(status?.configured);
    if (!liveAvailable) find('#draw-error').textContent = 'Set OPENAI_API_KEY on the server, then restart it.';
    paint();
  }).catch(() => {
    if (find('#current-model') !== mounted) return;
    checkingApi = false; liveAvailable = false;
    find('#draw-error').textContent = 'The drawing API is unavailable. Start the project server and reload.';
    paint();
  });
  return () => { clearInterval(timer); cancelPending(); unmountSettings(); unmountBubble?.(); voiceSession?.dispose(); voiceSession = null; session++; controller?.abort(); drawingController?.abort(); animationController?.abort(); nativeCanvas?.remove(); nativeCapture = null; resizeObserver.disconnect(); busy = false; root = null; };
}
