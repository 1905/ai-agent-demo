import { allAgentTools, selectAgentTools } from './agent-tools.js';

const storageKey = 'agent-lab-enabled-tools';
let enabledTools = allAgentTools.map(tool => tool.name);
try {
  const saved = localStorage.getItem(storageKey);
  if (saved !== null) enabledTools = selectAgentTools(JSON.parse(saved), true).map(tool => tool.name);
} catch { /* Keep all tools enabled if saved settings cannot be read. */ }

export const getEnabledTools = () => [...enabledTools];
export const toolSettingsButton = `<button type="button" class="tool-settings-button" aria-label="Tool settings" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--background, #0c0d0f)"/><circle cx="15" cy="17" r="3" fill="var(--background, #0c0d0f)"/></svg></button>`;

export function mountToolSettings(root, { voiceConnected = () => false } = {}) {
  root.querySelector('.tool-panel .panel-heading > svg')?.remove();
  root.querySelector('.tool-panel .panel-heading').insertAdjacentHTML('beforeend', toolSettingsButton);
  root.insertAdjacentHTML('beforeend', `<dialog class="tool-settings-dialog" aria-labelledby="tool-settings-title"><form method="dialog"><div class="settings-heading"><h2 id="tool-settings-title">Tools</h2><button class="settings-close" aria-label="Close tool settings" value="close">×</button></div><div class="tool-settings-actions"><button type="button" data-tools="on">All on</button><button type="button" data-tools="off">All off</button></div><div class="tool-settings-list">${allAgentTools.map(tool => `<label class="tool-settings-row"><span>${tool.name}${tool.name === 'end_conversation' ? '<small>Voice only</small>' : ''}</span><input type="checkbox" role="switch" name="${tool.name}" aria-label="${tool.name}"></label>`).join('')}</div><p class="tool-settings-note"></p><button class="settings-done" value="done">Done</button></form></dialog>`);
  const dialog = root.querySelector('.tool-settings-dialog');
  const switches = [...dialog.querySelectorAll('input')];
  const refresh = () => {
    switches.forEach(input => { input.checked = enabledTools.includes(input.name); });
    dialog.querySelector('.tool-settings-note').textContent = voiceConnected() ? 'Reconnect Voice to apply changes.' : 'Applies to the next message or voice session.';
  };
  const save = () => {
    enabledTools = switches.filter(input => input.checked).map(input => input.name);
    try { localStorage.setItem(storageKey, JSON.stringify(enabledTools)); } catch {}
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
