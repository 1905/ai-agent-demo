export const CANVAS_SIZE = 640;
export const MAX_MODEL_CALLS = 32;
export const COLORS = { red: '#ef5350', blue: '#5689f5', green: '#63c994', yellow: '#f6cb61', orange: '#f69b58', purple: '#ab85ef', pink: '#ec8dbe', white: '#f4f4f5', black: '#20242c' };
const schema = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const number = { type: 'number' };
const nullableNumber = { type: ['number', 'null'] };
export const drawingTools = [
  { type: 'function', name: 'read_canvas', description: 'Inspect the entire canvas as an image, with every shape ID and attribute. Check composition, spacing, overlap and colors. Use before drawing and after changes to verify the result.', strict: true, parameters: schema({}) },
  { type: 'function', name: 'read_svg', description: 'Read the current drawing source (artwork.svg or artwork.code), plus basic shape IDs and attributes. Read before editing. Complete scenes are revised with draw_svg or draw_js; basic shapes with update_svg.', strict: true, parameters: schema({}) },
  { type: 'function', name: 'create_svg', description: 'Add one circle, rectangle, or ellipse. Coordinates are on a 640 by 640 canvas. x/y are the center; width/height are the full size. A circle must have equal width and height. Returns a stable ID.', strict: true, parameters: schema({ shape: { type: 'string', enum: ['circle', 'rectangle', 'ellipse'] }, fill: { type: 'string', description: 'A color name or six-digit hex color.' }, x: number, y: number, width: number, height: number }) },
  { type: 'function', name: 'update_svg', description: 'Update an existing shape by its ID. Null fields remain unchanged. Preserve the shape ID. For a circle, provide equal width and height when resizing.', strict: true, parameters: schema({ id: { type: 'string' }, fill: { type: ['string', 'null'] }, x: nullableNumber, y: nullableNumber, width: nullableNumber, height: nullableNumber }) },
];

export function colorValue(value) {
  if (typeof value !== 'string') throw new Error('Use a color name or a six-digit hex color.');
  const color = value.toLowerCase().trim();
  if (Object.hasOwn(COLORS, color)) return COLORS[color];
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  throw new Error('Use red, blue, green, yellow, orange, purple, pink, white, black, or a six-digit hex color.');
}

function validate(shape) {
  if (!['circle', 'rectangle', 'ellipse'].includes(shape.shape)) throw new Error('Unsupported shape.');
  for (const key of ['x', 'y', 'width', 'height']) if (!Number.isFinite(shape[key])) throw new Error(`${key} must be a finite number.`);
  if (shape.width < 8 || shape.height < 8 || shape.width > CANVAS_SIZE || shape.height > CANVAS_SIZE) throw new Error('Shape size must be between 8 and 640.');
  if (shape.shape === 'circle' && shape.width !== shape.height) throw new Error('A circle needs equal width and height.');
  if (shape.x - shape.width / 2 < 0 || shape.x + shape.width / 2 > CANVAS_SIZE || shape.y - shape.height / 2 < 0 || shape.y + shape.height / 2 > CANVAS_SIZE) throw new Error('Keep the whole shape inside the canvas.');
  shape.fill = colorValue(shape.fill);
  return shape;
}

export function createDrawingStore() {
  let shapes = [], sequence = 0, version = 0, artwork = null;
  const read = () => ({ width: CANVAS_SIZE, height: CANVAS_SIZE, version, shapes: structuredClone(shapes), ...(artwork ? { artwork: structuredClone(artwork) } : {}) });
  return {
    read,
    reset() { shapes = []; sequence = 0; version = 0; artwork = null; },
    // Only the browser renderer supplies artwork; model arguments never call this directly.
    replaceArtwork(value) {
      artwork = structuredClone(value); shapes = []; version++;
      return { action: 'drawn', format: artwork.type, version, width: CANVAS_SIZE, height: CANVAS_SIZE };
    },
    execute(name, args) {
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be an object.');
      const definition = drawingTools.find(tool => tool.name === name);
      if (!definition) throw new Error('Unknown drawing tool.');
      if (Object.keys(args).some(key => !Object.hasOwn(definition.parameters.properties, key))) throw new Error('Unknown tool argument.');
      if (name === 'read_svg' || name === 'read_canvas') return read();
      if (name === 'create_svg') {
        if (shapes.length >= 40) throw new Error('This canvas supports up to 40 shapes.');
        const shape = validate({ ...args, id: `shape-${sequence + 1}` });
        sequence++; version++; shapes.push(shape);
        return { action: 'created', version, shape: structuredClone(shape) };
      }
      const index = shapes.findIndex(shape => shape.id === args.id);
      if (index === -1) throw new Error('Shape not found. Read the drawing before updating it.');
      const patch = Object.fromEntries(Object.entries(args).filter(([key, value]) => key !== 'id' && value !== null));
      const shape = validate({ ...shapes[index], ...patch });
      shapes[index] = shape; version++;
      return { action: 'updated', version, shape: structuredClone(shape) };
    },
  };
}

export function shapeMarkup(shape) {
  // Values reach this renderer only through the allowlisted, numeric tool schema.
  const common = `data-shape-id="${shape.id}" fill="${shape.fill}"`;
  if (shape.shape === 'circle') return `<circle ${common} cx="${shape.x}" cy="${shape.y}" r="${shape.width / 2}" />`;
  if (shape.shape === 'ellipse') return `<ellipse ${common} cx="${shape.x}" cy="${shape.y}" rx="${shape.width / 2}" ry="${shape.height / 2}" />`;
  return `<rect ${common} x="${shape.x - shape.width / 2}" y="${shape.y - shape.height / 2}" width="${shape.width}" height="${shape.height}" rx="8" />`;
}

export function exportDrawing(snapshot) {
  const artwork = snapshot.artwork ? `<image width="640" height="640" href="${snapshot.artwork.imageUrl}" />` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">${artwork}${snapshot.shapes.map(shapeMarkup).join('')}</svg>`;
}
