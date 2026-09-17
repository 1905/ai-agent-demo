import { validateThemeCss } from './theme-css.js';
import { domToJpeg } from 'modern-screenshot';
import { themeTools } from './theme-tools.js';

// The file is the original theme. Edits live only in this page's stylesheet.
// Route changes retain them; refresh starts with the original file again.
let original, current, revision = 0, loading;
const waitForPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

async function loadTheme() {
  loading ||= fetch('/site.css', { cache: 'no-cache' }).then(async response => {
    if (!response.ok) throw new Error('The original site stylesheet could not be loaded.');
    original = current = await response.text();
  }).catch(error => { loading = null; throw error; });
  await loading;
}

async function applyCss(css) {
  validateThemeCss(css);
  const old = document.querySelector('#site-theme');
  const style = document.createElement('style');
  style.id = 'site-theme';
  style.textContent = css;
  if (old) old.replaceWith(style);
  else document.head.append(style);
  current = css;
  const appliedRevision = ++revision;
  await waitForPaint();
  return { action: 'theme_updated', revision: appliedRevision, characters: css.length, persistence: 'Until page refresh or reset_site_css.' };
}

export async function resetSiteCss() {
  await loadTheme();
  return { ...await applyCss(original), action: 'theme_reset' };
}

export async function captureSite() {
  await loadTheme();
  await document.fonts.ready;
  await waitForPaint();
  const app = document.querySelector('#app');
  const bounds = app.getBoundingClientRect();
  const inspector = document.querySelector('#api-log');
  const contentHeight = inspector ? inspector.getBoundingClientRect().top - bounds.top : app.scrollHeight;
  const width = Math.ceil(bounds.width);
  if (!width || !bounds.height) throw new Error('The page is hidden. Use reset_site_css to restore it.');
  const height = Math.ceil(Math.min(2400, Math.max(innerHeight, contentHeight)));
  const scale = Math.min(1, 1600 / width);
  const backgrounds = [app, document.body, document.documentElement].map(element => getComputedStyle(element));
  const background = backgrounds.find(style => style.backgroundImage !== 'none' || !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.backgroundColor)) || backgrounds.at(-1);
  const selected = new Map([...document.querySelectorAll('select[id]')].map(select => [select.id, [...select.options].map(option => option.selected)]));
  const imageUrl = await domToJpeg(app, {
    width, height, scale, quality: 0.88, timeout: 8000,
    backgroundColor: background.backgroundColor,
    style: { background: background.background },
    filter: node => !(node instanceof Element && (node.id === 'api-log' || node.tagName === 'SCRIPT')),
    onCloneNode: clone => {
      // SVG foreignObject serialization uses attributes, not live select.value.
      clone.querySelectorAll('select[id]').forEach(select => {
        const values = selected.get(select.id);
        if (values) [...select.options].forEach((option, index) => option.toggleAttribute('selected', values[index]));
      });
    },
    features: { restoreScrollPosition: true },
  });
  return { imageUrl, view: location.hash || '#lesson', revision, width: Math.round(width * scale), height: Math.round(height * scale), capture: 'Rendered page snapshot; API inspector omitted. Maximum height 2400 CSS pixels.' };
}

export async function executeThemeTool(name, args, isCurrent = () => true) {
  const definition = themeTools.find(tool => tool.name === name);
  if (!definition) throw new Error('Unknown theme tool.');
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !Object.hasOwn(definition.parameters.properties, key))) throw new Error('Invalid theme tool arguments.');
  await loadTheme();
  if (!isCurrent()) throw new Error('Theme action cancelled.');
  if (name === 'read_site_css') return { file: 'public/site.css', revision, css: current, persistence: 'Edits are temporary. Refresh or reset_site_css restores the original file.' };
  if (name === 'take_screenshot') return captureSite();
  if (name === 'reset_site_css') return resetSiteCss();
  if (args.revision !== revision) throw new Error('The stylesheet changed. Read it again before editing.');
  let css = args.css;
  if (name === 'edit_site_css') {
    if (!Array.isArray(args.edits) || args.edits.length < 1 || args.edits.length > 50) throw new Error('Provide between 1 and 50 edits.');
    css = current;
    for (const edit of args.edits) {
      if (!edit || typeof edit.find !== 'string' || !edit.find || typeof edit.replace !== 'string') throw new Error('Each edit needs non-empty find text and replacement text.');
      const first = css.indexOf(edit.find);
      if (first < 0 || css.indexOf(edit.find, first + 1) !== -1) throw new Error('Each find must match exactly once. Read the CSS and include more context. No changes applied.');
      css = css.slice(0, first) + edit.replace + css.slice(first + edit.find.length);
    }
  }
  return applyCss(css);
}

export function bindThemeControls() {
  document.querySelectorAll('[data-reset-theme]').forEach(button => {
    button.onclick = async () => {
      button.disabled = true;
      try { await resetSiteCss(); button.textContent = 'Reset theme'; button.removeAttribute('title'); }
      catch (error) { button.textContent = 'Reset failed'; button.title = error.message; }
      finally { button.disabled = false; }
    };
  });
}

// Recovery remains available even if custom CSS hides every control.
window.addEventListener('keydown', event => {
  if (event.altKey && event.shiftKey && event.code === 'KeyR') {
    event.preventDefault();
    resetSiteCss().catch(error => alert(error.message));
  }
});
