export const DEFAULT_THINKING_MODEL = 'gpt-5.6-terra';
export const DEFAULT_REASONING_EFFORT = 'medium';
export const reasoningEfforts = ['low', 'medium', 'high', 'xhigh', 'max'];
export const validReasoningEffort = effort => reasoningEfforts.includes(effort);
export const thinkingModels = [
  { id: DEFAULT_THINKING_MODEL, label: 'Terra' },
  { id: 'gpt-5.6-luna', label: 'Luna' },
  { id: 'gpt-5.6-sol', label: 'Sol' },
  { id: 'gpt-6-astra', label: 'Astra' },
];

export function validThinkingModel(model) {
  return thinkingModels.some(option => option.id === model);
}
