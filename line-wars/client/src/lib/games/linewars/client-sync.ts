// ─── Client-Side WebSocket Sync for Line Wars ──────────────────────────────────

export interface LineWarsGameState {
  players: {
    player1: any | null;
    player2: any | null;
  };
  gridSize: number;
  cellSize: number;
  gameStatus: "waiting" | "playing" | "draw" | "player1_win" | "player2_win" | "forfeit";
  winner?: "player1" | "player2" | "draw";
  drawRequestedBy?: "player1" | "player2";
  gameTime: number;
  lastUpdate: number;
}

export interface ClientMessage {
  type: 'joinGame' | 'playerInput' | 'gameAction' | 'getGameState' | 'leaveGame';
  gameId: string;
  uid: string;
  data?: any;
}

export interface ServerMessage {
  type: 'connected' | 'joinedGame' | 'gameState' | 'leftGame' | 'error';
  clientId?: string;
  gameId?: string;
  playerSlot?: 'player1' | 'player2';
  uid?: string;
  state?: LineWarsGameState;
  error?: string;
  timestamp: number;
}

export class LineWarsClientSync {
  private ws: WebSocket | null = null;
  private clientId: string | null = null;
  private gameId: string | null = null;
  private uid: string | null = null;
  private playerSlot: 'player1' | 'player2' | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  private onGameStateCallback?: (state: LineWarsGameState) => void;
  private onConnectedCallback?: (clientId: string) => void;
  private onJoinedGameCallback?: (playerSlot: 'player1' | 'player2') => void;
  private onErrorCallback?: (error: string) => void;
  private onDisconnectedCallback?: () => void;

  constructor(private serverUrl: string = 'ws://localhost:8080') {}

  public connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        if (this.clientId) {
          resolve(this.clientId);
          return;
        }
        reject(new Error('Connection already in progress'));
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('[LineWarsClient] Connected to server');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data);
            this.handleServerMessage(message);
          } catch (error) {
            console.error('[LineWarsClient] Failed to parse server message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[LineWarsClient] Disconnected from server:', event.code, event.reason);
          this.isConnecting = false;
          this.handleDisconnection();
        };

        this.ws.onerror = (error) => {
          console.error('[LineWarsClient] WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        // Set up connection callback
        this.onConnectedCallback = (clientId) => {
          this.clientId = clientId;
          resolve(clientId);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'connected':
        if (message.clientId) {
          this.clientId = message.clientId;
          this.onConnectedCallback?.(message.clientId);
        }
        break;

      case 'joinedGame':
        if (message.playerSlot) {
          this.playerSlot = message.playerSlot;
          this.onJoinedGameCallback?.(message.playerSlot);
        }
        break;

      case 'gameState':
        if (message.state) {
          this.onGameStateCallback?.(message.state);
        }
        break;

      case 'error':
        if (message.error) {
          console.error('[LineWarsClient] Server error:', message.error);
          this.onErrorCallback?.(message.error);
        }
        break;
    }
  }

  private handleDisconnection(): void {
    this.onDisconnectedCallback?.();

    // Attempt to reconnect if we were in a game
    if (this.gameId && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[LineWarsClient] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().then(() => {
          if (this.gameId && this.uid) {
            this.joinGame(this.gameId, this.uid);
          }
        }).catch((error) => {
          console.error('[LineWarsClient] Reconnection failed:', error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  public async joinGame(gameId: string, uid: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to server');
    }

    this.gameId = gameId;
    this.uid = uid;

    const message: ClientMessage = {
      type: 'joinGame',
      gameId,
      uid
    };

    this.ws.send(JSON.stringify(message));
  }

  public sendPlayerInput(direction: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.gameId || !this.uid) {
      console.warn('[LineWarsClient] Cannot send input: not connected or not in game');
      return;
    }

    const message: ClientMessage = {
      type: 'playerInput',
      gameId: this.gameId,
      uid: this.uid,
      data: { direction }
    };

    this.ws.send(JSON.stringify(message));
  }

  public sendGameAction(action: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.gameId || !this.uid) {
      console.warn('[LineWarsClient] Cannot send action: not connected or not in game');
      return;
    }

    const message: ClientMessage = {
      type: 'gameAction',
      gameId: this.gameId,
      uid: this.uid,
      data: action
    };

    this.ws.send(JSON.stringify(message));
  }

  public requestGameState(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.gameId) {
      console.warn('[LineWarsClient] Cannot request state: not connected or not in game');
      return;
    }

    const message: ClientMessage = {
      type: 'getGameState',
      gameId: this.gameId,
      uid: this.uid || ''
    };

    this.ws.send(JSON.stringify(message));
  }

  public leaveGame(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.gameId || !this.uid) {
      return;
    }

    const message: ClientMessage = {
      type: 'leaveGame',
      gameId: this.gameId,
      uid: this.uid
    };

    this.ws.send(JSON.stringify(message));
    
    // Reset game state
    this.gameId = null;
    this.playerSlot = null;
  }

  public disconnect(): void {
    if (this.ws) {
      this.leaveGame();
      this.ws.close();
      this.ws = null;
    }
    this.clientId = null;
    this.gameId = null;
    this.uid = null;
    this.playerSlot = null;
  }

  // Event handlers
  public onGameState(callback: (state: LineWarsGameState) => void): void {
    this.onGameStateCallback = callback;
  }

  public onConnected(callback: (clientId: string) => void): void {
    this.onConnectedCallback = callback;
  }

  public onJoinedGame(callback: (playerSlot: 'player1' | 'player2') => void): void {
    this.onJoinedGameCallback = callback;
  }

  public onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  public onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback;
  }

  // Getters
  public getClientId(): string | null {
    return this.clientId;
  }

  public getGameId(): string | null {
    return this.gameId;
  }

  public getPlayerSlot(): 'player1' | 'player2' | null {
    return this.playerSlot;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public isInGame(): boolean {
    return this.isConnected() && this.gameId !== null && this.playerSlot !== null;
  }
}
