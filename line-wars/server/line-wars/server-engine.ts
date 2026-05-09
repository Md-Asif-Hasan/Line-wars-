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
  clients: Map<string, any>;
  lastStateBroadcast: number;
  isRunning: boolean;
}

export const GRID_SIZE = 50;
export const CELL_SIZE = 12;
export const PLAYER_SPEED = 2;
export const TRAIL_WIDTH = 3;
export const TERRITORY_WIN_PERCENTAGE = 60;

// Reduced tick rate — free-tier server (0.5 CPU) can't sustain 60 FPS + serialization
export const SERVER_TICK_RATE = 20;      // 20 physics ticks/sec
export const STATE_BROADCAST_RATE = 10;  // 10 state broadcasts/sec
export const MAX_TRAIL_POINTS = 150;     // hard cap on trail array length
export const MAX_TERRITORIES = 6;        // cap territory polygons per player

export class LineWarsServerEngine {
  private games: Map<string, ServerGame> = new Map();
  private gameLoopInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startServerLoop();
  }

  private startServerLoop(): void {
    this.gameLoopInterval = setInterval(() => {
      this.updateAllGames();
    }, 1000 / SERVER_TICK_RATE);
  }

  private updateAllGames(): void {
    const now = Date.now();
    this.games.forEach((game, gameId) => {
      if (!game.isRunning || game.state.gameStatus !== "playing") return;
      this.updateGame(game, 1 / SERVER_TICK_RATE);
      if (now - game.lastStateBroadcast >= 1000 / STATE_BROADCAST_RATE) {
        this.broadcastGameState(gameId);
        game.lastStateBroadcast = now;
      }
    });
  }

  private updateGame(game: ServerGame, deltaTime: number): void {
    const cappedDelta = Math.min(deltaTime, 0.1);
    game.state.lastUpdate = Date.now();
    game.state.gameTime += cappedDelta;
    if (game.state.players.player1) this.updatePlayer(game.state.players.player1, cappedDelta);
    if (game.state.players.player2) this.updatePlayer(game.state.players.player2, cappedDelta);
    this.checkCollisions(game.state);
    this.checkWinConditions(game.state);
  }

  private updatePlayer(player: Player, deltaTime: number): void {
    if (!player.alive) return;

    const moveDistance = player.speed * deltaTime;
    let newX = player.x + Math.cos(player.direction) * moveDistance;
    let newY = player.y + Math.sin(player.direction) * moveDistance;

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

    const inTerritory = this.isPointInTerritory(player.x, player.y, player.territories);

    if (!inTerritory) {
      player.trail.active = true;
      const last = player.trail.points[player.trail.points.length - 1];
      if (!last || this.getDistance(last, { x: player.x, y: player.y }) > 0.5) {
        if (player.trail.points.length >= MAX_TRAIL_POINTS) {
          player.trail.points.shift();
        }
        player.trail.points.push({ x: player.x, y: player.y });
      }
    } else if (player.trail.active) {
      if (player.trail.points.length > 3) {
        this.captureTerritory(player);
      }
      player.trail.active = false;
      player.trail.points = [];
    }
  }

  private getDistance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private isPointInTerritory(x: number, y: number, territories: Territory[]): boolean {
    for (const t of territories) {
      if (this.isPointInPolygon(x, y, t.polygon)) return true;
    }
    return false;
  }

  private isPointInPolygon(x: number, y: number, polygon: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  private captureTerritory(player: Player): void {
    if (player.trail.points.length < 3) return;

    // Simplify polygon: keep every 3rd point to reduce size
    const raw = player.trail.points;
    const simplified: Point[] = [];
    for (let i = 0; i < raw.length; i += 3) simplified.push(raw[i]);
    if (simplified.length < 3) return;

    const area = this.calculatePolygonArea(simplified);
    player.territories.push({ owner: player.id, polygon: simplified, area });

    // Cap: drop the smallest territory when over the limit
    if (player.territories.length > MAX_TERRITORIES) {
      let minIdx = 0;
      for (let i = 1; i < player.territories.length; i++) {
        if (player.territories[i].area < player.territories[minIdx].area) minIdx = i;
      }
      player.territories.splice(minIdx, 1);
    }
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
      if (this.getDistance({ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }) < 0.8) {
        this.endGame(state, "draw");
      }
    }
  }

  private checkWinConditions(state: LineWarsGameState): void {
    if (state.gameStatus !== "playing") return;
    const p1 = state.players.player1;
    const p2 = state.players.player2;
    if (!p1 || !p2) return;

    const p1Area = p1.territories.reduce((s, t) => s + t.area, 0);
    const p2Area = p2.territories.reduce((s, t) => s + t.area, 0);
    const total = p1Area + p2Area;
    if (total > 0) {
      if ((p1Area / total) * 100 >= 60) { this.endGame(state, "player1"); return; }
      if ((p2Area / total) * 100 >= 60) { this.endGame(state, "player2"); return; }
    }
  }

  private endGame(state: LineWarsGameState, winner: "player1" | "player2" | "draw"): void {
    state.gameStatus = winner === "draw" ? "draw" : `${winner}_win` as any;
    state.winner = winner;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

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
      players: { player1: null, player2: null },
      gridSize: GRID_SIZE,
      cellSize: CELL_SIZE,
      gameStatus: "waiting",
      gameTime: 0,
      lastUpdate: Date.now()
    };
  }

  public updatePlayerConnection(gameId: string, uid: string, ws: any): void {
    const game = this.games.get(gameId);
    if (game) game.clients.set(uid, ws);
  }

  public addPlayerToGame(gameId: string, playerId: "player1" | "player2", uid: string, ws: any): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const existing = playerId === "player1" ? game.state.players.player1 : game.state.players.player2;
    if (existing) return false;

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

    if (game.state.players.player1 && game.state.players.player2) {
      game.state.gameStatus = "playing";
      game.isRunning = true;
      this.broadcastGameState(gameId);
    }

    return true;
  }

  private createSquarePolygon(cx: number, cy: number, size: number): Point[] {
    return [
      { x: cx - size, y: cy - size },
      { x: cx + size, y: cy - size },
      { x: cx + size, y: cy + size },
      { x: cx - size, y: cy + size }
    ];
  }

  public handlePlayerInput(gameId: string, uid: string, direction: number): boolean {
    const game = this.games.get(gameId);
    if (!game || !game.isRunning) return false;
    const p1 = game.state.players.player1;
    const p2 = game.state.players.player2;
    if (p1 && p1.uid === uid && p1.alive) { p1.direction = direction; return true; }
    if (p2 && p2.uid === uid && p2.alive) { p2.direction = direction; return true; }
    return false;
  }

  public handleGameAction(gameId: string, uid: string, action: any): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const p1 = game.state.players.player1;
    const p2 = game.state.players.player2;
    const playerId = p1?.uid === uid ? "player1" : p2?.uid === uid ? "player2" : null;
    if (!playerId) return false;

    switch (action.type) {
      case "draw_request":
        if (game.state.drawRequestedBy === playerId) return true;
        if (game.state.drawRequestedBy && game.state.drawRequestedBy !== playerId) {
          this.endGame(game.state, "draw");
        } else {
          game.state.drawRequestedBy = playerId;
        }
        this.broadcastGameState(gameId);
        return true;

      case "forfeit": {
        const winner = playerId === "player1" ? "player2" : "player1";
        this.endGame(game.state, winner);
        this.broadcastGameState(gameId);
        return true;
      }

      case "reset":
        if (game.state.gameStatus !== "playing") {
          game.state.gameStatus = "playing";
          game.state.gameTime = 0;
          game.state.winner = undefined;
          game.state.drawRequestedBy = undefined;
          game.isRunning = true;
          if (p1) {
            game.state.players.player1 = {
              ...p1, x: 10, y: 25, direction: 0, alive: true,
              trail: { owner: "player1", points: [], active: false },
              territories: [{ owner: "player1", polygon: this.createSquarePolygon(8, 23, 4), area: 16 }]
            };
          }
          if (p2) {
            game.state.players.player2 = {
              ...p2, x: 40, y: 25, direction: Math.PI, alive: true,
              trail: { owner: "player2", points: [], active: false },
              territories: [{ owner: "player2", polygon: this.createSquarePolygon(38, 23, 4), area: 16 }]
            };
          }
          this.broadcastGameState(gameId);
        }
        return true;
    }

    return false;
  }

  public removePlayerFromGame(gameId: string, uid: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    game.clients.delete(uid);
    if (game.state.players.player1?.uid === uid) game.state.players.player1 = null;
    if (game.state.players.player2?.uid === uid) game.state.players.player2 = null;
    if (!game.state.players.player1 || !game.state.players.player2) {
      game.isRunning = false;
      game.state.gameStatus = "waiting";
    }
  }

  public broadcastGameState(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const message = JSON.stringify({ type: "gameState", state: game.state });

    if (message.length > 100_000) {
      console.warn(`[LineWars] Skipping broadcast — payload too large (${message.length} bytes)`);
      return;
    }

    game.clients.forEach((ws) => {
      if (ws.readyState === 1) ws.send(message);
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
