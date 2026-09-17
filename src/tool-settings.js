import { allAgentTools, selectAgentTools } from './agent-tools.js';

const storageKey = 'agent-lab-enabled-tools';
const voiceStorageKey = 'agent-lab-voice-enabled-tools';
let enabledTools = allAgentTools.map(tool => tool.name);
let voiceEnabledTools = allAgentTools.map(tool => tool.name);
try {
  const saved = localStorage.getItem(storageKey);
  if (saved !== null) {
    const previous = JSON.parse(saved);
    // Remove retired tools without turning the user's other tools back on.
    enabledTools = selectAgentTools(Array.isArray(previous) ? previous.filter(name => allAgentTools.some(tool => tool.name === name)) : previous, true).map(tool => tool.name);
  }
} catch { /* Keep all tools enabled if saved settings cannot be read. */ }
try {
  const saved = localStorage.getItem(voiceStorageKey);
  if (saved !== null) voiceEnabledTools = selectAgentTools(JSON.parse(saved), true).map(tool => tool.name);
} catch { /* Voice starts with all tools; it never inherits Chat's disabled tools. */ }

export const getEnabledTools = (voice = false) => [...(voice ? voiceEnabledTools : enabledTools)];
export const toolSettingsButton = `<button type="button" class="tool-settings-button" aria-label="Tool settings" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--background, #0c0d0f)"/><circle cx="15" cy="17" r="3" fill="var(--background, #0c0d0f)"/></svg></button>`;

export function mountToolSettings(root, { voice = false, voiceConnected = () => false } = {}) {
  root.querySelector('.tool-panel .panel-heading > svg')?.remove();
  root.querySelector('.tool-panel .panel-heading').insertAdjacentHTML('beforeend', toolSettingsButton);
  root.querySelector('#calls-title').insertAdjacentHTML('beforeend', '<span class="tool-settings-count" aria-live="polite"></span>');
  const updateCount = () => {
    const selected = getEnabledTools(voice);
    const count = root.querySelector('.tool-settings-count');
    count.textContent = `${selected.length}/${allAgentTools.length}`;
    count.setAttribute('aria-label', `${selected.length} of ${allAgentTools.length} tools selected`);
    count.title = 'Enabled for the next message or voice session';
  };
  updateCount();
  root.insertAdjacentHTML('beforeend', `<dialog class="tool-settings-dialog" aria-labelledby="tool-settings-title"><form method="dialog"><div class="settings-heading"><h2 id="tool-settings-title">Tools</h2><button class="settings-close" aria-label="Close tool settings" value="close">×</button></div><div class="tool-settings-actions"><button type="button" data-tools="on">All on</button><button type="button" data-tools="off">All off</button></div><div class="tool-settings-list">${allAgentTools.map(tool => `<label class="tool-settings-row"><span>${tool.name}${tool.name === 'end_conversation' ? '<small>Voice only</small>' : ''}</span><input type="checkbox" role="switch" name="${tool.name}" aria-label="${tool.name}"></label>`).join('')}</div><p class="tool-settings-note"></p><button class="settings-done" value="done">Done</button></form></dialog>`);
  const dialog = root.querySelector('.tool-settings-dialog');
  const switches = [...dialog.querySelectorAll('input')];
  const refresh = () => {
    switches.forEach(input => { input.checked = getEnabledTools(voice).includes(input.name); });
    dialog.querySelector('.tool-settings-note').textContent = voiceConnected() ? 'Reconnect Voice to apply changes.' : 'Applies to the next message or voice session.';
  };
  const save = () => {
    const selected = switches.filter(input => input.checked).map(input => input.name);
    if (voice) voiceEnabledTools = selected;
    else enabledTools = selected;
    updateCount();
    try { localStorage.setItem(voice ? voiceStorageKey : storageKey, JSON.stringify(selected)); } catch {}
  };
  switches.forEach(input => { input.onchange = save; });
  dialog.querySelectorAll('[data-tools]').forEach(button => { button.onclick = () => { switches.forEach(input => { input.checked = button.dataset.tools === 'on'; }); save(); }; });
  root.querySelector('.tool-settings-button').onclick = () => { refresh(); dialog.showModal(); };
  dialog.onclick = event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  };
}
