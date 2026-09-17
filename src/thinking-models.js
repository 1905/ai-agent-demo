export const DEFAULT_THINKING_MODEL = 'gpt-5.6-terra';
export const thinkingModels = [
  { id: DEFAULT_THINKING_MODEL, label: 'Terra' },
  { id: 'gpt-6-astra', label: 'Astra' },
];

export function validThinkingModel(model) {
  return thinkingModels.some(option => option.id === model);
}
