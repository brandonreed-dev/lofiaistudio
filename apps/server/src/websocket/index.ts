import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import type { AdapterRegistry } from '../adapters/index.js';
import { OllamaAdapter } from '../adapters/ollama.js';
import { handleChatMessage } from './chatHandler.js';
import { handleGroupChatMessage } from './groupChatHandler.js';
import type { GroupChatServerRequest } from '@lofiaistudio/shared';

export function createWebSocketServer(server: ReturnType<typeof createServer>, adapterRegistry: AdapterRegistry, port: string | number) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'chat') {
          const adapter = adapterRegistry.get('ollama');
          if (!adapter || !adapter.isConnected()) {
            ws.send(JSON.stringify({
              type: 'error',
              requestId: message.payload.requestId,
              error: 'Ollama adapter not connected',
            }));
            return;
          }

          await handleChatMessage(ws, message.payload, adapter as OllamaAdapter, port);
        } else if (message.type === 'group_chat') {
          const payload = message.payload as GroupChatServerRequest['payload'];

          const adapter = adapterRegistry.get('ollama');
          if (!adapter || !adapter.isConnected()) {
            ws.send(JSON.stringify({
              type: 'error',
              requestId: payload.roomId,
              error: 'Ollama adapter not connected',
            }));
            return;
          }

          await handleGroupChatMessage(ws, payload, adapter as OllamaAdapter);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  return wss;
}