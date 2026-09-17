import { test, expect } from '@playwright/test';

const stages = ['intro', 'text', 'history', 'api', 'define', 'tool-call', 'execute', 'context', 'new-call', 'answer', 'loop', 'end'];
const advance = async (page, count = 1) => {
  for (let i = 0; i < count; i++) await page.locator('#next').click();
};

test('tool calling carries explicit context into a new request and produces a text answer', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('From chat to action.');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(12, 13, 15)');

  await advance(page);
  await expect(page.locator('.response')).toContainText('Red.');
  await advance(page);
  for (let i = 0; i < 4; i++) {
    await page.locator(`[data-year="${i}"]`).click();
    await expect(page.locator('.history-detail h2')).not.toBeEmpty();
  }
  await page.locator('[data-year="0"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-year="1"]')).toBeFocused();
  await expect(page.locator('.lesson-stage.history')).toBeVisible();

  await advance(page);
  await expect(page.locator('.request-lane')).toContainText('Suggest a color for a circle');
  await expect(page.locator('.response-lane')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.response-lane')).toContainText('Red.');
  await page.locator('#replay-exchange').click();
  await expect(page.locator('.response-lane')).toBeHidden();
  await expect(page.locator('.response-lane')).toBeVisible({ timeout: 5000 });

  await advance(page);
  await expect(page.locator('.lesson-stage.define')).toContainText('create_svg');
  await expect(page.locator('.lesson-stage.define')).toContainText(/request/i);
  await advance(page);
  await expect(page.locator('.lesson-stage.tool-call')).toContainText(/tool call/i);
  await expect(page.locator('.tool-call-card')).toContainText('create_svg');
  await expect(page.locator('.tool-call-card')).toContainText('Circle');

  await advance(page);
  await expect(page.locator('.lesson-stage.execute')).toContainText(/your code/i);
  await expect(page.locator('.lesson-stage.execute')).toContainText(/create_svg/i);
  await expect(page.locator('.tool-observation')).not.toBeVisible();
  await expect(page.locator('.lesson-canvas circle')).toHaveCount(0);
  await page.locator('#execute-tool').click();
  await expect(page.locator('.tool-observation')).toBeVisible();
  await expect(page.locator('.tool-observation')).toContainText(/shape-1 created/);

  await advance(page);
  const context = page.locator('.context-row');
  await expect(context).toHaveCount(4);
  await expect(context.nth(0)).toContainText(/tool|instruction|system/i);
  await expect(context.nth(1)).toContainText(/user|circle/i);
  await expect(context.nth(2)).toContainText(/create_svg|tool call/i);
  await expect(context.nth(3)).toContainText(/shape-1 created/);
  const carriedContext = await context.allTextContents();

  await advance(page);
  await expect(page.locator('main')).toContainText(/no memory/i);
  expect(await page.locator('.context-row').allTextContents()).toEqual(carriedContext);
  await expect(page.locator('.context-received')).not.toBeVisible();
  await page.locator('#send-context').click();
  await expect(page.locator('.context-received')).toBeVisible({ timeout: 5000 });

  await advance(page);
  await expect(page.locator('.lesson-stage.answer .response-lane')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.lesson-stage.answer .response-lane')).toContainText(/Drew a red circle/);
  await expect(page.locator('.lesson-stage.answer')).toContainText(/text/i);

  await advance(page);
  await page.locator('#run-loop').click();
  await expect(page.locator('.loop-output')).toContainText('New API call', { timeout: 10000 });
  await expect(page.locator('.loop-step.done')).toHaveCount(3);
  await expect(page.locator('.lesson-canvas circle')).toHaveAttribute('fill', '#5689f5');
  await expect(page.locator('.lesson-canvas circle')).toHaveAttribute('data-shape-id', 'shape-1');

  await advance(page);
  await expect(page.locator('h1')).toHaveText('That’s how an agent works.');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').click();
  expect((await downloadPromise).suggestedFilename()).toBe('agent.mjs');
  await page.locator('#sources').click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).not.toBeVisible();
  await advance(page);
  await expect(page.locator('h1')).toHaveText('From chat to action.');
  expect(errors).toEqual([]);
});

test('every slide fits a 1280 by 720 presentation viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  for (const [index, stage] of stages.entries()) {
    await expect(page.locator(`.lesson-stage.${stage}`)).toBeVisible();
    await expect(page.locator('h1')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.lesson-stage')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#next')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    if (stage === 'api') {
      await expect(page.locator('.response-lane')).toBeVisible({ timeout: 5000 });
      const messageSize = await page.locator('.request-lane p').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      expect(messageSize).toBeGreaterThanOrEqual(28);
      await page.screenshot({ path: 'test-results/presentation-api.png', fullPage: true, animations: 'disabled' });
    }
    if (stage === 'context') await page.screenshot({ path: 'test-results/presentation-context.png', fullPage: true, animations: 'disabled' });
    if (index < stages.length - 1) await advance(page);
  }
});

test('mobile has no raw JSON or horizontal overflow and every step remains navigable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const [index, stage] of stages.entries()) {
    await expect(page.locator(`.lesson-stage.${stage}`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.locator('pre, #show-json, .eyebrow, .optional')).toHaveCount(0);
    expect(await page.locator('main').innerText()).not.toMatch(/"(?:messages|arguments|function|role|type)"\s*:/);
    await expect(page.locator('#next')).toBeInViewport({ ratio: 1 });
    if (stage === 'context') await page.screenshot({ path: 'test-results/mobile-context.png', fullPage: true, animations: 'disabled' });
    if (index < stages.length - 1) await advance(page);
  }
});

test('drawing results inform the answer and keyboard navigation cancels an active loop', async ({ page }) => {
  await page.goto('/');
  await advance(page, 6);
  await page.locator('#execute-tool').click();
  await expect(page.locator('.tool-observation')).toContainText(/shape-1 created/);
  await advance(page, 3);
  await expect(page.locator('.response-lane')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.response-lane')).toContainText(/Drew a red circle/);

  await advance(page);
  await page.locator('#run-loop').click();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1900);
  await expect(page.locator('.lesson-stage.end')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.lesson-stage.loop')).toBeVisible();
  await expect(page.locator('.loop-step.done')).toHaveCount(0);
  await expect(page.locator('#run-loop')).toBeEnabled();
});

test('leaving a new request cancels its pending animation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await advance(page, 8);
  await page.locator('#send-context').click();
  await advance(page);
  await page.waitForTimeout(2200);
  await expect(page.locator('.lesson-stage.answer')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.lesson-stage.new-call')).toBeVisible();
  await expect(page.locator('.context-received')).not.toBeVisible();
  await expect(page.locator('#send-context')).toBeEnabled();
  expect(errors).toEqual([]);
});
