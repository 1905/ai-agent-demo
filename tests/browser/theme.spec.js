import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const Native = WebSocket;
    window.WebSocket = class extends Native {
      constructor(url, ...rest) {
        if (new URL(url, location.href).pathname === '/api/voice') throw new Error('Voice is blocked in this test.');
        super(url, ...rest);
      }
    };
  });
  await page.route('**/api/draw/status', route => route.fulfill({ json: { configured: true } }));
  await page.route('**/api/draw/turn', route => {
    const body = route.request().postDataJSON();
    const completed = body.input.some(item => item.type === 'function_call_output' && item.call_id === 'theme-red');
    const calls = completed ? [] : [{ type: 'function_call', call_id: 'theme-red', name: 'draw_svg', arguments: JSON.stringify({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><circle id="ball" cx="320" cy="320" r="100" fill="#ef5350"/></svg>' }) }];
    return route.fulfill({ json: { calls, inputItems: calls, text: calls.length ? '' : 'Drew a red circle.' } });
  });
  await page.goto('/#draw');
  await page.evaluate(async () => {
    // Vite can append a cache timestamp; use the module already loaded by the app.
    const url = performance.getEntriesByType('resource')
      .find(entry => new URL(entry.name).pathname === '/src/site-theme.js').name;
    window.themeTest = await import(url);
  });
});

const theme = (page, name, args = {}) => page.evaluate(
  ({ name, args }) => window.themeTest.executeThemeTool(name, args), { name, args },
);

test('theme edits are atomic, survive tabs, and can recover hidden controls', async ({ page }) => {
  const original = await theme(page, 'read_site_css');
  await theme(page, 'edit_site_css', {
    revision: original.revision,
    edits: [{ find: '--page-background: #0c0d0f;', replace: '--page-background: #102f37;' }],
  });
  const current = await theme(page, 'read_site_css');
  await expect(theme(page, 'replace_site_css', { revision: original.revision, css: original.css })).rejects.toThrow(/changed/);
  await expect(theme(page, 'replace_site_css', { revision: current.revision, css: 'body { color: red;' })).rejects.toThrow(/CSS/);
  await expect(theme(page, 'edit_site_css', {
    revision: current.revision,
    edits: [
      { find: '--page-background: #102f37;', replace: '--page-background: #ffffff;' },
      { find: 'RULE_THAT_DOES_NOT_EXIST', replace: '' },
    ],
  })).rejects.toThrow(/match exactly once/);
  expect(await theme(page, 'read_site_css')).toEqual(current);

  await page.getByRole('link', { name: 'Voice', exact: true }).click();
  await expect(page.locator('#voice-button')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(16, 47, 55)');
  await theme(page, 'replace_site_css', { revision: current.revision, css: `${current.css}\nbutton { display: none !important; }` });
  await expect(page.locator('[data-reset-theme]')).toBeHidden();
  await page.keyboard.press('Alt+Shift+R');
  await expect(page.locator('[data-reset-theme]')).toBeVisible();
  expect((await theme(page, 'read_site_css')).css).toBe(original.css);

  const reset = await theme(page, 'read_site_css');
  await theme(page, 'replace_site_css', { revision: reset.revision, css: current.css });
  await page.reload();
  await expect(page.locator('#site-theme')).toHaveAttribute('href', '/site.css');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(12, 13, 15)');
});

test('rendered screenshot includes the current SVG and keeps its identity', async ({ page }) => {
  await expect(page.locator('#draw-send')).toBeEnabled();
  await page.locator('#draw-prompt').fill('Draw a red circle');
  await page.locator('#draw-send').click();
  await expect(page.locator('#draw-prompt')).toBeEnabled();
  const capture = await page.evaluate(() => window.themeTest.captureSite());
  expect(capture.imageUrl).toMatch(/^data:image\/jpeg;base64,/);
  expect(capture.capture).toContain('API inspector omitted');
  const pixel = await page.evaluate(async imageUrl => {
    const image = new Image(); image.src = imageUrl; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const circle = document.querySelector('#artwork-layer').getBoundingClientRect();
    const app = document.querySelector('#app').getBoundingClientRect();
    const scale = image.width / app.width;
    return [...context.getImageData((circle.x + circle.width / 2 - app.x) * scale, (circle.y + circle.height / 2 - app.y) * scale, 1, 1).data];
  }, capture.imageUrl);
  expect(Math.abs(pixel[0] - 239)).toBeLessThan(5);
  expect(Math.abs(pixel[1] - 83)).toBeLessThan(5);
  expect(Math.abs(pixel[2] - 80)).toBeLessThan(5);
  await expect(page.locator('#artwork-layer')).toHaveCount(1);
});
