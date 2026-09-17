import { test, expect } from '@playwright/test';

test('Chat Demo and Voice share shapes without changing the Chat mode', async ({ page }) => {
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
    return route.abort();
  });
  await page.goto('/#draw');
  await page.locator('#draw-mode').selectOption('demo');
  const circle = page.locator('#shape-layer circle');
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
    await expect(circle).toHaveAttribute('data-shape-id', 'shape-1');
    await expect(circle).toHaveAttribute('fill', fill);
  };

  await send('Draw a red circle');
  await expectCircle('#ef5350');
  await view('Voice');
  await expectCircle('#ef5350');
  await view('Chat');
  await expect(page.locator('#draw-mode')).toHaveValue('demo');
  await send('No, make it blue');
  await expectCircle('#5689f5');
  await view('Voice');
  await expectCircle('#5689f5');

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
  const read = await page.evaluate(async () => JSON.parse((await window.testVoice.executeTool({
    call_id: 'test-read', name: 'read_svg', arguments: '{}',
  })).output));
  expect(read.shapes).toMatchObject([{ id: 'shape-1', fill: '#5689f5' }]);
  await page.evaluate(async () => window.testVoice.executeTool({
    call_id: 'test-update', name: 'update_svg',
    arguments: JSON.stringify({ id: 'shape-1', fill: 'red', x: null, y: null, width: null, height: null }),
  }));
  await expectCircle('#ef5350');
  await view('Chat');
  await expect(page.locator('#draw-mode')).toHaveValue('demo');
  await expectCircle('#ef5350');
  await send('Read the drawing');
  await expectCircle('#ef5350');
  await view('Voice');
  await page.locator('#draw-reset').click();
  await expect(circle).toHaveCount(0);
  await view('Chat');
  await expect(circle).toHaveCount(0);
  await expect(page.locator('#draw-mode')).toHaveValue('demo');
  expect(modelRequests).toBe(0);
  expect(errors).toEqual([]);
});
