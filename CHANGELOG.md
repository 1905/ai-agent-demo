# Changelog

## Unreleased

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
