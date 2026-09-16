import { COLORS } from './drawing-tools.js';

// A deliberately limited local demonstration. It never claims to be an LLM.
export function planDemo(prompt, snapshot) {
  const text = prompt.toLowerCase().trim();
  const color = Object.keys(COLORS).find(name => new RegExp(`\\b${name}\\b`).test(text)) || text.match(/#[0-9a-f]{6}\b/)?.[0];
  const kind = /\bcircle\b/.test(text) ? 'circle' : /\b(square|rectangle)\b/.test(text) ? 'rectangle' : /\b(ellipse|oval)\b/.test(text) ? 'ellipse' : null;
  const read = { name: 'read_canvas', arguments: {} };
  if (/\b(read|show|what|describe|list|inspect)\b/.test(text) && !/\b(draw|create|add|make|move|change)\b/.test(text)) return { calls: [read], reply: snapshot.shapes.length ? `The drawing contains ${snapshot.shapes.length} ${snapshot.shapes.length === 1 ? 'shape' : 'shapes'}.` : 'The canvas is empty.' };
  if (/\b(draw|create|add)\b/.test(text) && kind) {
    return { calls: [read, { name: 'create_svg', arguments: { shape: kind, fill: color || 'red', x: 320, y: 320, width: 220, height: kind === 'ellipse' ? 140 : 220 } }, read], reply: `Created a ${color || 'red'} ${kind}.` };
  }
  const last = snapshot.shapes.at(-1);
  if (!last) return { calls: [], reply: 'Start with “Draw a red circle”.' };
  const target = snapshot.shapes.find(shape => text.includes(shape.id)) || (kind ? snapshot.shapes.findLast(shape => shape.shape === kind) : last);
  if (!target) return { calls: [read], reply: 'That shape is not on the canvas yet.' };
  const patch = { id: target.id, fill: color || null, x: null, y: null, width: null, height: null };
  if (/\b(smaller|bigger|larger)\b/.test(text)) {
    const factor = /\bsmaller\b/.test(text) ? 0.75 : 1.25;
    patch.width = Math.round(target.width * factor); patch.height = Math.round(target.height * factor);
  }
  if (/\bleft\b/.test(text)) patch.x = target.x - 70;
  if (/\bright\b/.test(text)) patch.x = target.x + 70;
  if (/\bup\b/.test(text)) patch.y = target.y - 70;
  if (/\bdown\b/.test(text)) patch.y = target.y + 70;
  if (/\bcent(er|re)\b/.test(text)) { patch.x = 320; patch.y = 320; }
  if (Object.entries(patch).some(([key, value]) => key !== 'id' && value !== null)) return { calls: [read, { name: 'update_svg', arguments: patch }, read], reply: color ? `Changed ${target.id} to ${color}. Same shape.` : `Updated ${target.id}.` };
  return { calls: [], reply: 'Demo mode supports circles, rectangles, and ellipses. Try a color, size, or position change.' };
}
