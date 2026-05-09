// ─── WebSocket Server for Line Wars ─────────────────────────────────────────────

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { LineWarsServerEngine } from './server-engine';

export class LineWarsWebSocketServer {
  private wss: WebSocketServer;
  private engine: LineWarsServerEngine;
  private clientConnections: Map<string, { ws: WebSocket; uid: string; gameId: string }> = new Map();

  constructor(serverOrPort: HttpServer | number = 8080) {
    this.engine = new LineWarsServerEngine();

    if (typeof serverOrPort === 'number') {
      // Standalone mode: bind directly to a port
      this.wss = new WebSocketServer({ port: serverOrPort });
      console.log(`Line Wars WebSocket server running on port ${serverOrPort}`);
    } else {
      // Attached mode: upgrade from an existing HTTP server
      this.wss = new WebSocketServer({ server: serverOrPort });
      console.log('Line Wars WebSocket server attached to HTTP server');
    }

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      console.log(`New client connected: ${clientId}`);

      // Handle client messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message, ws);
        } catch (error: any) {
          console.error(`Invalid message from ${clientId}:`, error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      // Handle client disconnection
      ws.on('close', () => {
        this.handleClientDisconnection(clientId);
      });

      // Handle errors
      ws.on('error', (error: any) => {
        console.error(`WebSocket error for ${clientId}:`, error);
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connected',
        clientId,
        timestamp: Date.now()
      });
    });

    this.wss.on('error', (error: any) => {
      console.error('WebSocket server error:', error);
    });
  }

  private handleClientMessage(clientId: string, message: any, ws: WebSocket): void {
    const { type, gameId, uid, data } = message;

    switch (type) {
      case 'joinGame':
        this.handleJoinGame(clientId, gameId, uid, ws);
        break;

      case 'playerInput':
        this.handlePlayerInput(clientId, gameId, uid, data);
        break;

      case 'gameAction':
        this.handleGameAction(clientId, gameId, uid, data);
        break;

      case 'getGameState':
        this.handleGetGameState(clientId, gameId, ws);
        break;

      case 'leaveGame':
        this.handleLeaveGame(clientId, gameId, uid);
        break;

      default:
        console.warn(`Unknown message type: ${type} from ${clientId}`);
        this.sendError(ws, 'Unknown message type');
    }
  }

  private handleJoinGame(clientId: string, gameId: string, uid: string, ws: WebSocket): void {
    try {
      // Get or create game
      let game = this.engine.getGameState(gameId);
      if (!game) {
        this.engine.createGame(gameId);
        game = this.engine.getGameState(gameId);
      }

      if (!game) {
        this.sendError(ws, 'Failed to create game');
        return;
      }

      // Check if this UID already has a slot (reconnect case)
      let playerSlot: "player1" | "player2" | null = null;
      if (game.players.player1?.uid === uid) {
        playerSlot = "player1";
        // Update the WebSocket connection for this player
        this.engine.updatePlayerConnection(gameId, uid, ws);
      } else if (game.players.player2?.uid === uid) {
        playerSlot = "player2";
        this.engine.updatePlayerConnection(gameId, uid, ws);
      } else {
        // New player — find an empty slot
        if (!game.players.player1) {
          playerSlot = "player1";
        } else if (!game.players.player2) {
          playerSlot = "player2";
        } else {
          this.sendError(ws, 'Game is full');
          return;
        }

        // Add player to game
        const success = this.engine.addPlayerToGame(gameId, playerSlot, uid, ws);
        if (!success) {
          this.sendError(ws, 'Failed to join game');
          return;
        }
      }

      // Store connection
      this.clientConnections.set(clientId, { ws, uid, gameId });

      // Send confirmation
      this.sendToClient(ws, {
        type: 'joinedGame',
        gameId,
        playerSlot,
        uid,
        timestamp: Date.now()
      });

      // Send current game state
      const currentState = this.engine.getGameState(gameId);
      if (currentState) {
        this.sendToClient(ws, {
          type: 'gameState',
          state: currentState,
          timestamp: Date.now()
        });
      }

      console.log(`Client ${clientId} (${uid}) joined game ${gameId} as ${playerSlot}`);

    } catch (error) {
      console.error(`Error joining game:`, error);
      this.sendError(ws, 'Failed to join game');
    }
  }

  private handlePlayerInput(clientId: string, gameId: string, uid: string, data: any): void {
    const { direction } = data;
    
    if (typeof direction !== 'number') {
      const ws = this.getClientWs(clientId);
      if (ws) this.sendError(ws, 'Invalid direction');
      return;
    }

    const success = this.engine.handlePlayerInput(gameId, uid, direction);
    if (!success) {
      console.warn(`Failed to process input from ${clientId} in game ${gameId}`);
    }
  }

  private handleGameAction(clientId: string, gameId: string, uid: string, data: any): void {
    const success = this.engine.handleGameAction(gameId, uid, data);
    if (!success) {
      console.warn(`Failed to process action from ${clientId} in game ${gameId}`);
    }
    // Note: broadcastGameState is called inside engine.handleGameAction for each action type
  }

  private handleGetGameState(clientId: string, gameId: string, ws: WebSocket): void {
    const state = this.engine.getGameState(gameId);
    if (state) {
      this.sendToClient(ws, {
        type: 'gameState',
        state,
        timestamp: Date.now()
      });
    } else {
      this.sendError(ws, 'Game not found');
    }
  }

  private handleLeaveGame(clientId: string, gameId: string, uid: string): void {
    this.engine.removePlayerFromGame(gameId, uid);
    this.clientConnections.delete(clientId);

    const ws = this.getClientWs(clientId);
    if (ws) {
      this.sendToClient(ws, {
        type: 'leftGame',
        gameId,
        timestamp: Date.now()
      });
    }

    console.log(`Client ${clientId} (${uid}) left game ${gameId}`);
  }

  private handleClientDisconnection(clientId: string): void {
    const connection = this.clientConnections.get(clientId);
    if (connection) {
      const { uid, gameId } = connection;
      this.engine.removePlayerFromGame(gameId, uid);
      this.clientConnections.delete(clientId);
      console.log(`Client ${clientId} (${uid}) disconnected from game ${gameId}`);
    }
  }

  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendToClient(ws, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }

  private getClientWs(clientId: string): WebSocket | null {
    const connection = this.clientConnections.get(clientId);
    return connection ? connection.ws : null;
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  public shutdown(): void {
    this.engine.shutdown();
    this.wss.close();
    console.log('Line Wars WebSocket server shutdown');
  }
}


