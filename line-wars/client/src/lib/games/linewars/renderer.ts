// ─── Line Wars Canvas Renderer ────────────────────────────────────────────────────

import { LineWarsEngine, LineWarsGameState, Point, Territory, Trail, GRID_SIZE, CELL_SIZE, TRAIL_WIDTH } from "./engine";

export class LineWarsRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: LineWarsEngine;
  private cellSize: number;
  private mobileOptimized: boolean = false;

  constructor(canvas: HTMLCanvasElement, engine: LineWarsEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.engine = engine;
    this.cellSize = CELL_SIZE;
    
    this.setupCanvas();
  }

  private setupCanvas(): void {
    const size = GRID_SIZE * this.cellSize;
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
  }

  public setMobileOptimizations(enabled: boolean): void {
    this.mobileOptimized = enabled;
  }

  public render(state: LineWarsGameState): void {
    // Clear canvas
    this.ctx.fillStyle = "#0a0a0a";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    this.drawGrid();

    // Draw territories with glowing effects
    if (state.players.player1) {
      this.drawTerritories(state.players.player1.territories, "#00ffff", 0.3);
    }
    if (state.players.player2) {
      this.drawTerritories(state.players.player2.territories, "#ff00ff", 0.3);
    }

    // Draw territory overlap effects
    this.drawTerritoryOverlaps(state);

    // Draw trails
    if (state.players.player1 && state.players.player1.trail.active) {
      this.drawTrail(state.players.player1.trail, "#00ffff");
    }
    if (state.players.player2 && state.players.player2.trail.active) {
      this.drawTrail(state.players.player2.trail, "#ff00ff");
    }

    // Draw players
    if (state.players.player1) {
      this.drawPlayer(state.players.player1);
    }
    if (state.players.player2) {
      this.drawPlayer(state.players.player2);
    }

    // Draw game status overlay
    if (state.gameStatus !== "playing") {
      this.drawGameStatusOverlay(state);
    }

    // Draw draw request indicator
    if (state.drawRequestedBy) {
      this.drawDrawRequestIndicator(state.drawRequestedBy);
    }
  }

  /** Returns territory percentages (of full grid) for external HUD rendering */
  public getTerritoryPercentages(state: LineWarsGameState): { p1: number; p2: number } {
    const gridArea = GRID_SIZE * GRID_SIZE;
    const p1Area = state.players.player1?.territories.reduce((s, t) => s + t.area, 0) ?? 0;
    const p2Area = state.players.player2?.territories.reduce((s, t) => s + t.area, 0) ?? 0;
    return {
      p1: Math.min((p1Area / gridArea) * 100, 100),
      p2: Math.min((p2Area / gridArea) * 100, 100),
    };
  }

  private drawGrid(): void {
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= GRID_SIZE; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.cellSize, 0);
      this.ctx.lineTo(x * this.cellSize, GRID_SIZE * this.cellSize);
      this.ctx.stroke();
    }

    for (let y = 0; y <= GRID_SIZE; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.cellSize);
      this.ctx.lineTo(GRID_SIZE * this.cellSize, y * this.cellSize);
      this.ctx.stroke();
    }
  }

  private drawTerritories(territories: Territory[], color: string, alpha: number): void {
    territories.forEach(territory => {
      // Create strong glowing effect for territories
      this.ctx.shadowBlur = 30;
      this.ctx.shadowColor = color;
      
      // Create gradient for more vibrant territory colors
      const gradient = this.ctx.createRadialGradient(
        this.canvas.width / 2, this.canvas.height / 2, 0,
        this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2
      );
      gradient.addColorStop(0, color + "CC"); // Bright center
      gradient.addColorStop(0.7, color + "88"); // Mid brightness
      gradient.addColorStop(1, color + "44"); // Dimmer edges
      
      // Fill territory with gradient
      this.ctx.fillStyle = gradient;
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 3;

      this.ctx.beginPath();
      territory.polygon.forEach((point, index) => {
        const x = point.x * this.cellSize;
        const y = point.y * this.cellSize;
        
        if (index === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      });
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Draw animated pulsing border for captured territories
      const time = Date.now() / 1000;
      const pulseIntensity = Math.sin(time * 3) * 0.5 + 0.5;
      this.ctx.strokeStyle = color + Math.floor(pulseIntensity * 255).toString(16).padStart(2, '0');
      this.ctx.lineWidth = 2 + pulseIntensity * 2;
      this.ctx.setLineDash([8, 4]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Reset shadow
      this.ctx.shadowBlur = 0;
    });
  }

  private drawTerritoryOverlaps(state: LineWarsGameState): void {
    // Check for overlapping territories and render them with special effects
    if (!state.players.player1 || !state.players.player2) return;
    
    const p1Territories = state.players.player1.territories;
    const p2Territories = state.players.player2.territories;

    // Draw overlap indicators
    p1Territories.forEach(p1Terr => {
      p2Territories.forEach(p2Terr => {
        if (this.territoriesOverlap(p1Terr, p2Terr)) {
          // Draw special overlap effect
          this.drawOverlapEffect(p1Terr, p2Terr);
        }
      });
    });
  }

  private territoriesOverlap(terr1: Territory, terr2: Territory): boolean {
    // Simple overlap check - if any point of one territory is inside the other
    return terr1.polygon.some(point => 
      this.isPointInPolygon(point.x, point.y, terr2.polygon)
    ) || terr2.polygon.some(point => 
      this.isPointInPolygon(point.x, point.y, terr1.polygon)
    );
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

  private drawOverlapEffect(terr1: Territory, terr2: Territory): void {
    // Draw pulsing effect for overlapping areas
    const overlapArea = this.calculateOverlapArea(terr1, terr2);
    
    this.ctx.save();
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = "#ffffff";

    // Draw overlap indicator at center of overlap
    const centerX = overlapArea.reduce((sum, p) => sum + p.x, 0) / overlapArea.length;
    const centerY = overlapArea.reduce((sum, p) => sum + p.y, 0) / overlapArea.length;

    this.ctx.beginPath();
    this.ctx.arc(centerX * this.cellSize, centerY * this.cellSize, 8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  private calculateOverlapArea(terr1: Territory, terr2: Territory): Point[] {
    // Simple implementation - return intersection points
    // In a real implementation, you'd use a proper polygon clipping algorithm
    const overlapPoints: Point[] = [];
    
    terr1.polygon.forEach(point => {
      if (this.isPointInPolygon(point.x, point.y, terr2.polygon)) {
        overlapPoints.push(point);
      }
    });
    
    terr2.polygon.forEach(point => {
      if (this.isPointInPolygon(point.x, point.y, terr1.polygon)) {
        overlapPoints.push(point);
      }
    });
    
    return overlapPoints;
  }

  private drawTrail(trail: Trail, color: string): void {
    if (!trail.active || trail.points.length < 1) return;

    // Draw glowing trail
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = TRAIL_WIDTH;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Draw trail as connected lines
    this.ctx.beginPath();
    trail.points.forEach((point, index) => {
      const x = point.x * this.cellSize;
      const y = point.y * this.cellSize;
      
      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Draw trail points as small circles for better visibility
    this.ctx.fillStyle = color;
    trail.points.forEach(point => {
      const x = point.x * this.cellSize;
      const y = point.y * this.cellSize;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, TRAIL_WIDTH / 2, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Reset shadow
    this.ctx.shadowBlur = 0;
  }

  private drawPlayer(player: any): void {
    if (!player.alive) return;

    const x = player.x * this.cellSize;
    const y = player.y * this.cellSize;

    // Draw player as glowing circle
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = player.color;
    this.ctx.fillStyle = player.color;
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.arc(x, y, 6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Draw direction indicator
    const dirX = x + Math.cos(player.direction) * 10;
    const dirY = y + Math.sin(player.direction) * 10;
    
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(dirX, dirY);
    this.ctx.stroke();

    // Reset shadow
    this.ctx.shadowBlur = 0;
  }

  private drawGameStatusOverlay(state: LineWarsGameState): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Game status text
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "bold 32px monospace";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    let message = "";
    let color = "#ffffff";

    switch (state.gameStatus) {
      case "player1_win":
        message = "Player 1 Wins!";
        color = "#00ffff";
        break;
      case "player2_win":
        message = "Player 2 Wins!";
        color = "#ff00ff";
        break;
      case "draw":
        message = "Draw!";
        color = "#ffff00";
        break;
      case "forfeit":
        message = `${state.winner === "player1" ? "Player 2" : "Player 1"} Forfeited`;
        color = state.winner === "player1" ? "#00ffff" : "#ff00ff";
        break;
    }

    this.ctx.fillStyle = color;
    this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);

    // Territory percentages
    const p1 = state.players.player1;
    const p2 = state.players.player2;
    
    if (p1 && p2) {
      const gridArea = GRID_SIZE * GRID_SIZE;
      const p1Area = p1.territories.reduce((sum, t) => sum + t.area, 0);
      const p2Area = p2.territories.reduce((sum, t) => sum + t.area, 0);

      this.ctx.font = "16px monospace";
      this.ctx.fillStyle = "#00ffff";
      this.ctx.fillText(`P1: ${((p1Area / gridArea) * 100).toFixed(1)}%`, this.canvas.width / 2 - 100, this.canvas.height / 2 + 40);
      this.ctx.fillStyle = "#ff00ff";
      this.ctx.fillText(`P2: ${((p2Area / gridArea) * 100).toFixed(1)}%`, this.canvas.width / 2 + 100, this.canvas.height / 2 + 40);
    }
  }

  private drawDrawRequestIndicator(playerId: "player1" | "player2"): void {
    const color = playerId === "player1" ? "#00ffff" : "#ff00ff";
    
    this.ctx.fillStyle = color;
    this.ctx.font = "bold 14px monospace";
    this.ctx.textAlign = "center";
    
    const x = playerId === "player1" ? 100 : this.canvas.width - 100;
    const y = 30;
    
    this.ctx.fillText("DRAW REQUESTED", x, y);
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  public resize(): void {
    this.setupCanvas();
  }
}
