# Agent Lab

An interactive first lesson on LLM APIs, function calls, and agent loops. Twelve focused steps cover the history, request/response flow, structured tool calls, application execution, explicit context, stateless model calls, and a runnable server-side example.

## Local development

Requires Node.js 20.19+ (or 22.12+).

```sh
npm install
npm run dev
```

Open http://localhost:5173. Use Next / Back, left/right arrow keys, or swipe horizontally on mobile. The dark lesson uses large text for screen sharing and shows one concept at a time, with no JSON panels or code blocks. Download the JavaScript example at the end. The playground works without an API key. All weather, catalog, and agent outputs in the browser are explicitly simulated.

## Build and verify

```sh
npm run build
npm test
npx playwright install chromium
npx playwright test
```

The browser tests exercise every lesson step, forecast outcomes, downloads, source links, keyboard navigation, mobile layout, and cancellation when navigating away from an active animation.

## Real API example

The downloadable `examples/agent.mjs` uses the OpenAI Responses API and local fixture tools. Run it on a server, never in the browser. Real model calls incur usage charges.

```sh
npm install --no-save openai
# Set OPENAI_API_KEY in your environment through your usual secret manager.
node examples/agent.mjs
```

The example validates tool arguments, dispatches only allowlisted functions, returns tool errors as observations, preserves every model output item, and stops after six rounds. Replace the fixture handlers with real services to extend it. The model ID is explicit and can be changed to a compatible Responses API model available to your account.

## Sources

- [Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762)
- [OpenAI API introduction (2020)](https://openai.com/index/openai-api/)
- [ReAct (2022)](https://arxiv.org/abs/2210.03629)
- [Function calling introduction (2023)](https://openai.com/index/function-calling-and-other-api-updates/)
- [OpenAI function calling guide](https://developers.openai.com/api/docs/guides/function-calling)

Built with vanilla JavaScript, CSS, and Vite. No backend is needed for the lesson. Respects reduced-motion preferences. Fonts use Google Fonts with system fallbacks.

## SVG drawer

Open `/#draw` or choose **Draw** in the lesson header. The desktop view has three columns: chat, tool calls, and a square drawing canvas.

Try **Draw a red circle**, then **No, make it blue**. The update keeps the original shape ID. The side pane shows only each tool name and its execution time, excluding API latency and animation delays. Save SVG exports the current drawing. Reset clears the canvas and conversation.

`read_canvas` returns a PNG of the complete drawing plus every shape ID and attribute. The model receives the image as image input in its next call. Instructions require canvas inspection before drawing and after changes, so it can check spacing, overlap, and colors. `read_svg` remains available for data-only inspection.

The API log below the drawer shows numbered calls, with Request and Response tabs, JSON highlighting, and Copy. Successful calls show the model request body and response body. Failed calls show the application error response. Authentication headers and API keys are excluded. These inspectable bodies stay in browser memory and clear on Reset; operational disk logs still contain metadata only.

The drawer starts in Live mode and sends real tool requests through the OpenAI Responses API. It requires `OPENAI_API_KEY` in the server environment or a local `.env` file. Values in the project `.env` take priority over inherited shell settings. Set `OPENAI_DRAW_MODEL` to override the default model. Restart Vite after changing environment settings. The server key is never sent to the browser. Missing configuration or provider errors do not switch to simulated responses.

Demo mode is an explicit alternative in the mode selector. It uses a limited local command parser, not an LLM. It supports circles, rectangles, ellipses, named colors, size changes, and movement.

The Vite development and preview servers provide `/api/draw/status` and `/api/draw/turn`. A static-only deployment supports Demo mode; Live mode also needs this server endpoint. Live calls use provider credits. The browser executes validated drawing tools and sends their results with the full earlier context in a new request. It stops after 32 model calls per user message, allowing multi-shape drawings and visual checks.

Backend request metadata is persisted in `.local/draw-api.jsonl`. Records contain route, status, duration, correlated provider response IDs, model, and provider usage when returned. They do not contain messages, drawing content, or credentials. Provider cost is recorded as unknown, not zero.

The tool lesson follows two independent API requests. Amber cards represent structured tool calls; green cards represent tool results. The app resends instructions, tools, and full prior model output as context. Hosted conversation storage is an alternative to carrying history in the app; it still supplies context to each model call. See [conversation state](https://developers.openai.com/api/docs/guides/conversation-state).

## Voice drawing

Choose **Voice** after **Chat**, or open `/#voice`. Click **Start voice**, allow microphone access, and speak. The same SVG canvas and `create_svg`, `update_svg`, `read_svg`, and `read_canvas` tools are used. There is no text input in this mode. A short live caption shows the current speech. Stop, Reset, and leaving the view release the microphone and audio playback.

The microphone and playback implementation comes from `voice_chat_mcp`. This app copies its microphone timeout/cancellation helpers and PCM playback worklet, and adapts its capture and Live delegation flow to the shared drawing tools.

The Vite server proxies `/api/voice` to OpenAI Live over WebSocket. The project `.env` key stays on the server. `gpt-live-1` handles speech; `gpt-5.6-terra` handles drawing decisions. Set `OPENAI_VOICE_DRAW_MODEL` to override the drawing model. The key needs access to both models. Model settings and tool definitions are supplied by the server. No automatic reconnect occurs. Each voice session has a ten-minute limit.

Tool outputs, including canvas images, return to the delegated model before continuation. The inspector keeps the latest 200 voice control events. Continuous audio packets and transcript fragments are excluded from that JSON view. Stop requests a graceful provider close; a timeout or dropped connection leaves final usage marked unconfirmed.

Voice metadata is written to `.local/voice-api.jsonl`: session outcome/duration, correlated delegated model responses, returned usage, and tool names/timings. Audio, transcripts, tool arguments, and canvas images are excluded. Cost stays unknown unless available; final voice usage and delegated-model usage remain separate.

References: [Live WebSockets](https://developers.openai.com/api/docs/guides/voice-websockets), [Live delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation).
