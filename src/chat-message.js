const escape = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

// Keep model text inert. Fenced blocks only change layout, never execute code.
export function renderChatMessage(text) {
  const blocks = [];
  let lines = [], fence = null;
  const flush = code => {
    const content = lines.join('\n');
    if (code) blocks.push(`<pre class="chat-code-block" tabindex="0"><code>${escape(content)}</code></pre>`);
    else if (content.trim()) blocks.push(`<p>${escape(content.trim())}</p>`);
    lines = [];
  };
  for (const line of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`).test(line)) { flush(true); fence = null; }
      else lines.push(line);
    } else {
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})[^`]*$/);
      if (opening) { flush(false); fence = opening[1]; }
      else lines.push(line);
    }
  }
  flush(Boolean(fence));
  return blocks.join('');
}
