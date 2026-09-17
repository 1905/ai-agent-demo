import { test, expect } from '@playwright/test';

const jsScene = `const g=ctx.createLinearGradient(0,0,640,640);g.addColorStop(0,"#123456");g.addColorStop(1,"#654321");ctx.fillStyle=g;ctx.fillRect(0,0,width,height);for(let i=0;i<80;i++){ctx.fillStyle="gold";ctx.beginPath();ctx.arc(20+i%10*60,150+Math.floor(i/10)*55,8,0,Math.PI*2);ctx.fill()}ctx.fillStyle="#ff1493";ctx.fillRect(0,0,80,80);ctx.fillStyle="white";ctx.font="42px sans-serif";ctx.fillText("Canvas scene",120,80);`;
const svgScene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><defs><linearGradient id="g"><stop stop-color="#00b4d8"/><stop offset="1" stop-color="#5a189a"/></linearGradient></defs><rect width="640" height="640" fill="url(#g)"/>${Array.from({ length: 80 }, (_, i) => `<circle cx="${20 + i % 10 * 60}" cy="${150 + Math.floor(i / 10) * 55}" r="8" fill="hsl(35 100% 50%)"/>`).join('')}<path d="M0 0H80V80H0Z" fill="#00fa9a"/><text x="120" y="80" fill="white" font-size="42">SVG scene</text></svg>`;
const readSource = { name: 'read_svg', args: {} };
const readCanvas = { name: 'read_canvas', args: {} };

async function mockTools(page) {
  const plans = new Map(), outputs = new Map();
  let sequence = 0;
  await page.addInitScript(() => {
    const NativeWebSocket = WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url, ...args) {
        if (new URL(url, location.href).pathname === '/api/voice') throw new Error('Real voice is blocked in artwork tests');
        super(url, ...args);
      }
    };
  });
  await page.route('**/api/draw/status', route => route.fulfill({ json: { configured: true } }));
  await page.route('**/api/draw/turn', async route => {
    const body = route.request().postDataJSON();
    const prompt = body.input.filter(item => item.role === 'user').at(-1).content;
    const plan = plans.get(prompt);
    for (const item of body.input.filter(item => item.type === 'function_call_output')) outputs.set(item.call_id, item.output);
    const index = plan.findIndex((_, index) => !outputs.has(`${prompt}${index}`));
    const calls = index < 0 ? [] : [{ type: 'function_call', call_id: `${prompt}${index}`, name: plan[index].name, arguments: JSON.stringify(plan[index].args) }];
    await route.fulfill({ json: { calls, inputItems: calls, text: calls.length ? '' : 'Done.' } });
  });
  await page.goto('/#draw');
  await expect(page.locator('#draw-send')).toBeEnabled();
  const start = async plan => {
    const prompt = `art-${++sequence}-`;
    plans.set(prompt, plan);
    await page.locator('#draw-prompt').fill(prompt);
    await page.locator('#draw-send').click();
    return prompt;
  };
  return {
    start,
    async run(plan) {
      const prompt = await start(plan);
      await expect(page.locator('#draw-prompt')).toBeEnabled({ timeout: 15000 });
      return plan.map((_, index) => outputs.get(`${prompt}${index}`));
    },
  };
}

async function pixels(page, url, points = [[20, 20]]) {
  return page.evaluate(async ({ url, points }) => {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 640;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    return points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]);
  }, { url, points });
}

test('whole JS and SVG scenes render, retain source, inspect and download', async ({ page }) => {
  const tools = await mockTools(page);
  for (const [type, source, expected] of [['js', jsScene, [255, 20, 147, 255]], ['svg', svgScene, [0, 250, 154, 255]]]) {
    const key = type === 'js' ? 'code' : 'svg';
    const results = await tools.run([{ name: `draw_${type}`, args: { [key]: source } }, readSource, readCanvas]);
    expect(JSON.parse(results[0]).error).toBeUndefined();
    const snapshot = JSON.parse(results[1]);
    expect(snapshot.artwork[key]).toBe(source);
    expect(snapshot.artwork.imageUrl).toBeUndefined();
    const imageParts = results[2];
    expect(imageParts).toHaveLength(2);
    expect(JSON.parse(imageParts[0].text).artwork[key]).toBe(source);
    expect(JSON.parse(imageParts[0].text).artwork.imageUrl).toBeUndefined();
    expect(await pixels(page, imageParts[1].image_url)).toEqual([expected]);
    const download = page.waitForEvent('download');
    await page.locator('#draw-export').click();
    expect((await download).suggestedFilename()).toBe(`agent-drawing.${type === 'js' ? 'png' : 'svg'}`);
  }
  await expect(page.locator('iframe[title="Isolated drawing renderer"]')).toHaveCount(0);
});

test('JavaScript failures retain the previous picture; reset and navigation cancel workers', async ({ page }) => {
  const tools = await mockTools(page);
  const initial = { name: 'draw_js', args: { code: jsScene } };
  await tools.run([initial]);
  const original = await page.locator('#artwork-layer').getAttribute('href');
  for (const code of ['const = broken', 'throw new Error("runtime-probe")', 'while(true){}']) {
    const [result] = await tools.run([{ name: 'draw_js', args: { code } }]);
    expect(JSON.parse(result).error).toBeTruthy();
    await expect(page.locator('#artwork-layer')).toHaveAttribute('href', original);
    await expect(page.locator('iframe[title="Isolated drawing renderer"]')).toHaveCount(0);
  }
  const malformed = await tools.run([{ name: 'draw_svg', args: { svg: '<svg xmlns="http://www.w3.org/2000/svg"><path></svg>' } }]);
  expect(JSON.parse(malformed[0]).error).toBeTruthy();
  await expect(page.locator('#artwork-layer')).toHaveAttribute('href', original);
  for (const cancel of ['reset', 'navigate']) {
    await tools.start([{ name: 'draw_js', args: { code: 'while(true){}' } }]);
    await expect(page.locator('iframe[title="Isolated drawing renderer"]')).toBeAttached();
    await page.locator('.settings-button').click();
    await expect(page.locator('.settings-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    if (cancel === 'reset') await page.locator('#draw-reset').click();
    else await page.getByRole('link', { name: 'Voice', exact: true }).click();
    await expect(page.locator('iframe[title="Isolated drawing renderer"]')).toHaveCount(0);
    await page.waitForTimeout(2300);
    if (cancel === 'reset') {
      await expect(page.locator('#artwork-layer')).toHaveCount(0);
      await tools.run([initial]);
    } else await expect(page.locator('#artwork-layer')).toHaveAttribute('href', original);
  }
});

test('sandbox and SVG image context cannot read page state or request external resources', async ({ page }) => {
  const remote = [];
  page.on('request', request => { if (request.url().includes('artwork-probe.invalid')) remote.push(request.url()); });
  await page.route('**artwork-probe.invalid**', route => route.abort());
  const tools = await mockTools(page);
  const code = `if(typeof document!=="undefined"||typeof localStorage!=="undefined"||typeof window!=="undefined")throw Error("DOM leaked");fetch("https://artwork-probe.invalid/worker").catch(()=>{});ctx.fillStyle="#aabbcc";ctx.fillRect(0,0,width,height);`;
  expect(JSON.parse((await tools.run([{ name: 'draw_js', args: { code } }]))[0]).error).toBeUndefined();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" onload="top.artExecuted=true"><script>top.artExecuted=true;fetch("https://artwork-probe.invalid/script")</script><image href="https://artwork-probe.invalid/image" width="40" height="40"/><rect width="640" height="640" fill="#663399"/></svg>`;
  const result = await tools.run([{ name: 'draw_svg', args: { svg } }, readCanvas]);
  expect(JSON.parse(result[0]).error).toBeUndefined();
  expect(await pixels(page, result[1][1].image_url)).toEqual([[102, 51, 153, 255]]);
  expect(await page.evaluate(() => window.artExecuted)).not.toBe(true);
  expect(remote).toEqual([]);
});

test('replacement clears old shapes; Chat and the real Voice executor share artwork', async ({ page }) => {
  const tools = await mockTools(page);
  await tools.run([{ name: 'create_svg', args: { shape: 'circle', fill: 'red', x: 320, y: 320, width: 180, height: 180 } }]);
  await expect(page.locator('#shape-layer circle')).toHaveCount(1);
  await tools.run([{ name: 'draw_js', args: { code: jsScene } }]);
  await expect(page.locator('#shape-layer *')).toHaveCount(0);
  const image = await page.locator('#artwork-layer').getAttribute('href');
  await page.getByRole('link', { name: 'Voice', exact: true }).click();
  await expect(page.locator('#artwork-layer')).toHaveAttribute('href', image);
  await expect(page.locator('#voice-button')).toBeEnabled();
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').find(item => new URL(item.name).pathname === '/src/voice/session.js').name;
    const { VoiceSession } = await import(url);
    VoiceSession.prototype.start = async function () { window.artVoice = this; this.setState('listening'); };
  });
  await page.locator('#voice-button').click();
  const result = await page.evaluate(async svg => window.artVoice.executeTool({ name: 'draw_svg', call_id: 'voice-art', arguments: JSON.stringify({ svg }) }), svgScene);
  expect(result.failed).toBe(false);
  await page.locator('#voice-button').click();
  await page.getByRole('link', { name: 'Chat', exact: true }).click();
  const results = await tools.run([readSource, { name: 'create_svg', args: { shape: 'circle', fill: 'red', x: 320, y: 320, width: 180, height: 180 } }, readCanvas]);
  expect(JSON.parse(results[0]).artwork.svg).toBe(svgScene);
  expect(await pixels(page, results[2][1].image_url, [[20, 20], [320, 320]])).toEqual([[0, 250, 154, 255], [239, 83, 80, 255]]);
});
