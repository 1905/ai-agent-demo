import { DEFAULT_THINKING_MODEL, thinkingModels, validThinkingModel, DEFAULT_REASONING_EFFORT, reasoningEfforts, validReasoningEffort } from './thinking-models.js';

let selectedModel = DEFAULT_THINKING_MODEL;
let selectedEffort = DEFAULT_REASONING_EFFORT;
try {
  const saved = localStorage.getItem('agent-lab-thinking-model');
  if (validThinkingModel(saved)) selectedModel = saved;
  const effort = localStorage.getItem('agent-lab-reasoning-effort');
  if (validReasoningEffort(effort)) selectedEffort = effort;
} catch { /* Storage may be disabled. Keep settings in memory. */ }

export const getThinkingModel = () => selectedModel;
export const getReasoningEffort = () => selectedEffort;
export const settingsButton = `<button type="button" class="settings-button" aria-label="Settings" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 3-.5 2a7 7 0 0 0-1.8 1L5.3 5.4 3 9.3l1.5 1.4a8 8 0 0 0 0 2.6L3 14.7l2.3 3.9 1.9-.6A7 7 0 0 0 9 19l.5 2h5l.5-2a7 7 0 0 0 1.8-1l1.9.6 2.3-3.9-1.5-1.4a8 8 0 0 0 0-2.6L21 9.3l-2.3-3.9-1.9.6A7 7 0 0 0 15 5l-.5-2Z"/><circle cx="12" cy="12" r="3"/></svg></button>`;

export function mountSettings(root, { language = 'en' } = {}) {
  const ru = language === 'ru';
  root.querySelector('.settings-button').setAttribute('aria-label', ru ? 'Настройки' : 'Settings');
  root.insertAdjacentHTML('beforeend', `<dialog class="settings-dialog" aria-labelledby="settings-title"><form method="dialog"><div class="settings-heading"><h2 id="settings-title">${ru ? 'Настройки' : 'Settings'}</h2><button class="settings-close" aria-label="${ru ? 'Закрыть настройки' : 'Close settings'}" value="close">×</button></div><label for="thinking-model">${ru ? 'Модель для рассуждений' : 'Thinking model'}</label><select id="thinking-model" aria-describedby="thinking-model-note">${thinkingModels.map(model => `<option value="${model.id}">${model.label}</option>`).join('')}</select><p id="thinking-model-note">${ru ? 'Для чата и голоса. Применяется к следующему сообщению или голосовому сеансу.' : 'For Chat and Voice. Applies to your next message or voice session.'}</p><button class="settings-done" value="done">${ru ? 'Готово' : 'Done'}</button></form></dialog>`);
  const dialog = root.querySelector('.settings-dialog');
  const effortLabels = ru ? ['Низкий', 'Средний', 'Высокий', 'Очень высокий', 'Максимальный'] : ['Low', 'Medium', 'High', 'Extra high', 'Maximum'];
  dialog.querySelector('#thinking-model-note').insertAdjacentHTML('beforebegin', `<label class="reasoning-effort-label" for="reasoning-effort">${ru ? 'Уровень рассуждений' : 'Reasoning effort'}</label><select id="reasoning-effort">${reasoningEfforts.map((effort, index) => `<option value="${effort}">${effortLabels[index]}</option>`).join('')}</select>`);
  const effortSelect = dialog.querySelector('#reasoning-effort');
  effortSelect.value = selectedEffort;
  effortSelect.onchange = () => {
    if (!validReasoningEffort(effortSelect.value)) return;
    selectedEffort = effortSelect.value;
    try { localStorage.setItem('agent-lab-reasoning-effort', selectedEffort); } catch {}
  };
  const select = dialog.querySelector('select');
  select.value = selectedModel;
  select.onchange = () => {
    if (!validThinkingModel(select.value)) return;
    selectedModel = select.value;
    try { localStorage.setItem('agent-lab-thinking-model', selectedModel); } catch {}
  };
  root.querySelector('.settings-button').onclick = () => dialog.showModal();
  dialog.onclick = event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  };
}
