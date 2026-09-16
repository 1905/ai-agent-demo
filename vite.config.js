import { defineConfig, loadEnv } from 'vite';
import { drawingApi } from './server/drawing-api.js';
import { drawingEnv } from './server/drawing-env.js';
import { attachVoiceApi } from './server/voice-api.js';

export default defineConfig(({ mode }) => {
  const env = drawingEnv({ ...loadEnv(mode, process.cwd(), ''), ...process.env });
  return {
    plugins: [{ name: 'drawing-api', configureServer(server) { server.middlewares.use(drawingApi(env)); attachVoiceApi(server.httpServer, env); }, configurePreviewServer(server) { server.middlewares.use(drawingApi(env)); attachVoiceApi(server.httpServer, env); } }],
  };
});
