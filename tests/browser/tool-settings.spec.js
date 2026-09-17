import { test, expect } from '@playwright/test';

const open = page => page.locator('.tool-settings-button').click();
const selected = page => page.locator('.tool-settings-dialog input:checked').evaluateAll(nodes => nodes.map(n => n.name));
async function select(page, names) {
  await open(page);
  await page.locator('[data-tools="off"]').click();
  for (const name of names) await page.locator(`.tool-settings-dialog input[name="${name}"]`).check();
  await page.keyboard.press('Escape');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWebSocket = WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url, ...args) {
        if (new URL(url, location.href).pathname === '/api/voice') throw new Error('Real Voice is blocked in tool settings tests');
        super(url, ...args);
      }
    };
  });
  await page.route('**/api/draw/status', route => route.fulfill({ json: { configured: true } }));
  await page.route('**/api/draw/turn', route => route.abort());
});

test('all eight switches are accessible, keyboard controlled and persistent', async ({ page }) => {
  await page.goto('/#draw');
  await open(page);
  await expect(page.getByRole('switch')).toHaveCount(8);
  expect(await selected(page)).toHaveLength(8);
  await page.locator('[data-tools="off"]').click();
  expect(await selected(page)).toEqual([]);
  await page.locator('[data-tools="on"]').click();
  expect(await selected(page)).toHaveLength(8);
  await page.locator('[data-tools="off"]').click();
  await page.locator('input[name="draw_svg"]').focus();
  await page.keyboard.press('Space');
  expect(await selected(page)).toEqual(['draw_svg']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tool-settings-button')).toBeFocused();
  await page.getByRole('link', { name: 'Voice', exact: true }).click();
  await open(page);
  expect(await selected(page)).toHaveLength(8);
  await page.locator('[data-tools="off"]').click();
  await page.keyboard.press('Escape');
  await page.reload();
  await open(page);
  expect(await selected(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Chat', exact: true }).click();
  await open(page);
  expect(await selected(page)).toEqual(['draw_svg']);
  await page.keyboard.press('Escape');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 844 });
    await open(page);
    await expect(page.locator('.tool-settings-dialog')).toBeInViewport({ ratio: 1 });
    for (const control of await page.getByRole('switch').all()) {
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport({ ratio: 1 });
    }
    await page.keyboard.press('Escape');
  }
});

test('Chat captures allowed tools for the entire turn and blocks fabricated disabled calls', async ({ page }) => {
  const requests = [], results = [];
  let release, arrived;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { arrived = resolve; });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><rect width="640" height="640" fill="#126789"/></svg>';
  await page.route('**/api/draw/turn', async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    const index = requests.length;
    if (index === 2) { arrived(); await held; }
    const calls = [2, 4].includes(index) ? [{ type: 'function_call', call_id: `call-${index}`, name: 'draw_svg', arguments: JSON.stringify({ svg: index === 2 ? svg : svg.replace('#126789', '#ffffff') }) }] : [];
    results.push(...body.input.filter(item => item.type === 'function_call_output'));
    await route.fulfill({ json: { calls, inputItems: calls, text: calls.length ? '' : 'Plain answer.' } });
  });
  await page.goto('/#draw');
  await expect(page.locator('#draw-send')).toBeEnabled();
  const send = async text => { await page.locator('#draw-prompt').fill(text); await page.locator('#draw-send').click(); };
  await select(page, []);
  await send('No tools');
  await expect(page.locator('#draw-prompt')).toBeEnabled();
  expect(requests[0].enabledTools).toEqual([]);
  await expect(page.locator('.tool-entry, #artwork-layer')).toHaveCount(0);
  expect(JSON.parse(await page.locator('#api-log [aria-label="Simple request JSON"] code').innerText()).tools).toBe('None');
  await select(page, ['draw_svg']);
  await send('Draw SVG');
  await started;
  await select(page, ['draw_js']);
  release();
  await expect(page.locator('#draw-prompt')).toBeEnabled();
  expect(requests.slice(1, 3).map(request => request.enabledTools)).toEqual([['draw_svg'], ['draw_svg']]);
  const artwork = await page.locator('#artwork-layer').getAttribute('href');
  await send('Fabricated disabled call');
  await expect(page.locator('#draw-prompt')).toBeEnabled();
  expect(requests.slice(3).map(request => request.enabledTools)).toEqual([['draw_js'], ['draw_js']]);
  expect(JSON.parse(results.find(item => item.call_id === 'call-4').output).error).toContain('disabled');
  await expect(page.locator('#artwork-layer')).toHaveAttribute('href', artwork);
});

test('Voice applies a captured tool set until reconnect and blocks disabled tools', async ({ page }) => {
  await page.goto('/#voice');
  await expect(page.locator('#voice-button')).toBeEnabled();
  await select(page, ['draw_svg']);
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').find(item => new URL(item.name).pathname === '/src/voice/session.js').name;
    const { VoiceSession } = await import(url);
    window.voiceToolSnapshots = [];
    VoiceSession.prototype.start = async function () {
      window.toolVoice = this; window.voiceToolSnapshots.push([...this.enabledTools]);
      this.sent = []; this.send = event => this.sent.push(event); this.setState('listening');
    };
  });
  await page.locator('#voice-button').click();
  await open(page);
  await expect(page.locator('.tool-settings-note')).toHaveText('Reconnect Voice to apply changes.');
  await page.locator('[data-tools="off"]').click();
  await page.keyboard.press('Escape');
  const first = await page.evaluate(async () => {
    const voice = window.toolVoice;
    voice.receive({ type: 'response.event', event: { type: 'response.output_item.done', item: { type: 'function_call', name: 'draw_js', call_id: 'disabled', arguments: '{}' } } }, voice.generation);
    await voice.toolQueue;
    return { enabled: voice.enabledTools, sent: voice.sent };
  });
  expect(first.enabled).toEqual(['draw_svg']);
  expect(first.sent[0].failed).toBe(true);
  await page.locator('#voice-button').click();
  await page.locator('#voice-button').click();
  expect(await page.evaluate(() => window.voiceToolSnapshots)).toEqual([['draw_svg'], []]);
  await page.locator('#voice-button').click();
});
