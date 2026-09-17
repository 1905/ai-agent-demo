import test from 'node:test';
import assert from 'node:assert/strict';
import { renderChatMessage } from '../src/chat-message.js';

test('ASCII drawings keep spaces, line breaks and backslashes without fence labels', () => {
  const hat = ['    _________', '   /         \\', '  /___________\\', '      |   |', ' _____|   |_____', '/               \\', '/_________________\\'].join('\n');
  const html = renderChatMessage('```text\n' + hat + '\n```');
  assert.equal(html, `<pre class="chat-code-block" tabindex="0"><code>${hat}</code></pre>`);
  assert.doesNotMatch(html, /```|>text/);
});

test('mixed text and multiple fences remain separate and HTML stays inert', () => {
  const html = renderChatMessage('Here is a box:\n\n```text\n+---+\n|   |\n+---+\n```\nAnd code:\n~~~html\n<img src=x onerror=alert(1)>\n~~~');
  assert.equal((html.match(/<pre /g) || []).length, 2);
  assert.match(html, /^<p>Here is a box:<\/p>/);
  assert.match(html, /<p>And code:<\/p>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.equal(renderChatMessage('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
});

test('longer fences, unfinished blocks and ordinary multiline text preserve content', () => {
  assert.match(renderChatMessage('````text\r\n```\r\n  kept\r\n````'), /<code>```\n  kept<\/code>/);
  assert.match(renderChatMessage('```text\n  unfinished  '), /<code>  unfinished  <\/code>/);
  assert.equal(renderChatMessage('First\nSecond'), '<p>First\nSecond</p>');
});
