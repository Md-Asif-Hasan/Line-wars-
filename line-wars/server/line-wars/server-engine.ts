// ─── Server-Side Line Wars Engine (Authoritative) ───────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface Trail {
  owner: "player1" | "player2";
  points: Point[];
  active: boolean;
}

export interface Territory {
  owner: "player1" | "player2";
  polygon: Point[];
  area: number;
}

export interface Player {
  id: "player1" | "player2";
  uid: string;
  x: number;
  y: number;
  direction: number; // radians
  speed: number;
  alive: boolean;
  trail: Trail;
  territories: Territory[];
  color: string;
}

export interface LineWarsGameState {
  players: {
    player1: Player | null;
    player2: Player | null;
  };
  gridSize: number;
  cellSize: number;
  gameStatus: "waiting" | "playing" | "draw" | "player1_win" | "player2_win" | "forfeit";
  winner?: "player1" | "player2" | "draw";
  drawRequestedBy?: "player1" | "player2";
  gameTime: number;
  lastUpdate: number;
}

export interface ServerGame {
  id: string;
  state: LineWarsGameState;
  clients: Map<string, any>; // WebSocket connections
  lastStateBroadcast: number;
  isRunning: boolean;
}

export const GRID_SIZE = 50;
export const CELL_SIZE = 12;
export const PLAYER_SPEED = 2;
export const TRAIL_WIDTH = 3;
export const TERRITORY_WIN_PERCENTAGE = 60;
export const SERVER_TICK_RATE = 60; // 60 FPS
export const STATE_BROADCAST_RATE = 20; // 20 updates per second

export class LineWarsServerEngine {
  private games: Map<string, ServerGame> = new Map();
  private gameLoopInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startServerLoop();
  }

  private startServerLoop(): void {
    // Run authoritative game loop at 60 FPS
    this.gameLoopInterval = setInterval(() => {
      this.updateAllGames();
    }, 1000 / SERVER_TICK_RATE);
  }

  private updateAllGames(): void {
    const now = Date.now();
    
    this.games.forEach((game, gameId) => {
      if (game.isRunning && game.state.gameStatus === "playing") {
        this.updateGame(game, 1 / SERVER_TICK_RATE);
        
        // Broadcast state at 20 FPS to avoid network congestion
        if (now - game.lastStateBroadcast > 1000 / STATE_BROADCAST_RATE) {
          this.broadcastGameState(gameId);
          game.lastStateBroadcast = now;
        }
      }
    });
  }

  private updateGame(game: ServerGame, deltaTime: number): void {
    // Limit delta time to prevent large jumps
    const cappedDelta = Math.min(deltaTime, 0.05); // Cap at 50ms
    
    game.state.lastUpdate = Date.now();
    game.state.gameTime += cappedDelta;

    // Update both players
    if (game.state.players.player1) {
      this.updatePlayer(game.state.players.player1, cappedDelta);
    }
    if (game.state.players.player2) {
      this.updatePlayer(game.state.players.player2, cappedDelta);
    }

    // Check collisions and win conditions
    this.checkCollisions(game.state);
    this.checkWinConditions(game.state);
  }

  private updatePlayer(player: Player, deltaTime: number): void {
    if (!player.alive) return;

    // Move player
    const moveDistance = player.speed * deltaTime;
    let newX = player.x + Math.cos(player.direction) * moveDistance;
    let newY = player.y + Math.sin(player.direction) * moveDistance;

    // Bouncy edges - bounce off walls
    if (newX <= 1 || newX >= GRID_SIZE - 1) {
      player.direction = Math.PI - player.direction;
      newX = Math.max(1, Math.min(GRID_SIZE - 1, newX));
    }
    
    if (newY <= 1 || newY >= GRID_SIZE - 1) {
      player.direction = -player.direction;
      newY = Math.max(1, Math.min(GRID_SIZE - 1, newY));
    }

    player.x = newX;
    player.y = newY;

    // Add to trail if outside territory
    const inTerritory = this.isPointInTerritory(player.x, player.y, player.territories);
    if (!inTerritory) {
      player.trail.active = true;
      // Add point to trail only if it's far enough from last point
      const lastPoint = player.trail.points[player.trail.points.length - 1];
      if (!lastPoint || this.getDistance(lastPoint, { x: player.x, y: player.y }) > 0.3) {
        player.trail.points.push({ x: player.x, y: player.y });
      }
    } else if (player.trail.active) {
      // Player re-entered territory, check if they closed a loop
      if (player.trail.points.length > 3) {
        this.captureTerritory(player);
      }
      player.trail.active = false;
      player.trail.points = [];
    }
  }

  private getDistance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  private isPointInTerritory(x: number, y: number, territories: Territory[]): boolean {
    return territories.some(territory => this.isPointInPolygon(x, y, territory.polygon));
  }

  private isPointInPolygon(x: number, y: number, polygon: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private captureTerritory(player: Player): void {
    if (player.trail.points.length < 3) return;

    const polygon = [...player.trail.points];
    const area = this.calculatePolygonArea(polygon);
    
    const newTerritory: Territory = {
      owner: player.id,
      polygon,
      area
    };

    player.territories.push(newTerritory);
  }

  private calculatePolygonArea(polygon: Point[]): number {
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      area += polygon[j].x * polygon[i].y;
      area -= polygon[i].x * polygon[j].y;
    }
    return Math.abs(area / 2);
  }

  private checkCollisions(state: LineWarsGameState): void {
    const p1 = state.players.player1;
    const p2 = state.players.player2;

    if (p1 && p2 && p1.alive && p2.alive) {
      const distance = this.getDistance({ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y });
      if (distance < 0.8) {
        // Head-on collision - draw
        this.endGame(state, "draw");
      }
    }
  }

  private checkWinConditions(state: LineWarsGameState): void {
    if (state.gameStatus !== "playing") return;

    const p1 = state.players.player1;
    const p2 = state.players.player2;

    if (!p1 || !p2) return;

    // Check territory victory (60% required)
    const p1Area = p1.territories.reduce((sum, t) => sum + t.area, 0);
    const p2Area = p2.territories.reduce((sum, t) => sum + t.area, 0);
    const totalArea = p1Area + p2Area;

    if (totalArea > 0) {
      const p1Percentage = (p1Area / totalArea) * 100;
      const p2Percentage = (p2Area / totalArea) * 100;

      if (p1Percentage >= 60) {
        this.endGame(state, "player1");
        return;
      }
      if (p2Percentage >= 60) {
        this.endGame(state, "player2");
        return;
      }
    }
  }

  private endGame(state: LineWarsGameState, winner: "player1" | "player2" | "draw"): void {
    state.gameStatus = winner === "draw" ? "draw" : `${winner}_win` as any;
    state.winner = winner;
  }

  // Public API methods
  public createGame(gameId: string): ServerGame {
    const game: ServerGame = {
      id: gameId,
      state: this.createInitialState(),
      clients: new Map(),
      lastStateBroadcast: Date.now(),
      isRunning: false
    };

    this.games.set(gameId, game);
    return game;
  }

  private createInitialState(): LineWarsGameState {
    return {
      players: {
        player1: null,
        player2: null
      },
      gridSize: GRID_SIZE,
      cellSize: CELL_SIZE,
      gameStatus: "waiting",
      gameTime: 0,
      lastUpdate: Date.now()
    };
  }

  public addPlayerToGame(gameId: string, playerId: "player1" | "player2", uid: string, ws: any): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const existingPlayer = playerId === "player1" ? game.state.players.player1 : game.state.players.player2;
    if (existingPlayer) return false; // Slot already taken

    const player: Player = {
      id: playerId,
      uid,
      x: playerId === "player1" ? 10 : 40,
      y: 25,
      direction: playerId === "player1" ? 0 : Math.PI,
      speed: PLAYER_SPEED,
      alive: true,
      trail: { owner: playerId, points: [], active: false },
      territories: [{
        owner: playerId,
        polygon: this.createSquarePolygon(playerId === "player1" ? 8 : 38, 23, 4),
        area: 16
      }],
      color: playerId === "player1" ? "#00ffff" : "#ff00ff"
    };

    game.state.players[playerId] = player;
    game.clients.set(uid, ws);

    // Start game when both players are connected
    if (game.state.players.player1 && game.state.players.player2) {
      game.state.gameStatus = "playing";
      game.isRunning = true;
    }

    return true;
  }

  private createSquarePolygon(centerX: number, centerY: number, size: number): Point[] {
    return [
      { x: centerX - size, y: centerY - size },
      { x: centerX + size, y: centerY - size },
      { x: centerX + size, y: centerY + size },
      { x: centerX - size, y: centerY + size }
    ];
  }

  public handlePlayerInput(gameId: string, uid: string, direction: number): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.isRunning) return false;

    const player1 = game.state.players.player1;
    const player2 = game.state.players.player2;

    if (player1 && player1.uid === uid && player1.alive) {
      player1.direction = direction;
      return true;
    }

    if (player2 && player2.uid === uid && player2.alive) {
      player2.direction = direction;
      return true;
    }

    return false;
  }

  public handleGameAction(gameId: string, uid: string, action: any): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const player1 = game.state.players.player1;
    const player2 = game.state.players.player2;

    const playerId = player1?.uid === uid ? "player1" : player2?.uid === uid ? "player2" : null;
    if (!playerId) return false;

    switch (action.type) {
      case "draw_request":
        this.endGame(game.state, "draw");
        return true;
      case "forfeit":
        const winner = playerId === "player1" ? "player2" : "player1";
        this.endGame(game.state, winner);
        return true;
      case "reset":
        if (game.state.gameStatus !== "playing") {
          game.state = this.createInitialState();
          // Re-add players
          if (player1) {
            game.state.players.player1 = {
              ...player1,
              x: 10,
              y: 25,
              direction: 0,
              alive: true,
              trail: { owner: "player1", points: [], active: false },
              territories: [{
                owner: "player1",
                polygon: this.createSquarePolygon(8, 23, 4),
                area: 16
              }]
            };
          }
          if (player2) {
            game.state.players.player2 = {
              ...player2,
              x: 40,
              y: 25,
              direction: Math.PI,
              alive: true,
              trail: { owner: "player2", points: [], active: false },
              territories: [{
                owner: "player2",
                polygon: this.createSquarePolygon(38, 23, 4),
                area: 16
              }]
            };
          }
          game.state.gameStatus = "playing";
        }
        return true;
    }

    return false;
  }

  public removePlayerFromGame(gameId: string, uid: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    game.clients.delete(uid);

    // Remove player from game state
    if (game.state.players.player1?.uid === uid) {
      game.state.players.player1 = null;
    }
    if (game.state.players.player2?.uid === uid) {
      game.state.players.player2 = null;
    }

    // Stop game if not enough players
    if (!game.state.players.player1 || !game.state.players.player2) {
      game.isRunning = false;
      game.state.gameStatus = "waiting";
    }
  }

  public broadcastGameState(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const message = JSON.stringify({
      type: "gameState",
      state: game.state
    });

    game.clients.forEach((ws) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    });
  }

  public getGameState(gameId: string): LineWarsGameState | null {
    const game = this.games.get(gameId);
    return game ? game.state : null;
  }

  public cleanupGame(gameId: string): void {
    this.games.delete(gameId);
  }

  public shutdown(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    this.games.clear();
  }
}
