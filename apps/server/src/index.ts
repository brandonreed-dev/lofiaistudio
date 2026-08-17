import { createServer } from 'http';
import { createApp } from './app.js';
import { createWebSocketServer } from './websocket/index.js';
import { startTaskScheduler } from './scheduler/index.js';

const PORT = process.env.PORT || 3001;

// Create Express app with middleware, routes, and adapter registry
const { app, adapterRegistry } = createApp();

// Create HTTP server
const server = createServer(app);

// Create WebSocket server for streaming
createWebSocketServer(server, adapterRegistry, PORT);

// Start task scheduler
const stopScheduler = startTaskScheduler(PORT);

// Start server
server.listen(PORT, () => {
  console.log(`LoFi AI Studio server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);

  // Attempt to connect to runtimes on startup
  adapterRegistry.connectAll().then(statuses => {
    console.log('Runtime statuses:');
    statuses.forEach(status => {
      console.log(`  - ${status.type}: ${status.connected ? 'connected' : 'disconnected'} (${status.models.length} models)`);
    });
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  stopScheduler();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server, adapterRegistry };