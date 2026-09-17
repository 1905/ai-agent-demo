const parameters = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const artworkTools = [
  { type: 'function', name: 'draw_js', description: 'Draw an entire scene in one call with JavaScript and the standard Canvas 2D API. Replaces the entire drawing. Available: ctx, width=640, height=640. Use loops, functions, paths, text, gradients and any Canvas 2D drawing methods. Start from a transparent canvas. Code must finish synchronously within 2 seconds. No DOM, network, imports, timers or animation. To edit, read_svg returns the previous source; submit the complete revised scene. Then use read_canvas to inspect it.', strict: true, parameters: parameters({ code: { type: 'string', description: 'JavaScript function body. Example: ctx.fillStyle = "red"; ctx.beginPath(); ctx.arc(320,320,110,0,Math.PI*2); ctx.fill();' } }) },
  { type: 'function', name: 'draw_svg', description: 'Draw a complete SVG in one call. Replaces the entire drawing. Supports paths, polygons, lines, text, groups, gradients, masks, filters, patterns, transforms and SVG colors. No basic-shape or shape-count restriction. Supply a self-contained SVG document with xmlns and viewBox="0 0 640 640". Rendered as an image: scripts and external resources are disabled. To edit, read_svg returns the previous source; submit the complete revised SVG. Then use read_canvas to inspect it.', strict: true, parameters: parameters({ svg: { type: 'string', description: 'Complete SVG markup, including the root <svg> element. Prefer IDs on meaningful parts.' } }) },
];

export function validateArtworkArgs(name, args) {
  const key = name === 'draw_js' ? 'code' : name === 'draw_svg' ? 'svg' : null;
  if (!key) throw new Error('Unknown drawing tool.');
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 1 || typeof args[key] !== 'string' || !args[key].trim()) throw new Error(`Provide a non-empty ${key} string.`);
  if (args[key].length > 100_000) throw new Error('Keep drawing source under 100,000 characters.');
  return args[key];
}
