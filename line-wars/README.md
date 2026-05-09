# Line Wars Server-Authoritative Implementation

## 🎮 Overview
This folder contains the complete server-authoritative Line Wars implementation that eliminates asymmetric lag issues and ensures fair multiplayer gameplay.

## 📁 Folder Structure

```
line-wars/
├── server/
│   ├── line-wars/
│   │   ├── server-engine.ts          # Authoritative game engine
│   │   ├── websocket-server.ts       # WebSocket server
│   │   └── start-server.ts           # Standalone server script
│   └── _core/
│       └── index.ts                  # Main server integration
├── client/
│   ├── src/
│   │   ├── lib/games/linewars/
│   │   │   ├── client-sync.ts        # WebSocket client
│   │   │   └── renderer.ts           # Game renderer
│   │   └── pages/
│   │       ├── LineWarsBattleServer.tsx # Server-authoritative UI
│   │       ├── App.tsx                # Updated routing
│   │       └── BattleArena.tsx        # Battle routing
├── docs/
│   ├── LINE_WARS_DEPLOYMENT.md       # Deployment guide
│   └── test-line-wars-server.js      # Test script
├── render.yaml                        # Render configuration
├── Dockerfile                         # Docker configuration
└── package.json                       # Dependencies
```

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Test the Implementation**
   ```bash
   node docs/test-line-wars-server.js
   ```

4. **Access the Game**
   ```
   http://localhost:3000/linewars-battle-server?battleId=test123
   ```

## 🎯 Key Features

- **Fair Gameplay**: Both players connect to authoritative server
- **No Lag Advantage**: Identical latency for both players
- **Real-time Communication**: WebSocket-based multiplayer
- **Anti-Cheat**: Server controls all game state
- **Scalable**: Server handles multiple games simultaneously

## 🌐 Deployment

### Render.com (Recommended)
1. Upload this folder to your GitHub repository
2. Connect to Render.com
3. The `render.yaml` file handles automatic deployment

### Manual Deployment
```bash
# Build the project
npm run build

# Start production server
npm start
```

## 📚 Documentation

- **Deployment Guide**: `docs/LINE_WARS_DEPLOYMENT.md`
- **API Documentation**: Inline code comments
- **Testing**: `docs/test-line-wars-server.js`

## 🔧 Configuration

- **WebSocket Port**: 8080 (configurable via LINE_WARS_PORT)
- **HTTP Port**: 3000 (configurable via PORT)
- **Environment**: Development/Production auto-detection

## 🎮 Game Controls

- **Arrow Keys/WASD**: Move player
- **Space**: Request draw
- **F**: Forfeit game
- **R**: Reset game (when ended)
- **Mobile**: Swipe to change direction

## 📊 Architecture

```
Client (Browser) ←→ WebSocket Server ←→ Authoritative Game Engine
      ↑                                          ↑
   Both players                              Single source
   Identical latency                       of truth
```

## 🏆 Benefits

- ✅ Perfect fairness - no host advantage
- ✅ Eliminated lag issues
- ✅ Secure multiplayer
- ✅ Easy spectator mode
- ✅ Game recording capability
- ✅ Global scalability

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Test with provided test script
4. Submit pull request

## 📞 Support

For issues and questions, refer to the deployment guide or check the server logs for debugging information.
