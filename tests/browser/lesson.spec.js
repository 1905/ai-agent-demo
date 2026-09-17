import { test, expect } from '@playwright/test';
import { weatherToolResult } from '../../src/lesson.js';

const stages = ['text', 'define', 'tool-call', 'execute', 'weather', 'weather-call', 'weather-run', 'weather-result', 'answer'];
const go = (page, stage) => page.locator(`[data-page="${stages.indexOf(stage)}"]`).click();
const noExtraControls = '#execute-tool, #send-context, #replay-exchange, #download, #sources';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/draw/turn', route => route.abort());
  await page.addInitScript(() => {
    const NativeWebSocket = WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url, ...args) {
        if (new URL(url, location.href).pathname === '/api/voice') throw new Error('Voice is blocked in lesson tests');
        super(url, ...args);
      }
    };
  });
});

test('nine-step lesson progresses from a command to weather data with Next alone', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('[data-page]')).toHaveCount(9);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('.chat-reply')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.chat-reply')).toContainText('Красный.');
  for (const [index, stage] of stages.entries()) {
    if (index) await page.locator('#next').click();
    await expect(page.locator(`.lesson-stage.${stage}`)).toBeVisible();
    await expect(page.locator(noExtraControls)).toHaveCount(0);
    await expect(page.locator('.lesson-stage .model-orb, .lesson-chat-model')).toHaveCount(0);
    if (['define', 'weather'].includes(stage)) {
      await expect(page.locator('.lesson-chat-message')).toHaveAttribute('data-speaker', 'user');
      await expect(page.locator('.lesson-available-tool')).toContainText(stage === 'define' ? 'draw_circle' : 'get_weather');
    }
    if (['tool-call', 'weather-call'].includes(stage)) {
      expect(await page.locator('.lesson-chat-message').evaluateAll(nodes => nodes.map(n => n.dataset.speaker))).toEqual(['user', 'ai']);
      await expect(page.locator('.tool-message')).toContainText('вызов инструмента');
    }
    if (['execute', 'weather-run'].includes(stage)) {
      await expect(page.locator('.lesson-function-panel')).toHaveClass(/is-complete/);
      await expect(page.locator('.lesson-function-panel .lesson-chat-message, .lesson-function-panel .lesson-avatar, .lesson-function-panel button')).toHaveCount(0);
      if (stage === 'execute') await expect(page.locator('.lesson-canvas circle')).toHaveAttribute('fill', '#ef5350');
      else {
        const result = JSON.parse(await page.locator('.lesson-weather-json code').innerText());
        expect(result).toEqual(weatherToolResult);
        await expect(page.locator('.lesson-fixture')).toHaveText('Учебные данные');
      }
    }
    if (stage === 'weather-result') {
      await expect(page.locator('.return-request')).toHaveAttribute('data-speaker', 'code');
      await expect(page.locator('.return-request')).toContainText('API-запрос 2 → ИИ');
      await expect(page.locator('.lesson-original-question')).toHaveText('Нужен ли зонт в Москве?');
      await expect(page.locator('.lesson-carried-call')).toContainText('get_weather · Москва');
      expect(JSON.parse(await page.locator('.lesson-weather-json code').innerText())).toEqual(weatherToolResult);
    }
    if (stage === 'answer') {
      await expect(page.locator('.chat-reply')).toHaveAttribute('aria-hidden', 'false');
      await expect(page.locator('.chat-reply')).toContainText('Да, возьмите зонт. В Москве дождь, +12 °C.');
      await expect(page.locator('#next')).toContainText('Сначала');
    }
  }
  await page.locator('#next').click();
  await expect(page.locator('.lesson-stage.text')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
  test(`all nine stages fit ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const stage of stages) {
      await go(page, stage);
      await expect(page.locator('h1')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('#next')).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      const overlaps = await page.locator('.lesson-chat-label').evaluateAll(labels => labels.some(label => {
        const sender = label.querySelector('.lesson-message-sender').getBoundingClientRect();
        const more = label.querySelector('.lesson-more').getBoundingClientRect();
        return sender.x < more.right && sender.right > more.x && sender.y < more.bottom && sender.bottom > more.y;
      }));
      expect(overlaps).toBe(false);
    }
  });
}

test('More shows highlighted teaching JSON with complete weather history', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-details="text"]').click();
  expect(Object.keys(JSON.parse(await page.locator('#request-detail code').innerText()))).toEqual(['текст']);
  await expect(page.locator('#request-detail')).toContainText('не формат API');
  await expect(page.locator('#request-detail .json-key')).not.toHaveCount(0);
  await page.keyboard.press('Escape');
  await go(page, 'tool-call');
  await page.locator('[data-details="command-call"]').click();
  expect(JSON.parse(await page.locator('#request-detail code').innerText()).тип).toBe('вызов инструмента, не текст');
  await page.keyboard.press('Escape');
  await go(page, 'weather-result');
  await page.locator('[data-details="context"]').click();
  const context = JSON.parse(await page.locator('#request-detail code').innerText());
  expect(context.контекст).toHaveLength(3);
  expect(context.контекст[2].инструмент.результат_для).toBe(context.контекст[1].модель.id);
  expect(context.контекст[0].пользователь).toBe('Нужен ли зонт в Москве?');
  expect(context.контекст[2].инструмент.данные).toEqual(weatherToolResult);
  await page.keyboard.press('Escape');
});

test('navigation cancels pending auto animations and Chat remains accessible', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const stage of ['text', 'execute', 'weather-run', 'answer']) {
    await go(page, stage);
    await page.locator('#next').click();
    await page.waitForTimeout(1200);
    await go(page, stage);
    if (['execute', 'weather-run'].includes(stage)) await expect(page.locator('.lesson-function-panel')).toHaveClass(/is-running/);
    else await expect(page.locator('.chat-reply')).toHaveAttribute('aria-hidden', 'true');
  }
  await go(page, 'define');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.lesson-stage.tool-call')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.lesson-stage.define')).toBeVisible();
  await page.locator('.lesson-draw-link').click();
  await expect(page.locator('h1')).toHaveText('Draw');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(errors).toEqual([]);
});
