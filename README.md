# Agent Lab

An interactive lesson and live playground for learning how LLM tool calls work. The presentation is in Russian. The lab interface is in English; Voice responds in the language you speak.

The lesson shows the full loop: send a request, receive a structured tool call, execute it, and send the result back with context. Chat and Voice let you try that loop with drawings, animations, and live theme changes.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
make dev
```

This installs dependencies when needed and starts the app at **http://localhost:5180**. Use `make dev PORT=5190` for another port.

The presentation works without an API key. For live Chat and Voice, create `.env` from [.env.example](.env.example) if one does not already exist, then set `OPENAI_API_KEY`. Restart the server after changing environment settings.

The project `.env` overrides inherited shell settings. The key stays on the server. Real model calls use provider credits; missing credentials or provider errors are shown in the app.

## Presentation

Fourteen pages progress from the opening title to the lab:

1. **Start:** request/response, tool calls, and context.
2. **Four history slides:** original text-only ChatGPT, a return to earlier WebGPT research, Toolformer, and API function calling.
3. **Nine practical slides:** a drawing command, local execution, a weather tool, returned data, a new request with context, and the final answer.

Use Next, numbered pages, arrow keys, or horizontal swipes. The final page opens the lab. The opening page shows only Start; app controls appear in the lab.

Large chat messages distinguish user requests, model text, structured tool calls, and tool results. Function execution appears separately as an application action. “Подробнее” shows highlighted explanatory JSON, not an exact API payload.

The drawing and weather examples are scripted. Weather returns detailed English JSON. The application sends it back with the original Russian question and prior tool call. Only then does the model give a short Russian answer. Each model call receives its context explicitly.

Historical dates and sources are recorded in [tool-calling history](docs/tool-calling-history.md).

## Chat and Voice lab

Open `/#draw` for Chat or `/#voice` for Voice. The desktop layout has three columns: conversation, tool calls, and a square canvas.

Try:

- “Draw a red circle using SVG.” Then: “No, make it blue.”
- “Draw an animated solar system in JavaScript.”
- “Make the site cream with dark text and a serif font.” Then: “Restore the original theme.”

The tool pane shows model waiting time, tool generation, and completion. Completed rows show total time; hover the timer for model/transfer and local execution time.

Drawings survive switches between Chat and Voice. A new Voice connection has separate conversation context; the model may need to replace an existing drawing if its source is unavailable. Reset clears the canvas and conversation. Reload starts a new drawing.

### Tools

| Tool | Action |
| --- | --- |
| `draw_svg` | Replace the canvas with a complete SVG document. |
| `update_svg` | Replace one exact, unique fragment of the current SVG source. |
| `draw_js` | Replace the canvas with an animated JavaScript scene. |
| `read_site_css` | Read the current site stylesheet and revision. |
| `edit_site_css` | Apply exact replacements to the stylesheet. |
| `replace_site_css` | Replace the complete stylesheet. |
| `reset_site_css` | Restore the original theme. |
| `end_conversation` | Stop Voice; unavailable to Chat. |

Open the settings button beside **Tool calls** to toggle tools, or use **All on / All off**. The heading shows the selected count.

**Voice starts with all eight tools enabled, independent of Chat settings.** Each mode saves its own selection in the browser. Chat captures the selection for a whole turn. Voice captures it when connecting; reconnect after changes. All off sends no tools. The server supplies the schemas and rejects disabled tool calls.

Chat uses seven executable tools. The selector also displays the eighth, marked **Voice only**; Chat filters it out before sending the request.

### Models and microphone

The top-right cog contains model, reasoning, and microphone settings.

- Thinking models: **Astra, Sol, Terra, Luna**. Default: **Terra**.
- Reasoning effort: Low, Medium, High, Extra high, Maximum. Default: **Medium**.
- Microphone: Automatic, System default, or a specific device. Automatic prefers AirPods when available.
- **Test microphone:** a local input-level meter. It sends no audio to the API and does not play audio through speakers.

Model and reasoning choices apply to the next Chat turn or Voice connection. Microphone selection applies to the next Voice connection. Stop Voice before testing the microphone. Closing Settings or leaving the view stops the test. If the selected device is missing, the app reports its fallback to the system default.

Start Voice, allow microphone access, and speak. The bubble responds to assistant audio; captions show the current speech. The microphone toggle beside Settings appears only while connected. Muting it stops your input while the agent can keep speaking and drawing. Stop, Reset, or leaving Voice releases audio resources.

`gpt-live-1` handles speech and delegates drawing and theme work to the selected thinking model. The default backend is `gpt-5.6-terra`. The key needs access to both. Sessions last at most ten minutes and do not reconnect automatically. See [Voice delegation notes](docs/voice-tool-delegation.md) for the handoff and validation details.

`OPENAI_DRAW_MODEL` and `OPENAI_VOICE_DRAW_MODEL` set server fallbacks when a request omits a model selection. Browser settings send an explicit model choice.

### Drawings and theme changes

SVG supports complete documents, including paths, text, gradients, groups, and filters. SVG runs in image context; scripts and external resources are disabled. Save exports the drawing as SVG.

JavaScript draws Canvas 2D frames with `ctx`, `width`, `height`, and elapsed `time`. Instructions require visible animation. Rendering uses a worker and OffscreenCanvas with `requestAnimationFrame`, one frame in flight, and no fixed FPS cap. Playback does not convert frames to PNG. **Save PNG** captures the current frame.

Generated code has no DOM, network, imports, or custom timers. Each frame has a two-second execution limit; source is limited to 100,000 characters per call. Errors appear in the app and require a user retry. There are no canvas-reading or screenshot tools, so the model cannot visually inspect its output.

All site styling lives in [public/site.css](public/site.css). Theme tools can change colors, layout, animations, fonts, and web-font imports. Changes apply in browser memory and survive navigation. They do not edit the file on disk.

**Refresh, Reset theme, or `Alt+Shift+R` restores the original CSS.** Reset canvas is separate. CSS changes require the current revision and must parse before they apply.

### API inspector and logs

The inspector below the lab separates outgoing Request from incoming Response. **Simple** shows message text, tool names, and short results. Raw views retain the complete JSON. Request never contains response status; Response shows loading until the model output is complete. Highlighting and Copy help inspect finished entries.

Chat sends tool results with prior context in a new Responses API request, with a limit of 32 calls per user message. Voice sends tool results back to its delegated backend before continuing. Its inspector retains the latest 200 control events and excludes continuous audio packets and transcript fragments.

Inspectable request bodies stay in browser memory and clear on Reset. Authentication headers and API keys are excluded.

The Vite development and preview servers provide `/api/draw/status`, `/api/draw/turn`, and the `/api/voice` WebSocket. Only the lesson can run without these endpoints.

Operational metadata is saved under `.local/`:

- `draw-api.jsonl`: request outcome, duration, model, provider response IDs, and usage.
- `voice-api.jsonl`: session outcome, configured tool names, tool timings, delegated responses, and usage.

These disk logs exclude message content, audio, credentials, and drawing source. Unknown cost stays `null`, not zero. Voice close waits for final usage; timeouts or lost connections leave it unconfirmed.

## Build and verification

```sh
make build
make test
```

The current verification includes 55 passing Node tests and managed browser checks for tool selection, drawing execution, API inspection, microphone controls, and responsive layouts. A real Live API check used locally synthesized speech to trigger `draw_svg`, return its result, and continue the response. Physical microphone hardware was not part of that automated check.

Browser specifications live in [tests/browser](tests/browser). The Playwright Test configuration currently targets port **5173**, separate from `make dev` on **5180**. Do not reuse an unrelated service on 5173 when running those specifications. Latest browser verification used the managed Playwright CLI against 5180; it was not a full Playwright Test runner pass.

## Standalone API example

[examples/lesson.mjs](examples/lesson.mjs) implements the drawing command and weather loop with real API calls. It uses `OPENAI_API_KEY` from the environment and writes `drawing.svg`. Weather data remains a fixed teaching fixture.

With the key set in the shell environment:

```sh
node examples/lesson.mjs
```

The example makes three model calls: one drawing call and two weather calls. The weather continuation includes the original question, all previous model output items, and the tool result matched by call ID. If a command-only conversation continues, it must also return a success or failure tool result.

Built with vanilla JavaScript, CSS, and Vite. See [CHANGELOG.md](CHANGELOG.md) for changes and validation limits.
