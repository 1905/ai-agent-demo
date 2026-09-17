// Учебный пример. Установка: npm install openai
// Задайте OPENAI_API_KEY, затем: node lesson.mjs
// Вызовы модели платные. Погода — фиксированные учебные данные.
import OpenAI from 'openai';
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import { writeFile } from 'node:fs/promises';

const client = new OpenAI();
const model = process.env.OPENAI_DRAW_MODEL || 'gpt-5.6-terra';
const drawTool = {
  type: 'function', name: 'draw_circle', description: 'Нарисовать красный круг.', strict: true,
  parameters: { type: 'object', properties: { color: { type: 'string', enum: ['red'] } }, required: ['color'], additionalProperties: false },
};
const weatherTool = {
  type: 'function', name: 'get_weather', description: 'Получить погоду в городе.', strict: true,
  parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'], additionalProperties: false },
};

// 1. Команда: выполняем действие. Функция не возвращает данные.
async function drawCircle({ color }) {
  if (color !== 'red') throw new Error('Ожидался красный цвет.');
  await writeFile('drawing.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><circle cx="320" cy="320" r="110" fill="red"/></svg>');
}
const command = await client.responses.create({
  model, store: false, tools: [drawTool], parallel_tool_calls: false,
  tool_choice: { type: 'function', name: 'draw_circle' },
  input: [{ role: 'user', content: 'Нарисуй красный круг.' }],
});
if (command.status !== 'completed') throw new Error('Модель не завершила ответ.');
const drawCall = command.output.find(item => item.type === 'function_call' && item.name === 'draw_circle');
if (!drawCall) throw new Error('Модель не вернула команду.');
await drawCircle(JSON.parse(drawCall.arguments));
console.log('Готово: drawing.svg');
// Задача завершена. Второго запроса для рисования не требуется.
// Если продолжаем этот диалог, сохраняем все output-элементы и добавляем
// function_call_output с call_id: drawCall.call_id и output: 'Выполнено'.

// 2. Запрос данных: результат нужен модели для ответа.
function getWeather({ city }) {
  if (city !== 'Москва') throw new Error('Учебный прогноз доступен только для Москвы.');
  return { location: 'Moscow, RU', units: 'metric', temperature_c: 12, feels_like_c: 10, condition: 'moderate rain', humidity_pct: 87, wind_kph: 18, precipitation_mm: 2.4, cloud_cover_pct: 100, is_day: true };
}
const request = {
  model, store: false, tools: [weatherTool], parallel_tool_calls: false,
  instructions: 'Для вопроса о погоде вызови get_weather. Затем ответь кратко на русском по его данным.',
  include: ['reasoning.encrypted_content'],
  input: [{ role: 'user', content: 'Нужен ли зонт в Москве?' }],
};
const first = await client.responses.create({ ...request, tool_choice: { type: 'function', name: 'get_weather' } });
if (first.status !== 'completed') throw new Error('Модель не завершила ответ.');
const weatherCall = first.output.find(item => item.type === 'function_call' && item.name === 'get_weather');
if (!weatherCall) throw new Error('Модель не запросила погоду.');
const data = getWeather(JSON.parse(weatherCall.arguments));

// Совершенно новый API-запрос. Передаём весь контекст явно.
const answer = await client.responses.create({
  ...request, tool_choice: 'none',
  input: [...request.input, ...toResponseInputItems(first.output), {
    type: 'function_call_output', call_id: weatherCall.call_id, output: JSON.stringify(data),
  }],
});
if (answer.status !== 'completed') throw new Error('Модель не завершила ответ.');
console.log(answer.output_text);
