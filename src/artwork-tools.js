const parameters = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const artworkTools = [
  { type: 'function', name: 'draw_js', description: 'Draw an ANIMATED scene with JavaScript and Canvas 2D. Always include visible, continuous motion using time (elapsed seconds). Available: ctx, width=640, height=640, time. The app runs this function body for each frame on a cleared canvas. Draw the complete frame; do not create timers or your own animation loop. Keep frames fast. Replaces the entire drawing. No DOM, network or imports. To revise, submit the complete updated code.', strict: true, parameters: parameters({ code: { type: 'string', description: 'JavaScript frame function body. Always animate using time. Example: ctx.fillStyle="red"; ctx.beginPath(); ctx.arc(320+100*Math.sin(time),320,80,0,Math.PI*2); ctx.fill();' } }) },
  { type: 'function', name: 'draw_svg', description: 'Draw a complete SVG in one call. Replaces the entire drawing. Supports the full SVG vocabulary with no basic-shape or shape-count restriction. Supply a self-contained SVG document with xmlns and viewBox="0 0 640 640". Scripts and external resources are disabled. Use meaningful IDs. Use update_svg for exact source edits, or draw_svg for a complete replacement.', strict: true, parameters: parameters({ svg: { type: 'string', description: 'Complete SVG markup, including the root <svg> element.' } }) },
  { type: 'function', name: 'update_svg', description: 'Edit the current SVG source with an exact find/replace. find must occur exactly once. Preserve all other content. Use the source from your previous draw_svg call; if it is unavailable, submit a complete replacement with draw_svg. Only works on SVG artwork, not JavaScript drawings.', strict: true, parameters: parameters({ find: { type: 'string', description: 'Exact unique substring of the current SVG.' }, replace: { type: 'string', description: 'Replacement SVG fragment.' } }) },
];

export function validateArtworkArgs(name, args) {
  if (name === 'update_svg') {
    if (!args || typeof args.find !== 'string' || !args.find || typeof args.replace !== 'string' || Object.keys(args).length !== 2 || args.find.length > 100_000 || args.replace.length > 100_000) throw new Error('Provide find and replace strings; find must not be empty.');
    return args;
  }
  const key = name === 'draw_js' ? 'code' : name === 'draw_svg' ? 'svg' : null;
  if (!key) throw new Error('Unknown drawing tool.');
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 1 || typeof args[key] !== 'string' || !args[key].trim()) throw new Error(`Provide a non-empty ${key} string.`);
  if (args[key].length > 100_000) throw new Error('Keep drawing source under 100,000 characters.');
  return args[key];
}

export function updateSvgSource(source, args) {
  validateArtworkArgs('update_svg', args);
  if (!source) throw new Error('There is no SVG drawing to update. Use draw_svg first.');
  const index = source.indexOf(args.find);
  if (index < 0 || source.indexOf(args.find, index + 1) !== -1) throw new Error('find must match exactly once in the current SVG.');
  const svg = source.slice(0, index) + args.replace + source.slice(index + args.find.length);
  return validateArtworkArgs('draw_svg', { svg });
}
