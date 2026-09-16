export const chapters = [
  { title: 'From words to actions', label: 'The big picture', icon: 'spark' },
  { title: 'A very brief origin story', label: 'How we got here', icon: 'clock' },
  { title: 'Meet the LLM API', label: 'Request → response', icon: 'braces' },
  { title: 'Give the model a toolbox', label: 'Defining a tool', icon: 'tool' },
  { title: 'Watch a tool call happen', label: 'The round trip', icon: 'route' },
  { title: 'Close the agent loop', label: 'Observe. Decide. Act.', icon: 'loop' },
  { title: 'Build your first agent', label: 'Make it real', icon: 'code' }
];
export const steps = [
 {chapter:0,kicker:'A SMALL IDEA. A BIG DIFFERENCE.',title:'From words<br>to <em>actions.</em>',description:'An LLM can write a great plan. An agent can help make it happen. Let’s look under the hood, one message at a time.',note:'No AI experience needed. Just a little curiosity.',stage:'overview',caption:'The model brings the language. Tools bring the ability to act.',next:'Let’s explore'},
 {chapter:1,kicker:'01 / THE ORIGIN STORY',title:'It didn’t happen<br><em>overnight.</em>',description:'Agents grew from several ideas: models that understand context, APIs that make them accessible, and loops that connect language to actions.',note:'A few milestones, not a single “agent invention.”',stage:'history',caption:'Click a milestone to see what it contributed.'},
 {chapter:2,kicker:'02 / MEET THE API',title:'A conversation.<br><em>Made of JSON.</em>',description:'Your app sends an HTTP request with a model and an input. The API returns structured output. A chat interface is just one way to display it.',note:'API = application programming interface. A shared way for programs to talk.',stage:'request',caption:'Your app sends the input to POST /v1/responses.'},
 {chapter:2,kicker:'02 / THE RESPONSE',title:'Good with words.<br><em>Missing the world.</em>',description:'A model generates text from its context. Without a connected tool, it can’t check tonight’s weather or your local movie catalog.',note:'An API call alone does not give a model live data or permission to act.',stage:'response',caption:'A useful answer needs information outside the model.'},
 {chapter:3,kicker:'03 / THE TOOLBOX',title:'Give it a menu<br>of <em>possibilities.</em>',description:'A tool definition describes a function: its name, what it does, and the arguments it accepts. Your application supplies the actual implementation.',note:'Try each tool below. The model sees its description and JSON schema.',stage:'tools',caption:'A schema describes the tool. It does not execute anything.'},
 {chapter:4,kicker:'04 / THE MISSION',title:'Let’s rescue<br><em>movie night.</em>',description:'“Plan a sci-fi movie night in Portland. Check if we can watch outside, find a film under two hours, and budget snacks for four.”',note:'This is a simulation with fixture data. No API key or live requests needed.',stage:'mission',caption:'Change the weather, then follow the same request through the system.'},
 {chapter:4,kicker:'04 / THE MODEL DECIDES',title:'A request to act.<br><em>Not an action yet.</em>',description:'The model returns a function_call named get_weather with JSON-encoded arguments. Your code checks the name, parses the arguments, and runs the matching function.',note:'The model chooses the call. Your application controls execution.',stage:'call',caption:'The response contains a function call instead of a final answer.'},
 {chapter:4,kicker:'04 / YOUR CODE RUNS',title:'The tool goes<br>to <em>work.</em>',description:'Your application retrieves the weather. It wraps the result in a function_call_output and uses call_id to match it to the model’s request.',note:'In a real app, validate arguments and handle timeouts and tool errors here.',stage:'result',caption:'The application sends the tool result back to the model.'},
 {chapter:5,kicker:'05 / THE AGENT LOOP',title:'One result.<br><em>Another decision.</em>',description:'The model uses the weather result, then asks for a film and a snack calculation. Your application repeats the loop until there’s a final answer or a stopping limit.',note:'An agent is a model plus tools, context, and an application-controlled loop.',stage:'loop',caption:'Run the loop to watch three tools turn a request into a grounded plan.'},
 {chapter:6,kicker:'06 / MAKE IT REAL',title:'Less magic.<br><em>More JavaScript.</em>',description:'Here’s the complete server-side example. It calls the real Responses API, dispatches local demo tools, preserves context, and caps the loop at six rounds.',note:'The browser lesson is simulated. This downloadable example uses a real API key and incurs API usage.',stage:'code',caption:'Run on Node.js 20.19+ with OPENAI_API_KEY set in your environment.'},
 {chapter:6,kicker:'ONE LAST THING',title:'You’ve got<br>the <em>building blocks.</em>',description:'An input. A model. A tool call. Your code. A result. Repeat. Before you go, check the one idea that makes the whole system click.',note:'You can revisit any chapter from the sidebar.',stage:'quiz',caption:'A tiny knowledge check to finish your first lesson.',next:'Restart lesson'}
];
export const toolDefs = [
 { type:'function', name:'get_weather', description:'Get the weather forecast for movie night in a city.', strict:true, parameters:{type:'object',properties:{city:{type:'string'}},required:['city'],additionalProperties:false}},
 { type:'function', name:'find_movie', description:'Find a movie in the demo catalog by genre and maximum runtime.', strict:true,parameters:{type:'object',properties:{genre:{type:'string'},max_minutes:{type:'integer'}},required:['genre','max_minutes'],additionalProperties:false}},
 { type:'function', name:'calculate_snacks', description:'Calculate the total snack budget for a group.',strict:true,parameters:{type:'object',properties:{people:{type:'integer'},per_person:{type:'number'}},required:['people','per_person'],additionalProperties:false}}
];
export function weatherFixture(weather) { return {city:'Portland',condition:weather==='rain'?'rain':'clear',temperature_c:weather==='rain'?14:22,source:'demo fixture'}; }
export function moviePlan(weather) { return `${weather==='rain'?'Rain in Portland—bring movie night indoors.':'Clear skies in Portland—set up the backyard projector.'} Watch Moon (97 min). Snacks for 4 at $6 each: $24. You’re all set for a little space travel.`; }
export const prompt = 'Plan a sci-fi movie night in Portland. Check if we can watch outside, find a film under 120 minutes, and budget snacks for 4 at $6 each.';
export function inspectPayload(stage,weather,toolIndex=0){
 const call={type:'function_call',call_id:'call_weather_01',name:'get_weather',arguments:JSON.stringify({city:'Portland'})};
 if(stage==='tools') return toolDefs[toolIndex];
 if(stage==='call') return {id:'resp_demo_01',output:[call]};
 if(stage==='result') return {model:'gpt-6-astra',previous_response_id:'resp_demo_01',tools:toolDefs,input:[{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(weatherFixture(weather))}]};
 if(stage==='response') return {id:'resp_demo_00',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'I can suggest a movie night, but I need a weather tool to check the forecast.'}]}]};
 return {model:'gpt-6-astra',input:[{role:'user',content:prompt}],...(stage==='request'?{}:{tools:toolDefs})};
}
