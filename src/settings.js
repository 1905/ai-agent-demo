import { DEFAULT_THINKING_MODEL, thinkingModels, validThinkingModel } from './thinking-models.js';

let selectedModel = DEFAULT_THINKING_MODEL;
try {
  const saved = localStorage.getItem('agent-lab-thinking-model');
  if (validThinkingModel(saved)) selectedModel = saved;
} catch { /* Storage may be disabled. Keep settings in memory. */ }

export const getThinkingModel = () => selectedModel;
export const settingsButton = `<button type="button" class="settings-button" aria-label="Settings" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 3-.5 2a7 7 0 0 0-1.8 1L5.3 5.4 3 9.3l1.5 1.4a8 8 0 0 0 0 2.6L3 14.7l2.3 3.9 1.9-.6A7 7 0 0 0 9 19l.5 2h5l.5-2a7 7 0 0 0 1.8-1l1.9.6 2.3-3.9-1.5-1.4a8 8 0 0 0 0-2.6L21 9.3l-2.3-3.9-1.9.6A7 7 0 0 0 15 5l-.5-2Z"/><circle cx="12" cy="12" r="3"/></svg></button>`;

export function mountSettings(root) {
  root.insertAdjacentHTML('beforeend', `<dialog class="settings-dialog" aria-labelledby="settings-title"><form method="dialog"><div class="settings-heading"><h2 id="settings-title">Settings</h2><button class="settings-close" aria-label="Close settings" value="close">×</button></div><label for="thinking-model">Thinking model</label><select id="thinking-model" aria-describedby="thinking-model-note">${thinkingModels.map(model => `<option value="${model.id}">${model.label}</option>`).join('')}</select><p id="thinking-model-note">For Chat and Voice. Applies to your next message or voice session.</p><button class="settings-done" value="done">Done</button></form></dialog>`);
  const dialog = root.querySelector('.settings-dialog');
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
