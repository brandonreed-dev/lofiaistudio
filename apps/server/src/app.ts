import express from 'express';
import cors from 'cors';
import { createApiRouter } from './routes/api.js';
import { createAdapterRegistry } from './adapters/index.js';
import { initializeDatabase } from './db/index.js';
// DEFAULT_RUNTIME_ENDPOINTS intentionally not imported at top-level to avoid heavy module resolution during tests. Use env fallbacks below.

export function createApp() {
  // Initialize database
  initializeDatabase();

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Create adapter registry
  const adapterRegistry = createAdapterRegistry({
    // Leave undefined to use adapter defaults; only override when explicitly provided.
    ...(process.env.OLLAMA_ENDPOINT ? { ollamaEndpoint: process.env.OLLAMA_ENDPOINT } : {}),
    ...(process.env.COMFYUI_ENDPOINT ? { comfyuiEndpoint: process.env.COMFYUI_ENDPOINT } : {}),
    ...(process.env.QWEN3_AUDIO_ENDPOINT ? { qwen3AudioEndpoint: process.env.QWEN3_AUDIO_ENDPOINT } : {}),
  });

  // API routes
  app.use('/api', createApiRouter(adapterRegistry));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return { app, adapterRegistry };
}