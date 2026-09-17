# Changelog

## Unreleased

- Reorganized the README around setup, the Russian lesson, Chat/Voice tools, model and microphone settings, API inspection, and verification. Removed stale navigation instructions and documented independent Voice defaults and the browser-test port difference. Documentation-only change; local links and build checked.

- Voice now saves its own tool selection and defaults to all eight tools, independent of disabled Chat tools. Its speech instructions describe enabled capabilities and explicitly delegate drawing, theme edits, and corrections to the tool-using backend. New connections record configured tool names in metadata.
- Build and 55 Node tests pass. A real Live API smoke test with locally synthesized speech triggered `draw_svg`, submitted its result, continued the response, and closed with final usage and zero errors. Managed browser checks verified all eight tools in the actual Voice session payload, SVG rendering and result submission with simulated provider events, independent settings persistence, and desktop/mobile Settings layouts. The live smoke client saved the SVG to a file.

- Added a saved microphone selector and local input-level test in Settings. Voice uses the selected device on its next connection. Automatic retains the AirPods preference; System default follows the browser default. Missing-device fallback is shown explicitly.
- Microphone tests stop on Stop, dialog close, device selection, navigation, or page exit. Late permission grants release their tracks. Testing is unavailable during an active Voice connection.
- Build and 55 Node tests pass. Managed browser checks verified the level meter with a synthetic tone and silence, saved device choice, actual Voice startup with a simulated connection, fallback/permission errors, late permission cleanup, device changes, and desktop/mobile layouts. Physical microphones and paid provider calls were not tested.
- Removed the ReAct history slide and its animation. The history now covers original ChatGPT, WebGPT, Toolformer, and API function calling; lesson navigation contains fourteen pages.
- Build, all 51 Node tests, and the updated history-sequence check pass. The final removal did not require a new browser run; preceding desktop/mobile history checks are recorded below.
- Added original ChatGPT as the first history slide: November 30, 2022, text-only conversation without tools. A weather question gets a text reply explaining the lack of live access. The next slide explicitly returns to earlier tool-use research. Fifteen pages now lead into the lab.
- Build and 51 Node tests pass. Managed browser checks passed for the new slide and transition at 1280×720 and 320×844, reply animation, reduced motion, pagination, and final lab entry. No live model calls were used.
- Added four Russian history slides after Start: WebGPT (2021), ReAct (2022), Toolformer (February 2023), and OpenAI function calling (June 2023). Short JavaScript sequences show browsing, actions and results, calculator selection, and a structured drawing call. Animations stop on navigation and respect reduced motion. Fourteen pages now lead into the lab.
- Historical dates and claims were checked against primary sources, recorded in `docs/tool-calling-history.md`. The slides present milestones rather than a single invention date.
- Build and 51 Node tests pass. Managed browser checks verified all four history slides at 1280×720 and 320×844, animation phases, cancellation, reduced motion, calculator output, and navigation into the lesson and lab. No live model calls were used.
- Removed the lesson header, logo, lab shortcut, and settings cog. The opening slide has only Start; lesson pagination begins after Start. The final slide opens the lab, where the full header and settings remain available.
- Build and 51 Node tests pass. Managed browser checks passed at 1280×720 and 320×844 for opening/middle/final layouts, lab entry, settings, and return to the lesson. No live model calls were used.
- Added a Russian opening slide with a large title, three lesson topics, staggered entrance animation, and Start. Numbered navigation now includes ten pages.
- API logs separate Request and Response in Simple view. Loading appears only under Response and stays visible while tool arguments are generated. The raw Request receives the exact provider payload before the response finishes; response timing stays out of the Request view.
- Build and 51 Node tests pass. Managed browser checks verified the opening slide at 1280, 390, and 320px, navigation, and reduced motion. API-log checks passed for pending tool generation, completed responses, separate follow-up context, no tools, Copy, errors, cancellation, and mobile layout. Provider responses were simulated; no paid calls were made.

- JavaScript scenes now draw directly into a native canvas from the isolated worker. requestAnimationFrame replaces the 20 FPS timer. Playback no longer copies pixels or encodes PNG; Save PNG captures the visible canvas only on demand.
- Generated JavaScript errors are shown on the page. Chat stops without another model request; Voice returns the failed tool result without requesting automatic continuation. Failed scenes stay stopped across mode changes, and the user can retry with a new message.
- Build and 50 Node tests passed for native rendering. Managed browser checks measured 59.89 frames/second, zero playback PNG encoding, and one capture on Save PNG. Error/manual-retry, timeout, replacement, navigation, reset, and mocked Voice checks passed. No live provider or physical microphone checks were run.

- Tool timing now shows Thinking immediately, then the streamed tool name during argument generation. Completed rows show total model-request-to-execution time, with separate model/transfer and execution times on hover. Chat disconnection aborts the provider stream; failed streams log error outcomes.
- Reduced drawing tools to `draw_svg`, `update_svg`, and `draw_js`. Removed canvas/source reads, basic-shape creation, and page screenshots from Chat/Voice tool selection. CSS tools remain. Saved selections drop retired tools without re-enabling others.
- `update_svg` now edits a unique fragment of full SVG source. `draw_js` receives elapsed `time` and is instructed to animate every drawing. The isolated renderer schedules frames, saves the current frame as PNG, and cleans up on replacement/reset/navigation.
- Build and 49 Node tests pass, including streaming progress before completion, context/trace preservation, fragmented UTF-8 transport, failure logging, provider cancellation, tool availability, and SVG edits. Managed browser checks passed for early Chat/Voice progress, elapsed timing, raw traces, animation motion/export, source edits, retained settings, cancellation, errors, infinite-frame recovery, Voice stop-tool completion, and 320px layouts. Provider responses and microphone startup were simulated; no paid provider or physical microphone checks. Existing browser fixtures were updated and syntax-checked; checks ran through the managed CLI, not the Playwright Test runner.

- Replaced the Live/Demo selector with the current thinking model in Chat and Voice. Settings changes update the idle label; active turns and voice sessions keep their actual model label. Chat now always uses the API.
- Ordered model choices Astra, Sol, Terra, Luna. Terra remains the default and saved choices are preserved.
- Build and 42 Node tests pass. Managed browser checks verified model labels, ordering, persistence, active Chat/Voice model consistency, API failure behavior, and headers at 1280/1024/320px. Model responses and microphone activity were simulated. Former Demo browser fixtures now use API mocks; those test files were syntax-checked.

- Added a live enabled/total count beside Tool calls in Chat and Voice. Individual toggles and All on/off update it immediately; saved selections show on reload.

- Chat now renders fenced code and ASCII drawings in monospace blocks with preserved spacing and line breaks. Fence markers and language labels are hidden; model HTML remains escaped.
- Build and 42 Node tests pass. Managed browser checks verified box/hat drawings, unfinished blocks, preserved trailing spaces, inert HTML, empty replies, and contained horizontal scrolling at 320px. Provider responses were simulated.

- Removed internal workspace references from voice implementation comments and documentation.

- Added Tool settings beside the Tool calls heading in Chat and Voice: individual switches, All on/off, and shared saved preferences. Includes the Voice-only stop tool.
- Chat freezes the enabled tool list for each turn; Voice applies it on connection. All off sends zero tools, with text-only instructions. Disabled calls are rejected before execution. Simple logs explicitly show no tools.
- Build and 39 Node tests pass, including provider payloads, invalid selections, empty tool lists, and blocked disabled Voice calls. Managed browser checks passed at 1280, 390, and 320px for switches, keyboard controls, saved settings, no-tool Chat, selected-tool drawing, turn/session consistency, and Voice reconnect behavior. Provider and microphone activity were simulated.

- Added `draw_js` for complete Canvas 2D scenes and `draw_svg` for full SVG documents in Chat and Voice. Full SVG supports paths, text, gradients, groups, filters, and arbitrary SVG colors and geometry.
- Saved scene source is available through `read_svg`; `read_canvas` checks the complete result. Drawings survive mode changes. JavaScript exports PNG; SVG exports SVG. Errors leave the previous drawing intact.
- JavaScript runs in an isolated worker with a two-second execution limit and blocked network access. SVG stays in image context. Browser checks passed for dev and built renderers, exports, source/image reads, Voice sharing, blocked network/DOM access, errors, timeouts, cancellation, and reset. Model responses were simulated; no live provider or microphone checks.
- Simplified the API log further: message text, tool names, and short result labels only. Code, arguments, IDs, model settings, images, and request metadata remain in raw tabs. Long context shows six recent messages and an earlier-message count.
- Build and 33 Node tests pass. Simple/raw views, Copy, full trace preservation, and wrapped desktop/mobile layouts passed managed browser checks with simulated responses. Four new artwork browser tests were added and syntax-checked; equivalent checks ran through the managed CLI, not the Playwright Test runner.

- Focused the Russian presentation on nine progressive tool-calling steps: text, drawing command, local action, weather request, returned data, full context, and a fresh model call.
- Weather now returns detailed English JSON. The next slide sends the exact data, original Russian question, and earlier tool call back to the LLM. Only then does the model give a useful Russian answer.
- Replaced floating spheres with avatars attached to user/AI/tool messages. Function execution is a separate application panel, not a chat message.
- Removed history, sources, downloads, replay, and execution buttons from the presentation. Next drives the lesson; animations run automatically. Optional “Подробнее” shows highlighted teaching JSON.
- Added a default Simple tab to API logs. It summarizes messages, tool calls, and results; original Request/Response JSON and Copy remain available.
- Added Luna and Sol alongside Terra and Astra. Chat and Voice share a saved reasoning-effort setting, defaulting to Medium; active turns/sessions keep their starting settings.
- Build and 28 automated tests pass. All nine steps passed browser checks at 1280×720, 390×844, and 320×844, including the exact weather JSON carried into the next request. Narrow-screen overlap and navigation overflow are fixed. Earlier avatar, automatic execution, navigation cancellation, Simple/raw log, Copy, settings persistence, and simulated Voice checks passed without paid calls. Live provider and microphone checks were not repeated.

- Added a microphone on/off toggle next to Settings, visible only while Voice is connected. Muting disables microphone tracks and sends silence; the connection, agent playback, and drawing tools stay active.
- Build and 23 tests pass. Synthetic audio and browser checks verified mute/unmute, continued playback/tools, keyboard control, connection visibility, and desktop/mobile layout. Live provider and physical microphone checks were not repeated.

- Added a top-right settings cog and a shared Chat/Voice thinking-model selector. Terra is the default; Astra remains available. The browser remembers the selection. Active Chat turns and Voice sessions keep their current model.
- Server requests validate model selections; speech, instructions, and tools remain server-owned. Build and 22 tests pass. Browser checks verified selection persistence, request models, active-turn stability, and drawing preservation with simulated provider calls. Live provider and microphone checks were not repeated.
- Settings fit desktop and 320/390px screens. Existing lesson pagination still causes 11px of page overflow at 320px; Chat and Voice fit.

- Consolidated all site styles into readable `public/site.css`, with descriptive classes and editable color/font variables.
- Added Chat/Voice tools to read, edit, replace, screenshot, and reset the theme. Edits stay in the page session; refresh restores the original CSS. Drawing and voice sessions survive theme edits.
- Added Reset theme and an Alt+Shift+R recovery shortcut. Font families, weights, sizes, and web-font imports are editable.
- Changed Voice tool decisions to GPT-6 Astra; GPT-Live still handles speech. Added `make dev` (port 5180 by default).
- Build and 19 automated tests pass. Browser checks passed for theme/font edits, screenshots, recovery, and shared Chat/Voice tools with simulated model calls. All 12 lesson slides passed desktop/mobile checks. `make dev` startup passed on a separate test port. Live Voice with Astra and physical microphone hardware were not retested.

- Copied the glossy purple speaking bubble from `voice_chat_mcp`, including its highlights, rings, and audio smoothing. It follows assistant playback, with a separate Start/Stop control.
- Added playback-level sampling and scoped animation cleanup. Build and 17 tests pass. Local PCM playback drove the bubble; silence, connecting, Stop/Reset, reduced motion, desktop/mobile layout, and navigation cleanup passed browser checks.
- A test setup error briefly opened a live session with 1 second of finalized provider usage. It closed; the corrected checks blocked live connections. Physical microphone hardware was not retested.

- Replaced movie/weather examples with one SVG story: suggest a color, create a red circle, then update the same circle to blue. Updated the downloadable API example.
- Chat retains its selected model mode when switching to Voice and back. Both views keep the shared canvas and shape IDs.
- Build and 17 automated tests pass. All 12 slides passed desktop/mobile checks. Chat ↔ Voice preserved shape IDs, colors, and SVG exports; simulated voice edits also persisted back to Chat.
- Missing-key and unavailable-API checks passed: Voice shows the error and disables Start; returning to Chat preserves the drawing and working Demo mode.
- The actual downloaded example passed five mocked API calls with explicit context and red-to-blue SVG updates. No paid model calls or physical microphone checks were used for this change.

- Added a Voice tab using the same SVG tools and canvas, with microphone controls in place of text input.
- Copied microphone/audio playback helpers from `voice_chat_mcp` and adapted its Live speech plus Responses delegation flow.
- Added server-owned voice configuration, local-key WebSocket proxy, graceful shutdown, and metadata-only session/model usage records.
- Build and 17 automated tests pass. Live spoken red-circle → blue-circle flow passed with injected speech, canvas image checks, spoken replies, and persisted model usage.
- Goodbye closed the Live session with confirmed final usage. Immediate shutdown can cut off farewell speech and leave the final delegated response usage unknown; records mark it incomplete.
- Permission denial, Stop/navigation microphone cleanup, and mobile checks passed. Physical microphone/speaker hardware remains untested. The copied capture implementation uses deprecated `ScriptProcessorNode`.

- Simplified drawing tool rows to the tool name and measured execution time. Removed arguments, shape details, and result text from the pane.
- Removed empty-state slogans, helper text, and suggestion buttons from the drawer.
- Added `read_canvas`: a full-canvas PNG and shape metadata returned to the model for visual inspection before and after drawing changes.
- Added a JSON inspector below the drawer with numbered calls, Request/Response tabs, syntax highlighting, and Copy. Credentials remain excluded; Reset clears the in-memory log.
- Raised the loop limit to 32 model calls and the request limit to 5 MB for multi-shape work and canvas image context.
- Build and 13 automated tests pass. Real API smoke passed: three circles, canvas images before/after drawing, and six inspectable request/response pairs.
- Browser checks passed for exact canvas image colors after updates, JSON escaping, Copy, reset/cancellation, measured timing, and mobile layout. Browser sessions were cleaned up.
- The drawer now starts in Live mode. It does not silently switch to a simulated response when the API is unavailable.
- Added separate messages for missing API configuration, exhausted credits, quota, spending limits, and temporary provider limits.
- Project `.env` settings now override inherited shell credentials. The previous shell key returned `credit_balance_exhausted`.
- Real Live drawing passed with the project key: red circle to blue circle kept `shape-1`, with create/read/update calls and five successful API responses.
- Fixed chat text extraction from model messages. Empty model text now shows actual tool results instead of falsely claiming no drawing change.
- Mocked Live checks passed: five requests preserved context and matched create/read/update results. Missing configuration stays in Live mode with Send disabled.

- Added a Draw view with three columns: chat, tool calls, and a square SVG canvas.
- Added create, read, and update tools with stable shape IDs and validated attributes.
- Added a local demo for simple shape, color, size, and position commands.
- Added optional live OpenAI tool calling through a server-side endpoint. API keys remain on the server.
- Added SVG download, reset, request cancellation, and visible tool results.
- Build and focused demo checks passed: red circle to blue circle preserves the shape ID, with a square canvas and ordered chat/tool/drawing columns.
- Browser checks passed for read, resize, movement, SVG export, reset cancellation, view switching, and mobile sizing.
- All 12 lesson pages and their existing interactions passed browser regression checks. Invalid tool arguments fail without crashing the drawer.
- Eleven unit, API, and environment tests passed. The final build passed. Browser sessions were cleaned up after checks.
- Backend metadata records route, outcome, duration, provider/model, usage, and unknown cost without storing messages or credentials.
