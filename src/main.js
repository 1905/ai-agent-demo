import { mountDrawer } from './drawer.js';
import { settingsButton, mountSettings } from './settings.js';
import { lessonExample, createLessonFlow } from './lesson.js';
import { shapeMarkup } from './drawing-tools.js';
import { highlightJson } from './drawing-log.js';

const lessonFlow = createLessonFlow();

const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  replay: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
const slides = [
  ['Обычный ответ.', 'Модель получает текст и возвращает текст.', 'text'],
  ['Дадим модели инструмент.', 'В запросе есть сообщение и описание доступной функции.', 'define'],
  ['Модель возвращает вызов.', 'Это не текст: имя инструмента и параметры.', 'tool-call'],
  ['Функцию выполняет ваш код.', 'Круг нарисован — задача решена. Второй вызов модели не нужен.', 'execute'],
  ['Теперь нужны данные.', 'Другой инструмент возвращает погоду для ответа.', 'weather'],
  ['Модель запрашивает погоду.', 'Снова вызов инструмента. Ответа пользователю ещё нет.', 'weather-call'],
  ['Сервис возвращает JSON.', 'Данные на английском. Это ещё не ответ пользователю.', 'weather-run'],
  ['Обратно к ИИ.', 'Новый запрос: вопрос + вызов + JSON. Памяти между вызовами нет.', 'weather-result'],
  ['Теперь — понятный ответ.', 'Модель выбирает нужное из JSON и отвечает на языке вопроса.', 'answer'],
];
let step = 0, generation = 0;
let executed = false;
const $ = selector => document.querySelector(selector);
const stage = () => slides[step][2];
const canvasPreview = (visible = true) => `<svg class="lesson-canvas" viewBox="0 0 640 640" role="img" aria-label="${visible ? 'Красный круг' : 'Пустой холст'}">${visible ? shapeMarkup(lessonFlow.command.shape) : ''}</svg>`;
const avatars = {
  user: { name: 'Вы', path: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>' },
  ai: { name: 'ИИ', path: '<rect x="4" y="6" width="16" height="14" rx="4"/><path d="M12 3v3M2 11v5m20-5v5M9 16h6"/><path d="M8 11h1m6 0h1"/>' },
  code: { name: 'Ваш код', path: paths.code },
  tool: { name: 'Инструмент', path: '<path d="m14 6 4 4-8 8-4-4 8-8ZM4 20l2-6m4 4-6 2M14 6V3h7v7h-3"/>' },
};
const avatar = role => `<span class="lesson-avatar avatar-${role}" role="img" aria-label="${avatars[role].name}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${avatars[role].path}</svg></span>`;
const details = {
  text: { текст: lessonExample.textRequest },
  'text-answer': { ответ: lessonExample.textResponse },
  command: { текст: lessonExample.drawRequest, инструменты: [{ имя: 'draw_circle', описание: 'Рисует круг. Не возвращает данные.' }] },
  'command-call': { тип: 'вызов инструмента, не текст', вызвать: 'draw_circle', параметры: { цвет: 'красный' } },
  weather: { текст: lessonExample.weatherRequest, инструменты: [{ имя: 'get_weather', описание: 'Возвращает погоду в указанном городе.' }] },
  'weather-call': { тип: 'вызов инструмента, не текст', вызвать: 'get_weather', параметры: { город: 'Москва' } },
  'weather-result': { от_инструмента: 'get_weather', данные: lessonFlow.result, источник: 'Учебный пример, не текущий прогноз' },
  context: {
    новый_API_запрос: true,
    инструкции: 'Ответь на исходный вопрос по данным погоды. Используй язык пользователя.',
    инструменты: [{ имя: 'get_weather', описание: 'Возвращает погоду в указанном городе.' }],
    контекст: [
      { пользователь: lessonExample.weatherRequest },
      { модель: { вызов: 'get_weather', город: 'Москва', id: 'weather_1' } },
      { инструмент: { результат_для: 'weather_1', данные: lessonFlow.result } },
    ],
  },
  answer: { ответ: lessonExample.weatherResponse },
};
const more = key => `<button type="button" class="lesson-more" data-details="${key}" aria-haspopup="dialog">Подробнее ${icon('code')}</button>`;
const message = (label, content, key, kind = '') => {
  const role = ['text', 'command', 'weather'].includes(key) ? 'user' : ['text-answer', 'command-call', 'weather-call', 'answer'].includes(key) ? 'ai' : key === 'weather-result' ? 'tool' : 'code';
  return `<article class="lesson-chat-message ${kind}" data-speaker="${role}"><div class="lesson-chat-label"><div class="lesson-message-sender">${avatar(role)}<span><strong>${avatars[role].name}</strong><span class="lesson-message-type">${label}</span></span></div>${key ? more(key) : ''}</div>${content}</article>`;
};
const toolList = weather => `<div class="lesson-available-tool"><code>${weather ? 'get_weather' : 'draw_circle'}</code><span>${weather ? 'Возвращает погоду в городе' : 'Рисует круг без возврата данных'}</span></div>`;
const requestMessage = (weather = false) => message('Запрос · текст + инструмент', `<p>${weather ? lessonExample.weatherRequest : lessonExample.drawRequest}</p>${toolList(weather)}`, weather ? 'weather' : 'command');
const callMessage = weather => message('Ответ · вызов инструмента', `<p><code>${weather ? 'get_weather' : 'draw_circle'}</code><span class="lesson-call-argument">${weather ? 'город: Москва' : 'цвет: красный'}</span></p>`, weather ? 'weather-call' : 'command-call', 'tool-message');
const weatherJson = () => {
  const entries = Object.entries(lessonFlow.result);
  const lines = [];
  for (let i = 0; i < entries.length; i += 2) lines.push('  ' + highlightJson(Object.fromEntries(entries.slice(i, i + 2)), 0).slice(1, -1));
  return `<pre class="lesson-weather-json" aria-label="Данные сервиса погоды на английском"><code>{\n${lines.join(',\n')}\n}</code></pre>`;
};
const returnRequest = () => message('API-запрос 2 → ИИ', `<p class="lesson-original-question">${lessonExample.weatherRequest}</p><div class="lesson-carried-call"><span>Предыдущий вызов ИИ</span><strong>get_weather · Москва</strong></div><div class="lesson-return-data"><span>Результат инструмента</span>${weatherJson()}</div>`, 'context', 'return-request');
const chat = content => `<div class="lesson-chat">${content}</div>`;
const executionPanel = weather => `<section class="lesson-function-panel ${executed ? 'is-complete' : 'is-running'}" aria-label="Действие в приложении"><div class="lesson-function-header"><span>${icon('code')}Ваше приложение</span><span role="status">${executed ? 'Выполнено' : 'Выполняется…'}</span></div><div class="lesson-function-body"><span class="lesson-function-name">${weather ? 'get_weather' : 'draw_circle'}</span><div class="lesson-function-output" aria-live="polite">${weather ? executed ? `${weatherJson()}<span class="lesson-fixture">Учебные данные</span>` : '<span class="lesson-function-placeholder">Получаем погоду…</span>' : `<div class="lesson-drawn-result">${canvasPreview(executed)}<p>${executed ? 'Круг нарисован.' : 'Рисуем круг…'}</p></div>`}</div></div></section>`;

function scene() {
  switch (stage()) {
    case 'text': return chat(`${message('Запрос', `<p>${lessonExample.textRequest}</p>`, 'text')}${message('Ответ · текст', `<p>${lessonExample.textResponse}</p>`, 'text-answer', 'text-message chat-reply')}`);
    case 'define':
    case 'weather': return chat(requestMessage(stage() === 'weather'));
    case 'tool-call':
    case 'weather-call': {
      const weather = stage() === 'weather-call';
      return chat(`${requestMessage(weather)}${callMessage(weather)}`);
    }
    case 'execute':
    case 'weather-run': return executionPanel(stage() === 'weather-run');
    case 'weather-result': return chat(returnRequest());
    case 'answer': return chat(`${message('API-запрос 2 · с контекстом', `<p>${lessonExample.weatherRequest}</p><div class="lesson-available-tool"><span>+ вызов get_weather и его JSON</span></div>`, 'context')}${message('Ответ · текст', `<p>${lessonExample.weatherResponse}</p>`, 'answer', 'text-message chat-reply')}`);
  }
}

function render() {
  document.documentElement.lang = 'ru';
  const [title, description, type] = slides[step];
  $('#app').innerHTML = `<div class="reading-progress" role="progressbar" aria-label="Прогресс урока" aria-valuemin="0" aria-valuemax="${slides.length - 1}" aria-valuenow="${step}"><div style="transform:scaleX(${step / (slides.length - 1)})"></div></div><header class="lesson-header"><a href="#" id="home" class="brand" aria-label="Agent lab — начать урок заново"><span class="brand-mark"></span>agent lab</a><a href="#draw" class="lesson-draw-link">Рисовать ↗</a></header><main><div class="lesson-copy"><h1 tabindex="-1">${title}</h1><p>${description}</p></div><section class="lesson-stage ${type}" aria-label="Интерактивный урок">${scene()}</section><footer><button id="back" class="lesson-back" aria-label="Предыдущий шаг" ${step === 0 ? 'disabled' : ''}>${icon('arrow')}</button><nav class="lesson-pagination" aria-label="Страницы урока">${slides.map((slide, index) => `<button data-page="${index}" aria-label="Страница ${index + 1}: ${slide[0]}" ${index === step ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('')}</nav><button id="next" class="lesson-next">${step === slides.length - 1 ? 'Сначала' : 'Далее'}${icon(step === slides.length - 1 ? 'replay' : 'arrow')}</button></footer></main><dialog id="request-detail" class="lesson-json-dialog" aria-labelledby="request-detail-title"><div class="settings-heading"><h2 id="request-detail-title">Учебный JSON</h2><button type="button" class="settings-close" aria-label="Закрыть JSON">×</button></div><p>Упрощённая схема для объяснения, не формат API.</p><pre tabindex="0" aria-label="JSON для объяснения"><code></code></pre></dialog>`;
  const jsonDialog = $('#request-detail');
  jsonDialog.querySelector('button').onclick = () => jsonDialog.close();
  jsonDialog.onclick = event => {
    if (event.target !== jsonDialog) return;
    const rect = jsonDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) jsonDialog.close();
  };
  $('#next').onclick = () => navigate(step === slides.length - 1 ? 0 : step + 1);
  $('#back').onclick = () => navigate(step - 1);
  document.querySelectorAll('[data-page]').forEach(button => {
    button.onclick = () => navigate(+button.dataset.page);
  });
  const pagination = $('.lesson-pagination');
  const selectedPage = pagination.querySelector('[aria-current]');
  pagination.scrollLeft = selectedPage.offsetLeft - (pagination.clientWidth - selectedPage.offsetWidth) / 2;
  $('#home').onclick = e => { e.preventDefault(); navigate(0); };
  bindScene();
  $('.lesson-header').insertAdjacentHTML('beforeend', settingsButton);
  mountSettings($('#app'), { language: 'ru' });
}

function navigate(n) {
  if (['#draw', '#voice'].includes(location.hash)) return;
  generation++;
  executed = false;
  step = Math.max(0, Math.min(slides.length - 1, n));
  render();
  $('h1').focus({ preventScroll: true });
}

function bindScene() {
  document.querySelectorAll('[data-details]').forEach(button => {
    button.onclick = () => {
      $('#request-detail code').innerHTML = highlightJson(details[button.dataset.details]);
      $('#request-detail').showModal();
    };
  });
  const navigation = generation;
  const reply = $('.chat-reply');
  if (reply) {
    reply.setAttribute('aria-hidden', 'true');
    reply.inert = true;
    setTimeout(() => {
      if (navigation !== generation || !reply.isConnected) return;
      reply.classList.add('is-visible');
      reply.setAttribute('aria-hidden', 'false');
      reply.inert = false;
    }, 850);
  }
  if (['execute', 'weather-run'].includes(stage()) && !executed) {
    setTimeout(() => {
      if (navigation !== generation || !$('.lesson-function-panel')) return;
      executed = true;
      $('.lesson-stage').innerHTML = scene();
    }, 1000);
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
  document.documentElement.lang = ['#draw', '#voice'].includes(location.hash) ? 'en' : 'ru';
  if (['#draw', '#voice'].includes(location.hash)) unmountDrawer = mountDrawer($('#app'), { voice: location.hash === '#voice' });
  else render();
}
window.addEventListener('hashchange', route);
route();
