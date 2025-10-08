// ===================== types =====================
interface GameState {
  board: (null | "black" | "white")[][];
  currentPlayer: "black" | "white";
  capturedStones: { black: number; white: number };
  territoryScore: { black: number; white: number };
  totalScore: { black: number; white: number };
  gamePhase: "playing" | "demo" | "finished";
  moveCount: number;
}

interface CapturedStone {
  row: number;
  col: number;
  color: "black" | "white";
  opacity: number;
}

// ===================== config =====================
// Mock leaderboard data for demo
const mockLeaderboard = [
  { name: "AlphaGo", wins: 15 },
  { name: "KataGo", wins: 12 },
  { name: "LeelaZero", wins: 8 },
  { name: "Human Pro", wins: 5 },
  { name: "Amateur", wins: 2 }
];

function getLeaderboard() {
  // Simulate dynamic leaderboard updates
  const shuffled = [...mockLeaderboard].sort(() => Math.random() - 0.5);

  const container = document.getElementById("leaderboard");
  if (!container) return;

  container.innerHTML = `
    <h3>🏆 Leaderboard</h3>
    <table class="lb">
      <tr><th>Player</th><th>Wins</th></tr>
      ${shuffled.map((p: any) => `<tr><td>${p.name}</td><td>${p.wins}</td></tr>`).join("")}
    </table>
  `;
}

// ===================== game class =====================
class FutureGoGameDemo {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: GameState;
  private readonly BOARD_SIZE = 19;
  private readonly CELL_SIZE = 30;
  private readonly STONE_RADIUS = 12;
  private lastMove: [number, number] | null = null;
  private hoverCell: [number, number] | null = null;
  private capturedStones: CapturedStone[] = [];
  private animationFrame: number | null = null;
  private audioCtx: AudioContext;
  private demoInterval: number | null = null;
  private territory: (null | "black" | "white" | "neutral")[][] = [];

  constructor() {
    this.canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;

    const canvasSize = this.CELL_SIZE * (this.BOARD_SIZE + 1);
    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;

    this.gameState = {
      board: Array(this.BOARD_SIZE)
        .fill(null)
        .map(() => Array(this.BOARD_SIZE).fill(null)),
      currentPlayer: "black",
      capturedStones: { black: 0, white: 0 },
      territoryScore: { black: 0, white: 0 },
      totalScore: { black: 0, white: 0 },
      gamePhase: "playing",
      moveCount: 0,
    };

    this.territory = Array(this.BOARD_SIZE)
      .fill(null)
      .map(() => Array(this.BOARD_SIZE).fill(null));
    this.audioCtx = new AudioContext();

    this.setupEventListeners();
    this.animate();
    this.updateUI();

    // Initial leaderboard render + live refresh every 5s for demo
    getLeaderboard();
    setInterval(getLeaderboard, 5000);
  }

  private setupEventListeners() {
    const resumeAudio = () => {
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();
      window.removeEventListener("pointerdown", resumeAudio);
    };
    window.addEventListener("pointerdown", resumeAudio);

    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.round((x - this.CELL_SIZE / 2) / this.CELL_SIZE);
      const row = Math.round((y - this.CELL_SIZE / 2) / this.CELL_SIZE);
      this.placeStone(row, col);
    });

    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.round((x - this.CELL_SIZE / 2) / this.CELL_SIZE);
      const row = Math.round((y - this.CELL_SIZE / 2) / this.CELL_SIZE);
      if (this.isValidPosition(row, col)) this.hoverCell = [row, col];
      else this.hoverCell = null;
      this.draw();
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.hoverCell = null;
      this.draw();
    });

    document.getElementById("newGame")?.addEventListener("click", () => this.newGame());
    document.getElementById("pass")?.addEventListener("click", () => this.pass());
    document.getElementById("startDemo")?.addEventListener("click", () => this.startDemo());
    document.getElementById("stopDemo")?.addEventListener("click", () => this.stopDemo());
  }

  // ===================== DEMO MODE =====================
  private startDemo() {
    if (this.demoInterval) return;
    this.gameState.gamePhase = "demo";

    this.demoInterval = window.setInterval(() => {
      this.makeDemoMove();
    }, 150); // fast mode (~7 moves/sec)

    this.updateUI();
    console.log("Demo started (fast mode).");
  }

  private stopDemo() {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }

    this.gameState.gamePhase = "finished";
    this.updateUI();
    console.log("Demo stopped.");
  }

  // ===================== GAME LOGIC =====================
  private makeDemoMove() {
    const emptyPositions: [number, number][] = [];
    for (let r = 0; r < this.BOARD_SIZE; r++) {
      for (let c = 0; c < this.BOARD_SIZE; c++) {
        if (this.gameState.board[r][c] === null) emptyPositions.push([r, c]);
      }
    }
    if (emptyPositions.length === 0) {
      this.stopDemo();
      return;
    }

    const strategic = emptyPositions.filter(([r, c]) => {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      return dirs.some(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        return this.isValidPosition(nr, nc) && this.gameState.board[nr][nc] !== null;
      });
    });

    const pool = strategic.length > 0 ? strategic : emptyPositions;
    const [row, col] = pool[Math.floor(Math.random() * pool.length)];
    this.placeStone(row, col);
  }

  private placeStone(row: number, col: number) {
    if (!this.isValidPosition(row, col) || this.gameState.board[row][col] !== null) return;
    this.gameState.board[row][col] = this.gameState.currentPlayer;
    this.checkCaptures(row, col);

    const group = this.getGroup(row, col);
    if (this.hasNoLiberties(group)) {
      this.gameState.board[row][col] = null;
      return;
    }

    this.lastMove = [row, col];
    this.playPlaceSound();
    this.gameState.moveCount++;
    this.calculateTerritoryScore();
    this.switchPlayer();
    this.updateUI();
  }

  private checkCaptures(row: number, col: number) {
    const opponent = this.gameState.currentPlayer === "black" ? "white" : "black";
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const r = row + dr, c = col + dc;
      if (this.isValidPosition(r, c) && this.gameState.board[r][c] === opponent) {
        const group = this.getGroup(r, c);
        if (this.hasNoLiberties(group)) this.captureGroup(group);
      }
    }
  }

  private getGroup(row: number, col: number): [number, number][] {
    const color = this.gameState.board[row][col];
    if (!color) return [];
    const visited = new Set<string>();
    const group: [number, number][] = [];
    const stack: [number, number][] = [[row, col]];

    while (stack.length) {
      const [r, c] = stack.pop()!;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      group.push([r, c]);
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (
          this.isValidPosition(nr, nc) &&
          this.gameState.board[nr][nc] === color &&
          !visited.has(`${nr},${nc}`)
        )
          stack.push([nr, nc]);
      }
    }
    return group;
  }

  private hasNoLiberties(group: [number, number][]): boolean {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [r, c] of group) {
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (this.isValidPosition(nr, nc) && this.gameState.board[nr][nc] === null) return false;
      }
    }
    return true;
  }

  private captureGroup(group: [number, number][]) {
    const color = this.gameState.board[group[0][0]][group[0][1]] as "black" | "white";
    for (const [r, c] of group) {
      this.capturedStones.push({ row: r, col: c, color, opacity: 1 });
      this.gameState.board[r][c] = null;
    }
    if (color === "black") this.gameState.capturedStones.white += group.length;
    else this.gameState.capturedStones.black += group.length;

    this.playCaptureSound();
    this.calculateTerritoryScore();
    this.updateUI();
  }

  private calculateTerritoryScore() {
    this.territory = Array(this.BOARD_SIZE)
      .fill(null)
      .map(() => Array(this.BOARD_SIZE).fill(null));
    const visited = new Set<string>();
    let blackTerritory = 0;
    let whiteTerritory = 0;

    for (let r = 0; r < this.BOARD_SIZE; r++) {
      for (let c = 0; c < this.BOARD_SIZE; c++) {
        if (this.gameState.board[r][c] === null && !visited.has(`${r},${c}`)) {
          const terr = this.getTerritory(r, c, visited);
          const owner = this.getTerritoryOwner(terr);
          for (const [tr, tc] of terr) this.territory[tr][tc] = owner;
          if (owner === "black") blackTerritory += terr.length;
          else if (owner === "white") whiteTerritory += terr.length;
        }
      }
    }

    this.gameState.territoryScore = { black: blackTerritory, white: whiteTerritory };
    this.gameState.totalScore = {
      black: this.gameState.capturedStones.black + this.gameState.territoryScore.black,
      white: this.gameState.capturedStones.white + this.gameState.territoryScore.white,
    };
  }

  private getTerritory(startR: number, startC: number, visited: Set<string>): [number, number][] {
    const terr: [number, number][] = [];
    const stack: [number, number][] = [[startR, startC]];
    while (stack.length) {
      const [r, c] = stack.pop()!;
      const key = `${r},${c}`;
      if (visited.has(key) || this.gameState.board[r][c] !== null) continue;
      visited.add(key);
      terr.push([r, c]);
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (this.isValidPosition(nr, nc)) stack.push([nr, nc]);
      }
    }
    return terr;
  }

  private getTerritoryOwner(terr: [number, number][]): "black" | "white" | "neutral" {
    const s = new Set<"black" | "white">();
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [r, c] of terr) {
      for (const [dr, dc] of dirs) {
        const nr = r + dr,
          nc = c + dc;
        if (!this.isValidPosition(nr, nc)) continue;
        const stone = this.gameState.board[nr][nc];
        if (stone) s.add(stone);
      }
    }
    return s.size === 1 ? Array.from(s)[0] : "neutral";
  }

  private isValidPosition(r: number, c: number): boolean {
    return r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE;
  }

  private switchPlayer() {
    this.gameState.currentPlayer = this.gameState.currentPlayer === "black" ? "white" : "black";
  }

  private pass() {
    this.switchPlayer();
    this.updateUI();
  }

  private newGame() {
    this.gameState = {
      board: Array(this.BOARD_SIZE)
        .fill(null)
        .map(() => Array(this.BOARD_SIZE).fill(null)),
      currentPlayer: "black",
      capturedStones: { black: 0, white: 0 },
      territoryScore: { black: 0, white: 0 },
      totalScore: { black: 0, white: 0 },
      gamePhase: "playing",
      moveCount: 0,
    };
    this.lastMove = null;
    this.capturedStones = [];
    this.territory = Array(this.BOARD_SIZE)
      .fill(null)
      .map(() => Array(this.BOARD_SIZE).fill(null));

    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.updateUI();
  }

  // ===================== RENDERING =====================
  private animate() {
    this.draw();
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBoard();
    this.drawTerritory();
    this.drawStones();
    this.drawCapturedStones();
    this.drawHoverPreview();
  }

  private drawBoard() {
    const g = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    g.addColorStop(0, "#d7b37d");
    g.addColorStop(1, "#c49a6c");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = "rgba(70, 40, 10, 0.9)";
    this.ctx.lineWidth = 1.2;
    for (let i = 0; i < this.BOARD_SIZE; i++) {
      const pos = (i + 0.5) * this.CELL_SIZE;
      this.ctx.beginPath();
      this.ctx.moveTo(pos, this.CELL_SIZE / 2);
      this.ctx.lineTo(pos, this.canvas.height - this.CELL_SIZE / 2);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(this.CELL_SIZE / 2, pos);
      this.ctx.lineTo(this.canvas.width - this.CELL_SIZE / 2, pos);
      this.ctx.stroke();
    }

    const starPts = [3, 9, 15];
    this.ctx.fillStyle = "#3a1f0d";
    for (const r of starPts) {
      for (const c of starPts) {
        const x = (c + 0.5) * this.CELL_SIZE;
        const y = (r + 0.5) * this.CELL_SIZE;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }
  }

  private drawTerritory() {
    if (this.gameState.gamePhase !== "demo") return;
    for (let r = 0; r < this.BOARD_SIZE; r++) {
      for (let c = 0; c < this.BOARD_SIZE; c++) {
        const owner = this.territory[r][c];
        if (owner && owner !== "neutral" && this.gameState.board[r][c] === null) {
          const x = (c + 0.5) * this.CELL_SIZE;
          const y = (r + 0.5) * this.CELL_SIZE;
          this.ctx.save();
          this.ctx.globalAlpha = 0.3;
          this.ctx.fillStyle = owner === "black" ? "#2C2C2C" : "#F5F5F5";
          this.ctx.beginPath();
          this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
          this.ctx.fill();
          this.ctx.restore();
        }
      }
    }
  }

  private drawStones() {
    for (let r = 0; r < this.BOARD_SIZE; r++) {
      for (let c = 0; c < this.BOARD_SIZE; c++) {
        const stone = this.gameState.board[r][c];
        if (!stone) continue;
        const x = (c + 0.5) * this.CELL_SIZE;
        const y = (r + 0.5) * this.CELL_SIZE;
        this.ctx.shadowColor = "rgba(0,0,0,0.4)";
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        const g = this.ctx.createRadialGradient(x - 4, y - 4, 4, x, y, this.STONE_RADIUS);
        if (stone === "black") {
          g.addColorStop(0, "#555");
          g.addColorStop(1, "#000");
        } else {
          g.addColorStop(0, "#fff");
          g.addColorStop(1, "#ddd");
        }
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.STONE_RADIUS, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        if (this.lastMove && this.lastMove[0] === r && this.lastMove[1] === c) {
          this.ctx.strokeStyle = "red";
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(x, y, this.STONE_RADIUS + 3, 0, 2 * Math.PI);
          this.ctx.stroke();
        }
      }
    }
  }

  private drawCapturedStones() {
    this.capturedStones = this.capturedStones.filter((s) => s.opacity > 0);
    for (const s of this.capturedStones) {
      const x = (s.col + 0.5) * this.CELL_SIZE;
      const y = (s.row + 0.5) * this.CELL_SIZE;
      this.ctx.save();
      this.ctx.globalAlpha = s.opacity;
      this.ctx.translate(x, y);
      this.ctx.scale(s.opacity, s.opacity);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.STONE_RADIUS, 0, 2 * Math.PI);
      this.ctx.fillStyle = s.color === "black" ? "#000" : "#fff";
      this.ctx.fill();
      this.ctx.restore();
      s.opacity -= 0.02;
    }
  }

  private drawHoverPreview() {
    if (!this.hoverCell || this.gameState.gamePhase === "demo") return;
    const [r, c] = this.hoverCell;
    if (this.isValidPosition(r, c) && this.gameState.board[r][c] === null) {
      const x = (c + 0.5) * this.CELL_SIZE;
      const y = (r + 0.5) * this.CELL_SIZE;
      this.ctx.globalAlpha = 0.5;
      this.ctx.beginPath();
      this.ctx.arc(x, y, this.STONE_RADIUS, 0, 2 * Math.PI);
      this.ctx.fillStyle = this.gameState.currentPlayer === "black" ? "#2C2C2C" : "#F5F5F5";
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    }
  }

  private updateUI() {
    const currentPlayerEl = document.getElementById("currentPlayer");
    const blackCapturedEl = document.getElementById("blackCaptured");
    const whiteCapturedEl = document.getElementById("whiteCaptured");
    const blackTerritoryEl = document.getElementById("blackTerritory");
    const whiteTerritoryEl = document.getElementById("whiteTerritory");
    const blackTotalEl = document.getElementById("blackTotal");
    const whiteTotalEl = document.getElementById("whiteTotal");
    const gameStatusEl = document.getElementById("gameStatus");
    const moveCountEl = document.getElementById("moveCount");

    if (currentPlayerEl) {
      currentPlayerEl.textContent = this.gameState.currentPlayer === "black" ? "Black" : "White";
      currentPlayerEl.className = `current-player ${this.gameState.currentPlayer}`;
    }
    if (blackCapturedEl) blackCapturedEl.textContent = String(this.gameState.capturedStones.black);
    if (whiteCapturedEl) whiteCapturedEl.textContent = String(this.gameState.capturedStones.white);
    if (blackTerritoryEl) blackTerritoryEl.textContent = String(this.gameState.territoryScore.black);
    if (whiteTerritoryEl) whiteTerritoryEl.textContent = String(this.gameState.territoryScore.white);
    if (blackTotalEl) blackTotalEl.textContent = String(this.gameState.totalScore.black);
    if (whiteTotalEl) whiteTotalEl.textContent = String(this.gameState.totalScore.white);

    if (gameStatusEl) {
      if (this.gameState.gamePhase === "demo") {
        gameStatusEl.textContent = "Demo Mode - Auto Playing (Fast)";
        gameStatusEl.className = "game-status demo";
      } else if (this.gameState.gamePhase === "playing") {
        gameStatusEl.textContent = "Manual Play Mode";
        gameStatusEl.className = "game-status playing";
      } else {
        gameStatusEl.textContent = "Demo Finished";
        gameStatusEl.className = "game-status finished";
      }
    }
    if (moveCountEl) moveCountEl.textContent = String(this.gameState.moveCount);
  }

  private playPlaceSound() {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
    osc.connect(gain).connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  private playCaptureSound() {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 300;
    gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
    osc.connect(gain).connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.15);
  }
}

// ===================== Start Game =====================
document.addEventListener("DOMContentLoaded", () => {
  new FutureGoGameDemo();
});
