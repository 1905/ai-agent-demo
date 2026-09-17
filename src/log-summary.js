const short = value => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
};
const names = tools => [...new Set((tools || []).map(tool => tool.name).filter(Boolean))].join(', ');

function messageText(content) {
  if (typeof content === 'string') return short(content);
  return short((content || []).map(part => part.text || part.refusal || '').filter(Boolean).join(' '));
}

function resultText(output) {
  if (Array.isArray(output)) {
    const text = output.filter(part => part.type === 'input_text').map(part => resultText(part.text)).filter(Boolean).join(' · ');
    return short(text || (output.some(part => part.type === 'input_image') ? 'Image returned' : 'Done'));
  }
  if (typeof output === 'string') {
    try { return resultText(JSON.parse(output)); } catch { return 'Result returned'; }
  }
  if (!output || typeof output !== 'object') return 'Done';
  if (output.error) return `Error: ${short(typeof output.error === 'string' ? output.error : output.error.message)}`;
  if (output.action === 'drawn') return 'Drawing updated';
  if (output.action === 'created') return 'Shape added';
  if (output.action === 'updated') return 'Shape updated';
  if (output.action === 'theme_updated') return 'Theme updated';
  if (output.action === 'theme_reset') return 'Theme reset';
  if (output.view) return 'Screenshot returned';
  if (output.css) return 'Styles returned';
  if (output.artwork || output.shapes?.length) return 'Drawing returned';
  if (Array.isArray(output.shapes)) return 'Canvas is empty';
  if (output.ended) return 'Voice ended';
  return 'Result returned';
}

function contextItem(item) {
  if (item.type === 'reasoning') return null;
  if (item.type === 'function_call') return `AI: ${item.name}()`;
  if (item.type === 'function_call_output') return `Tool: ${resultText(item.output)}`;
  if (item.role || item.type === 'message') {
    const text = messageText(item.content);
    return text ? `${item.role === 'user' ? 'You' : 'AI'}: ${text}` : null;
  }
  return null;
}

function simplifyRequest(request) {
  if (!request) return null;
  if (request.type) {
    if (request.session) return { tools: names(request.session.delegation?.responses?.tools) || 'None' };
    if (request.item) return { message: contextItem(request.item) || 'Context sent' };
    return { event: short(request.type) };
  }
  const context = (request.input || []).map(contextItem).filter(Boolean);
  const toolList = request.tools ?? request.enabledTools?.map(name => ({ name }));
  const tools = names(toolList);
  const recent = context.length > 6 ? [`… ${context.length - 6} earlier messages`, ...context.slice(-6)] : context;
  return {
    ...(context.length === 1 && context[0].startsWith('You: ') ? { text: context[0].slice(5) } : { context: recent }),
    ...(toolList ? { tools: tools || 'None' } : {}),
  };
}

function simplifyResponse(response) {
  if (!response) return 'Waiting…';
  if (response.error) return { error: short(typeof response.error === 'string' ? response.error : response.error.message) };
  const event = response.event || response;
  const body = event.response || event;
  const output = body.output || (event.item ? [event.item] : []);
  const text = short(body.output_text || body.text || output.filter(item => item.type === 'message').map(item => messageText(item.content)).join(' '));
  const calls = names(body.calls || output.filter(item => item.type === 'function_call'));
  return {
    ...(text ? { text } : {}),
    ...(calls ? { call: calls } : {}),
    ...(!text && !calls ? { status: body.status || response.type || 'Done' } : {}),
  };
}

// Teaching view only. Code, arguments, metadata and full history stay in raw tabs.
export function simplifyApiEntry(entry) {
  return { request: simplifyRequest(entry.request), response: simplifyResponse(entry.response) };
}
