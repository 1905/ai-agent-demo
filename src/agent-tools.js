import { drawingTools } from './drawing-tools.js';
import { themeTools } from './theme-tools.js';
import { artworkTools } from './artwork-tools.js';

export const agentTools = [...drawingTools, ...artworkTools, ...themeTools];

export const endConversationTool = { type: 'function', name: 'end_conversation', description: 'End the voice session when the user says goodbye or asks to stop talking.', strict: true, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } };
export const allAgentTools = [...agentTools, endConversationTool];

export function selectAgentTools(enabledTools, voice = false) {
  const available = voice ? allAgentTools : agentTools;
  if (enabledTools === undefined) return [...available];
  if (!Array.isArray(enabledTools) || enabledTools.length > allAgentTools.length || new Set(enabledTools).size !== enabledTools.length || enabledTools.some(name => typeof name !== 'string' || !allAgentTools.some(tool => tool.name === name))) throw new Error('Choose tools from Tool settings.');
  return available.filter(tool => enabledTools.includes(tool.name));
}
