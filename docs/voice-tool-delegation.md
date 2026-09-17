# Voice tool delegation

The speech model and reasoning backend have separate instructions. Tool schemas belong to `delegation.responses.tools`. The speech prompt must also describe the enabled capabilities and state when to delegate.

Two recent sessions had no recorded backend responses or tool calls. The earlier speech prompt said only to delegate requests; it did not describe drawing or theme capabilities. This was the observed failure pattern, not proof of a single cause.

The fix lists a short description of each selected tool and explicit delegation conditions for drawings, changes, and corrections. Voice also has independent saved tool settings and defaults to all eight tools. Reconnect after changing settings.

Source: [OpenAI Live prompting guide](https://developers.openai.com/api/docs/guides/live-prompting). The guide recommends a short frontend prompt with explicit delegation policy and backend capabilities. Full tool schemas and procedures remain in the backend prompt.

Validation on 2026-09-17: the running application proxy received locally synthesized speech asking for an SVG red circle. The real Live API delegated, called `draw_svg`, accepted a tool result, continued, and finalized the session without errors. The smoke client saved the returned SVG to a file. Browser rendering and tool-result submission are tested separately with simulated provider events. Physical microphone input was not part of this smoke test.
