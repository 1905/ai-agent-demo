import { createDrawingStore, drawingTools } from './drawing-tools.js';

export const lessonExample = {
  textRequest: 'Suggest a color for a circle.',
  textResponse: 'Red.',
  drawRequest: 'Draw a red circle.',
  drawResponse: 'Drew a red circle.',
  editRequest: 'Make it blue.',
  editResponse: 'Made it blue.',
};

// The lesson uses the same shape validation as Chat and Voice.
export function createLessonFlow() {
  const store = createDrawingStore();
  const call = {
    type: 'function_call', call_id: 'call_create_1', name: 'create_svg',
    arguments: JSON.stringify({ shape: 'circle', fill: 'red', x: 320, y: 320, width: 220, height: 220 }),
  };
  const result = store.execute(call.name, JSON.parse(call.arguments));
  const request = {
    model: 'gpt-6-astra', store: false,
    instructions: 'Use the drawing tools to change the canvas.',
    tools: drawingTools, input: [{ role: 'user', content: lessonExample.drawRequest }],
  };
  const followup = {
    ...request,
    input: [...request.input, call, { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) }],
  };
  return { request, call, result, followup };
}
