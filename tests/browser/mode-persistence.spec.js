import { test, expect } from '@playwright/test';

test('Chat API and Voice share SVG artwork while preserving the selected model', async ({ page }) => {
  const errors = [];
  let modelRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
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
    modelRequests++;
    const body = route.request().postDataJSON();
    const prompt = body.input.filter(item => item.role === 'user').at(-1).content;
    const id = prompt.includes('red circle') ? 'create-red' : prompt.includes('blue') ? 'update-blue' : 'read-shapes';
    const completed = body.input.some(item => item.type === 'function_call_output' && item.call_id === id);
    const name = id === 'create-red' ? 'draw_svg' : 'update_svg';
    const args = id === 'create-red' ? { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><circle id="ball" cx="320" cy="320" r="100" fill="red"/></svg>' } : { find: 'fill="red"', replace: 'fill="blue"' };
    const calls = completed ? [] : [{ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) }];
    return route.fulfill({ json: { calls, inputItems: calls, text: calls.length ? '' : 'Done.' } });
  });
  await page.goto('/#draw');
  await expect(page.locator('#draw-send')).toBeEnabled();
  await expect(page.locator('#draw-mode')).toHaveCount(0);
  const circle = page.locator('#artwork-layer');
  const send = async text => {
    await page.locator('#draw-prompt').fill(text);
    await page.locator('#draw-send').click();
    await expect(page.locator('#draw-prompt')).toBeEnabled();
  };
  const view = async name => {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.locator(name === 'Voice' ? '#voice-button' : '#draw-form')).toBeVisible();
  };
  const expectCircle = async fill => {
    await expect(circle).toHaveCount(1);
    const source = await circle.getAttribute('href');
    expect(Buffer.from(source.split(',')[1], 'base64').toString()).toContain(`fill="${fill}"`);
  };

  await send('Draw a red circle');
  await expectCircle('red');
  await view('Voice');
  await expectCircle('red');
  await view('Chat');
  await expect(page.locator('#current-model')).toHaveText('Terra');
  await send('No, make it blue');
  await expectCircle('blue');
  await view('Voice');
  await expectCircle('blue');

  // Keep the shared tool executor real; replace only microphone/network startup.
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource')
      .find(entry => new URL(entry.name).pathname === '/src/voice/session.js').name;
    const { VoiceSession } = await import(url);
    VoiceSession.prototype.start = function () {
      window.testVoice = this;
      this.setState('listening');
    };
    VoiceSession.prototype.stop = function () { this.setState('idle'); };
    VoiceSession.prototype.dispose = function () { this.stop(); };
  });
  await page.locator('#voice-button').click();
  await page.evaluate(async () => window.testVoice.executeTool({
    call_id: 'test-update', name: 'update_svg',
    arguments: JSON.stringify({ find: 'fill="blue"', replace: 'fill="red"' }),
  }));
  await expectCircle('red');
  await view('Chat');
  await expect(page.locator('#current-model')).toHaveText('Terra');
  await expectCircle('red');
  await view('Voice');
  await page.locator('#draw-reset').click();
  await expect(circle).toHaveCount(0);
  await view('Chat');
  await expect(circle).toHaveCount(0);
  await expect(page.locator('#current-model')).toHaveText('Terra');
  expect(modelRequests).toBe(4);
  expect(errors).toEqual([]);
});
