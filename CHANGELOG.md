# Changelog

## Unreleased

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
