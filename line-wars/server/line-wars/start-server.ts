// ─── Line Wars Server Startup Script ─────────────────────────────────────────────

import { createServer } from 'http';
import { LineWarsWebSocketServer } from './websocket-server';

// Render requires the service to bind to PORT (default 10000) for health checks.
// We create an HTTP server on that port and attach the WebSocket server to it,
// so both the health check and WS connections share the same port.
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 10000;

console.log('Starting Line Wars Server...');
console.log(`Port: ${PORT}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Create a minimal HTTP server for Render's health check
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Line Wars WebSocket Server');
  }
});

// Attach WebSocket server to the HTTP server (no separate port binding)
const server = new LineWarsWebSocketServer(httpServer);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Line Wars Server listening on port ${PORT}`);
  console.log('Line Wars Server started successfully!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Line Wars Server...');
  server.shutdown();
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Line Wars Server...');
  server.shutdown();
  httpServer.close(() => process.exit(0));
});
