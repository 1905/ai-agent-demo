import { WebSocketServer, WebSocket } from 'ws';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { selectAgentTools } from '../src/agent-tools.js';
import { instructionsForTools } from './drawing-api.js';
import { DEFAULT_THINKING_MODEL, validThinkingModel, DEFAULT_REASONING_EFFORT, validReasoningEffort } from '../src/thinking-models.js';

// Live speech with Responses delegation.
export function voiceSessionConfig(env, model, effort = DEFAULT_REASONING_EFFORT, enabledTools) {
  const tools = selectAgentTools(enabledTools, true);
  const endInstruction = tools.some(tool => tool.name === 'end_conversation') ? 'If the user asks to stop the conversation, call end_conversation.' : 'The user can stop voice with the Stop button.';
  const capabilities = tools.map(tool => `- ${tool.name}: ${tool.description.split(/(?<=\.)\s/)[0]}`).join('\n');
  return {
    model: 'gpt-live-1', store: false,
    instructions: `You are the voice assistant for a drawing canvas and editable website. Speak briefly in the user's language.
Delegation policy:
Backend tools:
${capabilities || 'None. No drawing or site changes are available in this session.'}
Delegate to the backend when:
- The user asks to draw, animate, change a drawing, or edit the site, theme, colors, or fonts using the available capabilities.
- A correction changes the work, including "make it blue", "try again", or "change that".
- The user asks what the enabled tools can do or asks to end the conversation when end_conversation is available.
Do not delegate to the backend when:
- The user greets you, asks to repeat a result, or needs a brief clarification.
Delegate before answering any request that needs backend work. The backend has the listed tools even though you do not call them directly. Do not say you cannot draw or cannot use tools when the listed backend capability supports the request. Acknowledge briefly, then wait for the backend result. Only confirm changes after a successful result. If no enabled tool can perform the action, explain that limitation.`,
    audio: { format: { type: 'audio/pcm', rate: 24000 }, output: { voice: 'marin' } },
    delegation: { type: 'responses', responses: {
      model: model ?? env.OPENAI_VOICE_DRAW_MODEL ?? DEFAULT_THINKING_MODEL,
      reasoning: { effort },
      instructions: `${instructionsForTools(tools)}\nYou receive spoken requests. Reply briefly. ${endInstruction}`,
      tools, tool_choice: 'auto', parallel_tool_calls: false, max_output_tokens: 16000,
    } },
  };
}

export function attachVoiceApi(server, env, options = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 5_000_000 });
  const timeoutMs = options.timeoutMs || 15_000;
  let writes = Promise.resolve();
  const persist = record => {
    const directory = env.DRAW_LOG_DIR || join(process.cwd(), '.local');
    writes = writes.then(async () => {
      await mkdir(directory, { recursive: true });
      await appendFile(join(directory, 'voice-api.jsonl'), JSON.stringify({ time: new Date().toISOString(), route: '/api/voice', provider: 'openai', cost_usd: null, cost_source: 'unavailable', ...record }) + '\n');
    }).catch(() => console.error('Voice API metadata could not be persisted.'));
  };
  const upgrade = (req, socket, head) => {
    if (req.url?.split('?')[0] !== '/api/voice') return;
    let validOrigin = false;
    try { validOrigin = new URL(req.headers.origin).host === req.headers.host; } catch {}
    if (!validOrigin || !env.OPENAI_API_KEY) {
      socket.end(`HTTP/1.1 ${validOrigin ? '503 Service Unavailable' : '403 Forbidden'}\r\nConnection: close\r\n\r\n`);
      persist({ method: 'UPGRADE', outcome: 'error', status: validOrigin ? 503 : 403, duration_ms: 0 });
      return;
    }
    wss.handleUpgrade(req, socket, head, client => wss.emit('connection', client));
  };
  server.on('upgrade', upgrade);
  wss.on('connection', client => {
    const id = randomUUID(), started = Date.now(), config = voiceSessionConfig(env);
    let upstream, ready = false, closing = false, finished = false, sessionId, usage = null;
    let closeTimer, sessionTimer, startTimer;
    const pending = new Map(), responses = new Map(), completed = new Set();
    const send = value => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(value)); };
    const trace = event => send({ type: 'voice.request', event });
    const upstreamSend = event => {
      if (upstream?.readyState !== WebSocket.OPEN) return false;
      upstream.send(JSON.stringify(event));
      if (event.type !== 'session.input_audio.append') trace(event);
      return true;
    };
    const finish = finalized => {
      if (finished) return;
      finished = true;
      clearTimeout(startTimer); clearTimeout(closeTimer); clearTimeout(sessionTimer);
      persist({ id, session_id: sessionId, method: 'WS', event: 'session.finished', model: config.model, usage, finalized, outcome: finalized ? 'success' : 'incomplete', duration_ms: Date.now() - started });
      for (const [responseId, response] of responses) persist({ id, session_id: sessionId, provider_response_id: responseId, method: 'WS', event: 'response.interrupted', model: response.model, usage: null, outcome: 'incomplete', duration_ms: Date.now() - response.started });
      responses.clear(); pending.clear();
      send({ type: 'voice.ended', finalized });
      client.close(1000, 'voice_ended');
      if (upstream?.readyState === WebSocket.OPEN) upstream.close();
      else if (upstream?.readyState === WebSocket.CONNECTING) upstream.terminate();
    };
    const close = () => {
      if (closing || finished) return;
      closing = true;
      clearTimeout(startTimer);
      if (!ready || !upstreamSend({ type: 'session.close' })) return finish(false);
      closeTimer = setTimeout(() => finish(false), timeoutMs);
    };
    const fail = message => { send({ type: 'error', error: { message } }); close(); };
    startTimer = setTimeout(() => fail('The voice session did not start. Try again.'), timeoutMs);
    persist({ id, method: 'UPGRADE', event: 'connection.started', outcome: 'success', status: 101, duration_ms: 0 });
    client.on('message', bytes => {
      if (closing || finished) return;
      let event;
      try { event = JSON.parse(bytes.toString()); } catch { return fail('Invalid voice event.'); }
      if (event.type === 'session.start' && !upstream) {
        if (event.model !== undefined && !validThinkingModel(event.model)) return fail('Choose a thinking model from Settings.');
        if (event.reasoningEffort !== undefined && !validReasoningEffort(event.reasoningEffort)) return fail('Choose a reasoning effort from Settings.');
        try { Object.assign(config, voiceSessionConfig(env, event.model, event.reasoningEffort ?? DEFAULT_REASONING_EFFORT, event.enabledTools)); }
        catch (error) { return fail(error.message); }
        upstream = new WebSocket(options.upstreamUrl || 'wss://api.openai.com/v1/live/sessions', { headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, handshakeTimeout: timeoutMs, maxPayload: 5_000_000 });
        upstream.on('open', () => {
          if (finished) return upstream.close();
          upstreamSend({ type: 'session.start', session: config });
        });
        upstream.on('message', raw => {
          let message;
          try { message = JSON.parse(raw.toString()); } catch { return fail('Invalid provider event.'); }
          if (finished) return;
          if (message.type === 'session.started') {
            ready = true; sessionId = message.session?.id; clearTimeout(startTimer);
            sessionTimer = setTimeout(close, 10 * 60_000);
            persist({ id, session_id: sessionId, method: 'WS', event: 'session.started', model: config.model, tools: config.delegation.responses.tools.map(tool => tool.name), outcome: 'success', duration_ms: Date.now() - started });
          }
          if (message.type === 'session.usage.updated' || message.type === 'session.closed') usage = message.usage || usage;
          if (message.type === 'session.closed') { send(message); return finish(true); }
          if (message.type === 'error') {
            persist({ id, session_id: sessionId, method: 'WS', event: 'provider.error', model: config.model, outcome: 'error', duration_ms: Date.now() - started });
            return fail('The voice provider rejected the request. Check model access or try a new session.');
          }
          if (closing) return;
          const inner = message.type === 'response.event' ? message.event : null;
          if (inner?.type === 'response.created') responses.set(inner.response.id, { started: Date.now(), model: inner.response.model || config.delegation.responses.model });
          if (['response.completed', 'response.failed', 'response.incomplete'].includes(inner?.type)) {
            const response = inner.response, previous = responses.get(response.id);
            persist({ id, session_id: sessionId, provider_response_id: response.id, delegation_id: message.delegation_id, method: 'WS', event: inner.type, model: response.model || previous?.model || config.delegation.responses.model, usage: response.usage || null, outcome: inner.type === 'response.completed' ? 'success' : 'error', duration_ms: previous ? Date.now() - previous.started : null });
            responses.delete(response.id);
            if (inner.type !== 'response.completed') send({ type: 'voice.failure', message: 'The drawing request failed. Try again.' });
          }
          const item = inner?.item;
          if (item?.type === 'function_call' && ['response.output_item.added', 'response.output_item.done'].includes(inner.type)) {
            if (!config.delegation.responses.tools.some(tool => tool.name === item.name)) return fail('The model requested a tool that is disabled.');
            if (!completed.has(item.call_id) && !pending.has(item.call_id)) pending.set(item.call_id, { name: item.name, started: Date.now(), ready: false });
            if (inner.type === 'response.output_item.done' && pending.has(item.call_id)) pending.get(item.call_id).ready = true;
          }
          send(message);
        });
        upstream.on('error', () => fail('The voice connection failed. Check API access and try again.'));
        upstream.on('close', () => finish(false));
      } else if (event.type === 'session.close') close();
      else if (event.type === 'session.input_audio.append' && ready && typeof event.audio === 'string' && event.audio.length <= 32_000) upstreamSend({ type: event.type, audio: event.audio });
      else if (event.type === 'tool.result' && ready) {
        const call = pending.get(event.call_id);
        if (!call?.ready || !(typeof event.output === 'string' || Array.isArray(event.output))) return fail('Unexpected tool result.');
        upstreamSend({ type: 'response.item.create', item: { type: 'function_call_output', call_id: event.call_id, output: event.output } });
        pending.delete(event.call_id); completed.add(event.call_id);
        persist({ id, session_id: sessionId, method: 'WS', event: 'tool.completed', tool: call.name, call_id: event.call_id, outcome: event.failed ? 'error' : 'success', duration_ms: Date.now() - call.started });
        // A broken generated scene is retried only after the user speaks again.
        if (!pending.size && !(call.name === 'draw_js' && event.failed)) upstreamSend({ type: 'response.create' });
        if (call.name === 'end_conversation') { send({ type: 'voice.ending' }); close(); }
      }
      // The client selects tool names; schemas and instructions stay server-owned.
    });
    client.on('close', close);
    client.on('error', close);
  });
  return async () => {
    server.off('upgrade', upgrade);
    for (const client of wss.clients) client.close(1001, 'server_shutdown');
    wss.close();
    await writes;
  };
}
