// Server-side only. Install: npm install openai
// Set OPENAI_API_KEY, then: node examples/agent.mjs
// Real model calls update drawing.svg. API usage is charged.
import OpenAI from 'openai';
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import { writeFile } from 'node:fs/promises';
import { createDrawingStore, drawingTools, exportDrawing } from '../src/drawing-tools.js';

const client = new OpenAI();
const store = createDrawingStore();
// This CLI reads shape data. The browser also offers image-based read_canvas.
const tools = drawingTools.filter(tool => tool.name !== 'read_canvas');
const input = [];

for (const prompt of ['Draw a red circle.', 'Make it blue.']) {
  input.push({ role: 'user', content: prompt });
  for (let round = 0; round < 8; round++) {
    const response = await client.responses.create({
      model: process.env.OPENAI_DRAW_MODEL || 'gpt-5.6-terra',
      store: false,
      instructions: 'Use create_svg to draw and update_svg to edit. Read shape IDs with read_svg before editing. Preserve the same shape when changing its color. Keep shapes inside the 640 by 640 canvas. Reply briefly after executing tools.',
      input, tools, parallel_tool_calls: false,
      include: ['reasoning.encrypted_content'],
    });
    // Resend the model output as context in a completely new API request.
    input.push(...toResponseInputItems(response.output));
    const calls = response.output.filter(item => item.type === 'function_call');
    if (!calls.length) {
      console.log(response.output_text || 'The model returned no text.');
      break;
    }
    for (const call of calls) {
      let result;
      try {
        if (!tools.some(tool => tool.name === call.name)) throw new Error('Unknown tool');
        result = store.execute(call.name, JSON.parse(call.arguments));
      } catch (error) {
        result = { error: error.message };
      }
      // File errors stop the example rather than misreporting a successful edit.
      await writeFile('drawing.svg', exportDrawing(store.read()));
      input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
    if (round === 7) throw new Error('Stopped after eight model calls.');
  }
}
