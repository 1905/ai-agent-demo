import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateThemeCss } from '../src/theme-css.js';

test('the full site stylesheet and font imports parse without losing their rules', async () => {
  const css = await readFile(new URL('../public/site.css', import.meta.url), 'utf8');
  assert.doesNotThrow(() => validateThemeCss(css));
  assert.doesNotThrow(() => validateThemeCss('@import url("https://fonts.googleapis.com/css2?family=Test:wght@400;600");\n@font-face { font-family: Test; src: local("Georgia"); }\nbody { font-family: Test, serif; }'));
});

test('malformed or truncated CSS fails, while brackets inside strings and URLs remain valid', () => {
  for (const css of ['body { color: red;', 'body { color red; }', 'body { color: rgb(1,2,3; }', 'body { } }', '/* unfinished', 'body { content: "broken\ntext"; }']) {
    assert.throws(() => validateThemeCss(css), /No changes applied/);
  }
  assert.doesNotThrow(() => validateThemeCss('body::before { content: "[{}()]"; background: url("data:image/svg+xml;utf8,<svg>{}</svg>"); }'));
});
