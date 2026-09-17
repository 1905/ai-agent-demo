// Historical milestones, not a claim about the first invention of tool use.
// Dates and sources: docs/tool-calling-history.md.
export const historySlides = [
  ['Первый ChatGPT. Только текст.', 'В стартовой версии — без браузера, запуска кода и вызовов инструментов.', 'history-chat'],
  ['А исследования начались раньше.', 'Ещё в 2021 году WebGPT искал в интернете и собирал источники для ответа.', 'history-web'],
  ['А если научить выбирать?', 'Toolformer обучали выбирать API: калькулятор, поиск, перевод и другие инструменты.', 'history-tools'],
  ['Вызов функции — часть API.', 'OpenAI добавляет function calling: модель возвращает имя функции и аргументы.', 'history-api'],
];

export const historyDates = {
  'history-chat': '30 ноября 2022 · ChatGPT',
  'history-web': 'Декабрь 2021 · WebGPT',
  'history-tools': 'Февраль 2023 · Toolformer',
  'history-api': '13 июня 2023 · OpenAI',
};

export function historyScene(stage, avatar) {
  const bubble = (role, text, extra = '') => `<div class="history-message ${extra}">${avatar(role)}<span>${text}</span></div>`;
  if (stage === 'history-chat') return `<div class="history-visual history-text-only" data-phase="0">
    ${bubble('user', 'Какая сейчас погода в Москве?', 'history-prompt')}
    ${bubble('ai', 'Не могу проверить погоду в реальном времени.', 'history-outcome')}
  </div>`;
  if (stage === 'history-web') return `<div class="history-visual history-browser-demo" data-phase="0">
    ${bubble('ai', 'Найти информацию', 'history-prompt')}
    <div class="history-browser history-action" aria-label="Браузер читает найденную страницу">
      <div class="history-browser-bar"><span class="history-browser-dots" aria-hidden="true">● ● ●</span><span>Браузер</span></div>
      <div class="history-document" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="history-scan"></span></div>
    </div>
    ${bubble('ai', 'Ответ + источники', 'history-outcome')}
  </div>`;
  if (stage === 'history-tools') return `<div class="history-visual history-calculator-demo" data-phase="0">
    ${bubble('user', '247 × 38 = ?', 'history-prompt')}
    <div class="history-tool-choice"><span>Поиск</span><span class="history-chosen-tool">Калькулятор</span><span>Перевод</span></div>
    <div class="history-calculator history-action"><span>247 × 38</span><strong data-calculation>…</strong></div>
    ${bubble('ai', '9 386', 'history-outcome')}
  </div>`;
  return `<div class="history-visual history-api-demo" data-phase="0">
    ${bubble('user', 'Нарисуй красный круг', 'history-prompt')}
    <div class="history-message history-function-call">${avatar('ai')}<div><span>Вызов функции</span><strong>draw_circle</strong><span class="history-call-argument">цвет: красный</span></div></div>
    <div class="history-app history-action"><span>Ваш код выполняет</span><svg viewBox="0 0 160 100" role="img" aria-label="Нарисованный красный круг"><circle cx="80" cy="50" r="32" fill="#ef5350"/></svg></div>
  </div>`;
}

// One short sequence per visit. Stop timers and animations when the slide leaves.
export function animateHistory(root) {
  if (!root) return () => {};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const timers = [], animations = [];
  const setPhase = phase => {
    root.dataset.phase = String(phase);
    const calculation = root.querySelector('[data-calculation]');
    if (calculation && phase >= 2) calculation.textContent = (247 * 38).toLocaleString('ru-RU');
  };
  const stop = () => {
    timers.forEach(clearTimeout);
    animations.forEach(animation => animation.cancel());
  };
  const settle = () => { stop(); setPhase(3); };
  if (reducedMotion.matches) setPhase(3);
  else {
    timers.push(setTimeout(() => {
      setPhase(1);
      const scan = root.querySelector('.history-scan');
      if (scan) animations.push(scan.animate([{ top: '0%' }, { top: '100%' }], { duration: 1200, easing: 'ease-in-out' }));
    }, 450));
    timers.push(setTimeout(() => {
      setPhase(2);
    }, 1700));
    timers.push(setTimeout(() => setPhase(3), 2850));
  }
  reducedMotion.addEventListener('change', settle);
  return () => { stop(); reducedMotion.removeEventListener('change', settle); };
}
