# Agent Lab

An interactive first lesson on LLM APIs and function calls. A Russian opening slide introduces the three topics: request and response, tool calls, and results with context. Four animated history slides follow: original text-only ChatGPT, then a return to earlier research with WebGPT, Toolformer, and API function calling. Dates and scope are documented in [history sources](docs/tool-calling-history.md). Nine practical lesson slides then introduce tools: first a command that draws a circle without returning data, then a weather tool that returns detailed English JSON. The application sends that data, the original Russian question, and the prior tool call back to the model. The model then gives a short Russian answer. Chat and Voice remain in English.

## Local development

Requires Node.js 20.19+ (or 22.12+).

```sh
npm install
make dev
```

Open http://localhost:5180. Use `make dev PORT=5190` for another port. The opening slide has only Start. After Start, use numbered pages, navigation buttons, arrow keys, or horizontal swipes. The final slide opens the lab. The lesson has no app header; the logo, model label, Chat/Voice tabs, and settings appear in the lab. The dark lesson uses large chat messages for screen sharing. “Подробнее” opens highlighted teaching JSON: message text, tool names, and short descriptions. It is explicitly an explanatory format, not an API payload. Drawing and weather are scripted examples; the weather card labels its fixed data. Next drives the lesson; reply and action illustrations animate automatically. Function execution uses a separate application panel, followed by a tool-result chat message when data is returned. History, sources, code downloads, and execution controls are absent from the presentation. Chat and Voice use the configured API. The header shows the current thinking model.

## Build and verify

```sh
npm run build
npm test
npx playwright install chromium
npx playwright test
```

The browser tests exercise every lesson step, drawing results, chat avatars, teaching JSON, keyboard navigation, mobile layout, and cancellation when navigating away from an active animation.

## Real API example

The repository includes `examples/lesson.mjs` for both lesson examples. Run it on a server, never in the browser. Real model calls incur usage charges; its weather data is a fixed teaching fixture.

```sh
npm install --no-save openai
# Set OPENAI_API_KEY in your environment through your usual secret manager.
node examples/lesson.mjs
```

The first API call requests `draw_circle`. The function writes `drawing.svg` without returning data, and that task ends. The weather example requests `get_weather`, runs it, then makes a new API call with the question, every model output item, and the weather result matched by call ID. The example uses three model calls in total and stops on errors.

If a conversation continues after a command without a return value, send a success or failure status as its tool result. The existing `examples/agent.mjs` remains available for the longer red-circle-to-blue drawing loop with the drawer's validated shape store.

## Sources

- [Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762)
- [OpenAI API introduction (2020)](https://openai.com/index/openai-api/)
- [Function calling introduction (2023)](https://openai.com/index/function-calling-and-other-api-updates/)
- [OpenAI function calling guide](https://developers.openai.com/api/docs/guides/function-calling)

Built with vanilla JavaScript, CSS, and Vite. No backend is needed for the lesson. Respects reduced-motion preferences. Fonts use Google Fonts with system fallbacks.

## SVG drawer

The settings button beside **Tool calls** opens a shared Chat/Voice tool list. Each tool has a switch; **All on** and **All off** make the demonstration quick. All tools start enabled. The browser remembers the selection across mode switches and reloads. Reset canvas keeps these settings.

Chat sends the selected tools with the next message and keeps that selection for the whole turn. Voice uses the selection at connection time; reconnect to apply changes. `end_conversation` is marked Voice only and can also be disabled. The Stop button remains available. All off sends an empty tool list and the model can only answer with text. Simple logs show `tools: "None"`; raw logs show the exact provider tool list. The server owns and validates tool definitions, and disabled tool calls cannot execute.

Live Chat and Voice can draw a complete scene in one call:

- `draw_js({code})` draws animated Canvas 2D scenes. The app runs the frame body with `ctx`, `width`, `height`, and `time` (elapsed seconds), on a cleared 640×640 canvas. Instructions require visible motion. Try “Draw an animated solar system in JavaScript.”
- `draw_svg({svg})` accepts a complete SVG document. Paths, text, groups, gradients, masks, filters, patterns, and transforms are supported. It has no basic-shape count, geometry, or color restriction. Try “Draw an SVG koi fish with flowing fins and gradients.”
- `update_svg({find, replace})` edits one exact, unique fragment of the current SVG source. It preserves the rest of the drawing. It rejects missing or ambiguous matches and invalid SVG.
- `draw_js` and `draw_svg` replace the entire canvas. Canvas-reading, basic-shape creation, and screenshot tools are no longer offered. Previous source is available in conversation context; there are no model image checks.

Drawings and their source survive Chat/Voice navigation. Reset clears them. JavaScript drawings export their current frame as PNG; SVG drawings export as SVG with the document embedded as an image.

JavaScript runs in a worker inside an opaque-origin sandbox frame. Its CSP blocks network and external scripts; each frame has a two-second execution limit. The visible sandbox frame owns a real HTML canvas and transfers it directly to its worker through OffscreenCanvas. The page schedules frames with requestAnimationFrame, with one frame in flight and no fixed FPS cap. Playback performs no PNG encoding or pixel readback. PNG encoding happens only when Save PNG is clicked. Syntax and runtime errors appear on the page. Failed code does not trigger an automatic model retry. New-code errors preserve the previous drawing; errors after animation starts stop the scene. Reset, replacement and navigation stop its worker; returning to Chat or Voice restarts a healthy saved animation. Failed scenes stay stopped until the user requests a new drawing. DOM access, external libraries and model-created timers are unsupported. SVG is rendered only in image context; scripts and external resources do not run. Source is limited to 100,000 characters per call. This is a local presentation tool, not a general-purpose hostile-code execution service.

Implementation references: [worker CSP inheritance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [OffscreenCanvas transfer](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen), [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), and [SVG image restrictions](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image). Browser checks cover the actual renderer; provider responses are simulated during automated checks.

Open `/#draw` or choose **Рисовать** in the lesson header. The desktop view has three columns: chat, tool calls, and a square drawing canvas.

Try **Draw a red circle**, then **No, make it blue**. The update edits the existing SVG. The side pane immediately shows Thinking with an elapsed timer. Streaming reveals the tool name while its arguments are still being generated. The completed row shows total time from that model request through execution (first frame for animations). Hover the timer for model/transfer time and local execution time separately. Each new API request gets its own timer; plain text responses leave no tool row. Save SVG exports the current drawing. Reset clears the canvas and conversation.

The API log below the drawer opens each new call on the Simple tab. Separate Request and Response sections show compact teaching JSON: message text, tool names, and short results such as “Drawing updated.” It hides code, arguments, IDs, model settings, image data, and request timing. Long context shows six recent messages plus a count of earlier messages. The raw Request and Response tabs retain complete JSON. Request contains only outgoing data; the server sends the exact provider payload to the inspector before waiting for completion. Response shows a loading indicator until the full model output arrives, including during tool-argument generation. The indicator is UI state, not fabricated response JSON. Response timing appears only in the Response tab. JSON supports highlighting and Copy; pending responses cannot be copied. Successful calls show the model request body and response body. Failed calls show the application error response. Authentication headers and API keys are excluded. These inspectable bodies stay in browser memory and clear on Reset; operational disk logs still contain metadata only.

The drawer sends real tool requests through the OpenAI Responses API. It requires `OPENAI_API_KEY` in the server environment or a local `.env` file. Values in the project `.env` take priority over inherited shell settings. The top-right settings cog lists Astra, Sol, Terra, and Luna in that order for both Chat and Voice. The header shows the active model; while idle, it shows the model selected for the next turn or session. Terra is the default. Reasoning effort offers Low, Medium, High, Extra high, and Maximum; Medium is the default. Both selections are saved in this browser and apply to the next Chat turn or Voice session. `OPENAI_DRAW_MODEL` sets the fallback for API requests without a model selection. Restart Vite after changing environment settings. The server key is never sent to the browser. Missing configuration or provider errors do not switch to simulated responses.

The Vite development and preview servers provide `/api/draw/status` and `/api/draw/turn`. Chat and Voice require their server endpoints; the lesson can run as a static site. API calls use provider credits. The browser executes validated drawing tools and sends their results with the full earlier context in a new request. It stops after 32 model calls per user message, allowing several tool actions in one turn. Chat uses [streaming function calls](https://developers.openai.com/api/docs/guides/function-calling#streaming); disconnecting the client aborts the provider request.

Backend request metadata is persisted in `.local/draw-api.jsonl`. Records contain route, status, duration, correlated provider response IDs, model, and provider usage when returned. They do not contain messages, drawing content, or credentials. Provider cost is recorded as unknown, not zero.

The command lesson ends after one API request and local execution. The weather lesson follows two independent API requests. Amber cards represent structured tool calls; green cards represent returned data. The app resends instructions, tools, and full prior model output as context. Hosted conversation storage is an alternative to carrying history in the app; it still supplies context to each model call. See [conversation state](https://developers.openai.com/api/docs/guides/conversation-state).

## Voice drawing

Choose **Voice** after **Chat**, or open `/#voice`. Click **Start voice**, allow microphone access, and speak. The same canvas and `draw_svg`, `update_svg`, and animated `draw_js` tools are used. Switching between Chat and Voice keeps the drawing and saved source. A new Voice session has separate conversation context; if it lacks the source, the model must explain before replacing the drawing. Reset clears the drawing; reloading the page starts a new drawing. There is no text input in Voice. The purple bubble from `voice_chat_mcp` reacts to assistant audio playback. It settles during silence and respects reduced-motion settings. A short live caption shows the current speech. Stop, Reset, and leaving the view release the microphone and audio playback.

While Voice is connected, the microphone toggle appears next to Settings. Switch it off to mute your input while the agent continues speaking and drawing. Switch it on to resume. Each new session starts with the microphone on.

The voice implementation uses microphone timeout/cancellation helpers and a PCM playback worklet. Capture and Live delegation use the shared drawing tools.

The Vite server proxies `/api/voice` to OpenAI Live over WebSocket. The project `.env` key stays on the server. `gpt-live-1` handles speech; `gpt-5.6-terra` handles drawing and theme decisions by default. Settings can select Luna, Sol, or Astra and change reasoning effort. The default effort is Medium. `OPENAI_VOICE_DRAW_MODEL` sets the fallback for sessions without a model selection. The key needs access to both models. The server validates thinking model selections and supplies the speech model, instructions, and tool definitions. No automatic reconnect occurs. Each voice session has a ten-minute limit.

Tool outputs return to the delegated model before continuation. The inspector keeps the latest 200 voice control events. Continuous audio packets and transcript fragments are excluded from that JSON view. Stop requests a graceful provider close; a timeout or dropped connection leaves final usage marked unconfirmed.

Voice metadata is written to `.local/voice-api.jsonl`: session outcome/duration, correlated delegated model responses, returned usage, and tool names/timings. Audio, transcripts, tool arguments, and canvas images are excluded. Cost stays unknown unless available; final voice usage and delegated-model usage remain separate.

References: [Live WebSockets](https://developers.openai.com/api/docs/guides/voice-websockets), [Live delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation).

## Live theme editing

All site styling is in `public/site.css`, with readable sections, descriptive classes, and color/font variables at the top. There are no separate component CSS files. The agent can edit every rule, including layout, gradients, animations, responsive styles, font families, weights, sizes, and web-font imports.

Both Live Chat and Voice offer `read_site_css`, `edit_site_css` (exact replacements), `replace_site_css` (complete replacement), and `reset_site_css`. Try “Make the whole site a warm cream theme with dark text and a serif font,” then “Restore the original theme.”

Theme edits apply immediately to the current page without restarting audio or clearing the drawing. They survive navigation between Lesson, Chat, and Voice. **Refresh or Reset theme restores the original CSS.** The file on disk stays unchanged. Reset theme also has an `Alt+Shift+R` shortcut that works if edited CSS hides the controls. Reset canvas is separate.

The model receives CSS tool results but no screenshot. It must not claim visual verification.

CSS edits require the latest revision, reject malformed CSS, and apply batches atomically. The existing model request logs retain their metadata-only disk logging; CSS appears only in the conversation/API inspector sent to the model.
