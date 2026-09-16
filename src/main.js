import './style.css';
import { mountDrawer } from './drawer.js';
import example from '../examples/agent.mjs?raw';

const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
  rain: '<path d="M5 14a4 4 0 1 1 1-8 6 6 0 0 1 11-1 5 5 0 0 1 2 9H5Zm2 3-1 3m6-3-1 3m6-3-1 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v1m0 18v1M2 12h1m18 0h1M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16m10-16v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
  snacks: '<path d="m5 8 2 13h10l2-13ZM4 8h16M8 8V5a2 2 0 0 1 4 0V3a2 2 0 0 1 4 0v5M10 12v5m4-5v5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  replay: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
const slides = [
  ['From chat to action.', 'Understand AI agents, one step at a time.', 'intro'],
  ['It starts with language.', 'A model takes words in and generates words out.', 'text'],
  ['A few ideas came together.', '', 'history'],
  ['An API connects your code.', 'Send a message. Get a response.', 'api'],
  ['First, offer a tool.', 'A new example: can we watch outside in Portland?', 'define'],
  ['This response is a tool call.', 'A structured instruction for your code—not a text answer.', 'tool-call'],
  ['Your code runs the function.', 'This part happens in your application, outside the model.', 'execute'],
  ['Your code keeps the context.', 'Save the question, the model’s tool call, and the tool result.', 'context'],
  ['A completely new API call.', 'No memory between calls. Send the context again.', 'new-call'],
  ['Now the response is text.', 'Call 2 answers using the context you just sent.', 'answer'],
  ['The loop lives in your code.', 'Repeat if the next response asks for another tool.', 'loop'],
  ['That’s how an agent works.', 'A model chooses. Your code acts. Context connects the calls.', 'end'],
];
const history = [
  ['2017', 'Transformers', 'A new architecture became the foundation for modern language models.', 'https://arxiv.org/abs/1706.03762'],
  ['2020', 'The API', 'Developers could connect their software to GPT-3-family models.', 'https://openai.com/index/openai-api/'],
  ['2022', 'Reason + act', 'ReAct explored using actions and their results to guide a model’s next step.', 'https://arxiv.org/abs/2210.03629'],
  ['2023', 'Function calling', 'OpenAI made structured tool requests a feature of its API.', 'https://openai.com/index/function-calling-and-other-api-updates/'],
];
let step = 0, year = 0, weather = 'rain', phase = 0, running = false, generation = 0, exchangeRun = 0;
let executed = false, executing = false, contextSent = false, contextSending = false;
const $ = selector => document.querySelector(selector);
const stage = () => slides[step][2];
const forecast = () => weather === 'rain' ? 'Rain · 14°C' : 'Clear · 22°C';
const orb = (className = '') => `<div class="orb ${className}" role="img" aria-label="Language model"><div class="orb-core"></div></div>`;
const node = (symbol, label) => `<div class="node"><div class="node-icon">${icon(symbol)}</div><span>${label}</span></div>`;
const modelNode = label => `<div class="node">${orb()}<span>${label}</span></div>`;
const track = () => `<div class="message-track" aria-hidden="true"><i></i>${icon('arrow')}</div>`;
const toolCall = () => `<div class="tool-call-card"><span class="type-label tool-color">Tool call · #1</span><strong>get_weather</strong><div class="argument"><span>City</span><b>Portland</b></div></div>`;
const contextRows = () => `<div class="context-rows"><div class="context-row setup-row"><span>Instructions + tools</span><strong>Plan the night · get_weather(city)</strong></div><div class="context-row"><span>User</span><strong>“Inside or outside in Portland?”</strong></div><div class="context-row tool-row"><span>Model · call #1</span><strong>get_weather · Portland</strong></div><div class="context-row result-row"><span>Tool result · #1</span><strong>${forecast()}</strong></div></div>`;
const replay = () => `<button id="replay-exchange" class="text-button">${icon('replay')} Replay</button><span class="sr-only" id="exchange-status" role="status"></span>`;

function scene() {
  switch (stage()) {
    case 'intro': return `<div class="hero-orb">${orb('large')}</div>`;
    case 'text': return `<div class="conversation"><div class="bubble user">What should we do tonight?</div>${orb('small')}<div class="bubble response">How about a movie night?</div></div>`;
    case 'history': return `<div class="history-timeline"><div class="years" role="tablist" aria-label="Milestones">${history.map((h, i) => `<button role="tab" aria-selected="${year === i}" data-year="${i}" class="${year === i ? 'selected' : ''}">${h[0]}</button>`).join('')}</div><div class="history-detail" role="tabpanel"><h2>${history[year][1]}</h2><p>${history[year][2]}</p></div></div>`;
    case 'api': return `<div class="api-demo"><div class="round-trip">${node('code', 'Your code')}<div class="message-lanes"><div class="message-lane request-lane"><span class="message-label">Request</span><p>“Plan a movie night.”</p>${track()}</div><div class="message-lane response-lane" aria-hidden="true"><span class="message-label">Response · Text</span><p>“Let’s pick a film.”</p>${track()}</div></div>${modelNode('Model')}</div>${replay()}</div>`;
    case 'define': return `<div class="single-exchange forward"><div class="round-trip">${node('code', 'Your code')}<div class="message-lane request-lane"><span class="message-label">API call 1 · Request</span><p>“Inside or outside<br>in Portland?”</p><div class="offered-tool"><span>Available tool</span><strong>get_weather(city)</strong></div>${track()}</div>${modelNode('Model')}</div></div>`;
    case 'tool-call': return `<div class="single-exchange returning tool-exchange"><div class="round-trip">${node('code', 'Your code')}<div class="message-lane"><span class="message-label">API call 1 · Response</span>${toolCall()}${track()}</div>${modelNode('Model')}</div></div>`;
    case 'execute': return `<div class="execution-demo"><div class="weather-switch" aria-label="Demo forecast"><button data-weather="rain" aria-pressed="${weather === 'rain'}" class="${weather === 'rain' ? 'selected' : ''}">${icon('rain')} Rain</button><button data-weather="clear" aria-pressed="${weather === 'clear'}" class="${weather === 'clear' ? 'selected' : ''}">${icon('sun')} Clear</button></div><div class="round-trip execution-trip ${executing ? 'executing' : ''} ${executed ? 'executed' : ''}">${node('code', 'Your code')}<div class="execution-messages"><div class="message-lane"><span class="message-label tool-color">Run the requested function</span><p class="function-text">get_weather(“Portland”)</p>${track()}</div><div class="tool-observation ${executed ? 'visible' : ''}" ${executed ? '' : 'aria-hidden="true"'}><span class="message-label result-color">Tool result · #1</span><p>${forecast()}</p>${track()}</div></div>${node('rain', 'Weather API')}</div><button id="execute-tool" class="secondary" ${executing ? 'disabled' : ''}>${icon(executed ? 'replay' : 'play')}${executing ? 'Running…' : executed ? 'Run again' : 'Run tool'}</button></div>`;
    case 'context': return `<div class="context-demo">${contextRows()}</div>`;
    case 'new-call': return `<div class="new-call-demo ${contextSent ? 'sent' : ''} ${contextSending ? 'sending-context' : ''}"><div class="context-delivery"><div class="request-bundle"><span class="bundle-title">API call 2 · New request</span>${contextRows()}</div><div class="context-connector" aria-hidden="true">${track()}</div>${modelNode('Same model')}</div><div class="context-received ${contextSent ? 'visible' : ''}" role="status">${contextSent ? 'Context delivered to call 2.' : ''}</div><button id="send-context" class="secondary" ${contextSending ? 'disabled' : ''}>${icon(contextSent ? 'replay' : 'arrow')}${contextSending ? 'Sending…' : contextSent ? 'Send again' : 'Send new request'}</button></div>`;
    case 'answer': return `<div class="api-demo answer-demo"><div class="round-trip">${node('code', 'Your code')}<div class="message-lanes"><div class="message-lane request-lane"><span class="message-label">API call 2 · Request</span><p>Your context + ${weather === 'rain' ? 'rain' : 'clear skies'}</p>${track()}</div><div class="message-lane response-lane" aria-hidden="true"><span class="message-label">Response · Text</span><p>“${weather === 'rain' ? 'Let’s watch inside.' : 'Let’s watch outside.'}”</p>${track()}</div></div>${modelNode('Model')}</div>${replay()}</div>`;
    case 'loop': return `<div class="loop-demo"><div class="loop-steps">${[['code', 'API call', 'Tool call'], ['rain', 'Run tool', 'Tool result'], ['replay', 'New API call', 'Context + result']].map((v, i) => `<div class="loop-step ${phase > i ? 'done' : ''} ${running && phase === i ? 'working' : ''}"><div>${icon(phase > i ? 'check' : v[0])}</div><span>${v[1]}</span><b>${v[2]}</b></div>${i < 2 ? `<div class="loop-line ${phase > i ? 'done' : ''}"></div>` : ''}`).join('')}</div><div class="loop-output" aria-live="polite">${phase === 0 ? 'The application controls every step.' : phase === 1 ? 'The model returns a tool call.' : phase === 2 ? 'Your code executes it and saves the result.' : 'New API call: send earlier context + the tool result.'}</div><button id="run-loop" class="secondary" ${running ? 'disabled' : ''}>${icon(phase === 3 ? 'replay' : 'play')}${running ? 'Running…' : phase === 3 ? 'Replay' : 'Run the loop'}</button></div>`;
    case 'end': return `<div class="ending"><div class="formula"><span>Model</span><b>+</b><span>Tools</span><b>+</b><span>Context</span></div><div class="end-actions"><button id="download" class="secondary">${icon('download')} Get the code</button><button id="sources" class="text-button">Sources</button></div></div>`;
  }
}

function render() {
  const [title, description, type] = slides[step];
  $('#app').innerHTML = `<div class="reading-progress" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="${slides.length - 1}" aria-valuenow="${step}"><div style="transform:scaleX(${step / (slides.length - 1)})"></div></div><header><a href="#" id="home" class="brand" aria-label="Agent lab — restart lesson"><span class="brand-mark"></span>agent lab</a><a href="#draw" class="lesson-draw-link">Draw ↗</a></header><main><div class="lesson-copy"><h1 tabindex="-1">${title}</h1>${description ? `<p>${description}</p>` : ''}</div><section class="scene ${type}" aria-label="Interactive lesson">${scene()}</section><footer><button id="back" class="back" aria-label="Previous step" ${step === 0 ? 'disabled' : ''}>${icon('arrow')}</button><nav class="pagination" aria-label="Lesson pages">${slides.map((slide, index) => `<button data-page="${index}" aria-label="Page ${index + 1}: ${slide[0]}" ${index === step ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('')}</nav><button id="next" class="next">${step === 0 ? 'Begin' : step === slides.length - 1 ? 'Again' : 'Next'}${icon(step === slides.length - 1 ? 'replay' : 'arrow')}</button></footer></main><dialog id="detail" aria-labelledby="detail-title"><button id="close" aria-label="Close sources">${icon('close')}</button><h2 id="detail-title">Where it began.</h2><p>The lesson uses simulated data and shows your application sending conversation history explicitly. APIs can also store history for you; that history still becomes context for the next model call.</p><p>Message cards are simplified. Real requests preserve every model output item, instructions, and tool definitions. Tool results match calls by their call ID.</p><div class="sources">${history.map(h => `<a href="${h[3]}" target="_blank" rel="noreferrer">${h[0]} · ${h[1]} ↗</a>`).join('')}<a href="https://developers.openai.com/api/docs/guides/function-calling" target="_blank" rel="noreferrer">Function calling documentation ↗</a><a href="https://developers.openai.com/api/docs/guides/conversation-state" target="_blank" rel="noreferrer">Conversation state and stateless calls ↗</a></div></dialog>`;
  $('#next').onclick = () => navigate(step === slides.length - 1 ? 0 : step + 1);
  $('#back').onclick = () => navigate(step - 1);
  document.querySelectorAll('[data-page]').forEach(button => {
    button.onclick = () => navigate(+button.dataset.page);
  });
  const pagination = $('.pagination');
  const selectedPage = pagination.querySelector('[aria-current]');
  pagination.scrollLeft = selectedPage.offsetLeft - (pagination.clientWidth - selectedPage.offsetWidth) / 2;
  $('#home').onclick = e => { e.preventDefault(); navigate(0); };
  $('#close').onclick = () => $('#detail').close();
  $('#detail').onclick = e => { if (e.target === $('#detail')) $('#detail').close(); };
  bindScene();
}

function navigate(n) {
  if (['#draw', '#voice'].includes(location.hash)) return;
  generation++;
  running = false; executing = false; contextSending = false;
  phase = 0; executed = false; contextSent = false;
  step = Math.max(0, Math.min(slides.length - 1, n));
  render();
  $('h1').focus({ preventScroll: true });
}
function refreshScene(focusSelector) {
  $('.scene').innerHTML = scene(); bindScene();
  if (focusSelector) $(focusSelector)?.focus({ preventScroll: true });
}
function bindScene() {
  if ($('#replay-exchange')) { $('#replay-exchange').onclick = playExchange; playExchange(); }
  document.querySelectorAll('[data-year]').forEach(b => {
    b.onclick = () => { year = +b.dataset.year; refreshScene(`[data-year="${year}"]`); };
    b.onkeydown = e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); e.stopPropagation();
      year = (+b.dataset.year + (e.key === 'ArrowRight' ? 1 : 3)) % 4;
      refreshScene(`[data-year="${year}"]`);
    };
  });
  document.querySelectorAll('[data-weather]').forEach(b => b.onclick = () => {
    generation++; executing = false; executed = false;
    weather = b.dataset.weather; refreshScene(`[data-weather="${weather}"]`);
  });
  if ($('#execute-tool')) $('#execute-tool').onclick = executeTool;
  if ($('#send-context')) $('#send-context').onclick = sendContext;
  if ($('#run-loop')) $('#run-loop').onclick = run;
  if ($('#download')) $('#download').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([example], { type: 'text/javascript' }));
    a.download = 'agent.mjs'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  if ($('#sources')) $('#sources').onclick = () => $('#detail').showModal();
}
function playExchange() {
  const id = ++exchangeRun, navigation = generation, demo = $('.api-demo');
  demo.classList.remove('responding', 'sending');
  $('.response-lane').setAttribute('aria-hidden', 'true');
  $('#exchange-status').textContent = stage() === 'api' ? 'Your code sends the request: Plan a movie night.' : 'Your code sends a new API request with the earlier context and the tool result.';
  void demo.offsetWidth; demo.classList.add('sending');
  setTimeout(() => {
    if (id !== exchangeRun || navigation !== generation || !['api', 'answer'].includes(stage())) return;
    demo.classList.add('responding'); $('.response-lane').setAttribute('aria-hidden', 'false');
    $('#exchange-status').textContent = stage() === 'api' ? 'The model returns text: Let’s pick a film.' : `The model returns text: Let’s watch ${weather === 'rain' ? 'inside' : 'outside'}.`;
  }, 2400);
}
async function executeTool() {
  if (executing) return;
  const id = ++generation; executing = true; executed = false; refreshScene();
  await new Promise(resolve => setTimeout(resolve, 1500));
  if (id !== generation) return;
  executing = false; executed = true; refreshScene('#execute-tool');
}
async function sendContext() {
  if (contextSending) return;
  const id = ++generation; contextSending = true; contextSent = false; refreshScene();
  await new Promise(resolve => setTimeout(resolve, 1800));
  if (id !== generation) return;
  contextSending = false; contextSent = true; refreshScene('#send-context');
}
async function run() {
  if (running) return;
  const id = ++generation; phase = 0; running = true; refreshScene();
  for (let i = 1; i <= 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 1700));
    if (id !== generation) return;
    phase = i; if (i === 3) running = false; refreshScene();
  }
}
document.addEventListener('keydown', e => {
  if (['#draw', '#voice'].includes(location.hash)) return;
  if ($('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); navigate(step + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(step - 1); }
});
let touchStart;
document.addEventListener('touchstart', e => {
  if (['#draw', '#voice'].includes(location.hash)) { touchStart = null; return; }
  if (e.target.closest('button,a,dialog')) { touchStart = null; return; }
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!touchStart || $('dialog[open]')) return;
  const dx = e.changedTouches[0].clientX - touchStart.x, dy = e.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.7) navigate(step + (dx < 0 ? 1 : -1));
  touchStart = null;
}, { passive: true });
let unmountDrawer;
function route() {
  generation++;
  unmountDrawer?.();
  unmountDrawer = null;
  if (['#draw', '#voice'].includes(location.hash)) unmountDrawer = mountDrawer($('#app'), { voice: location.hash === '#voice' });
  else render();
}
window.addEventListener('hashchange', route);
route();
