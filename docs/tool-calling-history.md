# History slides: sources and scope

Checked on 2026-09-17. The first history slide establishes the original ChatGPT experience: a text conversation without browsing, code execution, or tool calls. Three research/API milestones follow. They do not identify a single inventor or claim that tool use began in 2021. Ordinary programming functions existed much earlier.

The order is deliberate: the November 2022 product launch comes first as a familiar baseline. The next slide explicitly states that research started earlier, then returns to WebGPT in 2021. The slides do not imply that ChatGPT preceded WebGPT.

| Slide | Date | Supported claim | Primary source |
| --- | --- | --- | --- |
| Original ChatGPT | November 30, 2022 | The launch introduced a conversational text model. Browsing, code execution, and third-party tool access arrived later through the plugin rollout. | [ChatGPT launch](https://openai.com/index/chatgpt/), [plugin announcement, March 23, 2023](https://openai.com/index/chatgpt-plugins/) |
| WebGPT | December 2021; paper first submitted December 17 | GPT-3 was trained to search and navigate a text-based browser and collect references for answers. | [WebGPT paper](https://arxiv.org/abs/2112.09332) |
| Toolformer | February 2023; paper first submitted February 9 | The model was trained to choose APIs, timing, and arguments, and use returned results. Tools included a calculator, search, translation, and a calendar. | [Toolformer paper](https://arxiv.org/abs/2302.04761) |
| OpenAI function calling | June 13, 2023 | OpenAI introduced function calling in the Chat Completions API for updated GPT-4 and GPT-3.5 Turbo models. Developers described functions; the model returned structured function names and arguments. The application executed the function. | [OpenAI announcement](https://openai.com/index/function-calling-and-other-api-updates/) |

The weather conversation, browser, calculator, and drawing animations are teaching illustrations. They are not historical transcripts. `247 × 38` and `draw_circle` are local examples, not historical API specifications. The historical API used `functions` and `function_call`; the current lab uses the Responses API.

The slides use months for paper dates, not later conference dates. The sources stay in this document to keep the presentation free of extra controls.
