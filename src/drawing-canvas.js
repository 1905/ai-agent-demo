import { exportDrawing } from './drawing-tools.js';

// Render the committed SVG state, without transient CSS animation frames.
export async function captureCanvas(snapshot) {
  const url = URL.createObjectURL(new Blob([exportDrawing(snapshot)], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = snapshot.width;
    canvas.height = snapshot.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas preview is unavailable.');
    context.fillStyle = '#f4f3ef';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function toolOutput(result) {
  if (!result?.imageUrl) return JSON.stringify(result);
  const { imageUrl, ...snapshot } = result;
  return [
    { type: 'input_text', text: JSON.stringify(snapshot) },
    { type: 'input_image', image_url: imageUrl, detail: 'high' },
  ];
}
