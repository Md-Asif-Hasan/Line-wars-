// ─── Line Wars Server Startup Script ─────────────────────────────────────────────

import { LineWarsWebSocketServer } from './websocket-server';

// Start the Line Wars WebSocket server
const PORT = process.env.LINE_WARS_PORT ? parseInt(process.env.LINE_WARS_PORT) : 8080;

console.log('Starting Line Wars Server...');
console.log(`Port: ${PORT}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

const server = new LineWarsWebSocketServer(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Line Wars Server...');
  server.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Line Wars Server...');
  server.shutdown();
  process.exit(0);
});

console.log('Line Wars Server started successfully!');
