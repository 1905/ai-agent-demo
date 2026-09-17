// Newline-delimited progress events followed by the complete response/trace.
export async function readDrawingResponse(response, onProgress = () => {}) {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) return response.json();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', result;
  const consume = line => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'error') throw new Error(event.data?.error || 'The model request failed.');
    if (event.type === 'complete') result = event.data;
    else onProgress(event);
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) { consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
      if (done) break;
    }
    consume(buffer);
    if (!result) throw new Error('The model connection ended before its response was complete.');
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
