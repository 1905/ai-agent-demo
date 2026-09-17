import { createDrawingStore } from './drawing-tools.js';
import { DEFAULT_THINKING_MODEL } from './thinking-models.js';

export const lessonExample = {
  textRequest: 'Какой цвет выбрать для круга?',
  textResponse: 'Красный.',
  drawRequest: 'Нарисуй красный круг.',
  weatherRequest: 'Нужен ли зонт в Москве?',
  weatherResponse: 'Да, возьмите зонт. В Москве дождь, +12 °C.',
};

// Fixed English service output, intentionally more detailed than the answer.
export const weatherToolResult = {
  location: 'Moscow, RU', units: 'metric',
  temperature_c: 12, feels_like_c: 10,
  condition: 'moderate rain', humidity_pct: 87,
  wind_kph: 18, precipitation_mm: 2.4,
  cloud_cover_pct: 100, is_day: true,
};

export const lessonTools = [
  { type: 'function', name: 'draw_circle', description: 'Нарисовать круг. Функция не возвращает данные.', strict: true, parameters: { type: 'object', properties: { color: { type: 'string', enum: ['red'] } }, required: ['color'], additionalProperties: false } },
  { type: 'function', name: 'get_weather', description: 'Получить погоду в городе.', strict: true, parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'], additionalProperties: false } },
];

export function createLessonFlow() {
  const store = createDrawingStore();
  function drawCircle({ color }) {
    store.execute('create_svg', { shape: 'circle', fill: color, x: 320, y: 320, width: 220, height: 220 });
    // No return value. The visible drawing is the outcome of this command.
  }
  const commandCall = { type: 'function_call', call_id: 'draw_1', name: 'draw_circle', arguments: '{"color":"red"}' };
  const commandResult = drawCircle(JSON.parse(commandCall.arguments));
  const command = { call: commandCall, result: commandResult, shape: store.read().shapes[0] };
  const call = { type: 'function_call', call_id: 'weather_1', name: 'get_weather', arguments: '{"city":"Москва"}' };
  // Deliberately fixed lesson data, not a live weather report.
  const result = structuredClone(weatherToolResult);
  const request = {
    model: DEFAULT_THINKING_MODEL, store: false,
    instructions: 'Ответь на вопрос о погоде с помощью инструмента.',
    tools: [lessonTools[1]], input: [{ role: 'user', content: lessonExample.weatherRequest }],
  };
  const followup = { ...request, input: [...request.input, call, { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) }] };
  return { command, request, call, result, followup };
}
