# Line Wars Server-Authoritative Deployment Guide

## Overview
The Line Wars game has been converted from asymmetric (host advantage) to symmetric server-authoritative architecture, eliminating player lag and ensuring fair gameplay.

## Architecture Changes

### Before (Asymmetric - Lag Issues)
- Player 1: Local engine, immediate response
- Player 2: Firebase relay, 100-200ms latency disadvantage
- Unfair gameplay experience

### After (Server-Authoritative - Fair Play)
- Both players: WebSocket connection to authoritative server
- Identical latency for both players (~50ms)
- Fair competitive gameplay

## Files Created/Modified

### Server Side
- `server/line-wars/server-engine.ts` - Authoritative game engine
- `server/line-wars/websocket-server.ts` - WebSocket server
- `server/line-wars/start-server.ts` - Standalone server script
- `server/_core/index.ts` - Integrated server startup

### Client Side
- `client/src/lib/games/linewars/client-sync.ts` - WebSocket client
- `client/src/pages/LineWarsBattleServer.tsx` - Server-authoritative UI
- `client/src/App.tsx` - Updated routing
- `client/src/pages/BattleArena.tsx` - Updated battle routing

## Quick Start

### Development
```bash
# Install dependencies (includes ws and @types/ws)
npm install

# Start development server (includes Line Wars WebSocket server)
npm run dev
```

The server will start:
- HTTP Server: http://localhost:3000
- Line Wars WebSocket: ws://localhost:8080

### Test the Game
1. Open browser to: http://localhost:3000/linewars-battle-server?battleId=test123
2. Open second browser/incognito window to same URL
3. Both players should connect with identical latency

## Production Deployment

### Option 1: Render.com (Recommended)
Your existing `render.yaml` supports WebSocket connections. The Line Wars server is already integrated.

```yaml
# Add to your existing render.yaml
services:
  - type: web
    name: iq-arena
    env: node
    plan: free
    buildCommand: npm run build
    startCommand: npm start
    envVars:
      - key: LINE_WARS_PORT
        value: 8080
```

### Option 2: Standalone Deployment
```bash
# Deploy Line Wars server separately
tsx server/line-wars/start-server.ts
```

### Option 3: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY server ./server
EXPOSE 8080
CMD ["tsx", "server/line-wars/start-server.ts"]
```

## Environment Variables

- `NODE_ENV` - development/production
- `LINE_WARS_PORT` - WebSocket server port (default: 8080)
- `PORT` - Main HTTP server port (default: 3000)

## Client Configuration

The client automatically connects to:
- Development: `ws://localhost:8080`
- Production: `wss://your-domain.com`

## Testing

### Local Testing
```bash
# Terminal 1 - Start server
npm run dev

# Terminal 2 - Test WebSocket connection
wscat -c ws://localhost:8080
```

### Load Testing
```bash
# Install load testing tool
npm install -g artillery

# Run load test
artillery run load-test.yml
```

## Monitoring

### Server Logs
```bash
# View real-time logs
npm run dev

# Production logs
pm2 logs line-wars-server
```

### Performance Metrics
- WebSocket connection count
- Game state broadcast rate (20 FPS)
- Input processing latency
- Memory usage per game session

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check firewall settings for port 8080
   - Verify CORS configuration
   - Ensure ws dependency is installed

2. **High Latency**
   - Check server location relative to players
   - Monitor network congestion
   - Consider CDN for static assets

3. **Game State Sync Issues**
   - Verify server tick rate (60 FPS)
   - Check state broadcast rate (20 FPS)
   - Monitor WebSocket message queue

### Debug Mode
```bash
# Enable debug logging
DEBUG=line-wars* npm run dev
```

## Migration from Old Architecture

### Backup Old Files
```bash
# Keep old implementation for reference
mv client/src/pages/LineWarsBattle.tsx client/src/pages/LineWarsBattle.old.tsx
```

### Update Battle Routing
The battle arena now routes to `/linewars-battle-server` instead of `/linewars-battle`.

### Remove Firebase Dependencies
Old Firebase Realtime Database listeners for Line Wars can be removed:
- `lineWarsGameState/${battleId}`
- `lineWarsInputs/${battleId}`
- `lineWarsActions/${battleId}`

## Performance Benefits

- **Fairness**: Both players have identical latency
- **Scalability**: Server handles multiple games simultaneously
- **Reliability**: Centralized state management
- **Security**: Authoritative server prevents cheating
- **Monitoring**: Server-side metrics and logging

## Future Enhancements

- **Spectator Mode**: Multiple clients can watch games
- **Game Recording**: Server can record and replay matches
- **Matchmaking**: Server can handle player pairing
- **Regional Servers**: Deploy multiple server instances globally
