// ======================= Interfaces =======================
interface GameState {
  board: (null | "black" | "white")[][];
  currentPlayer: "black" | "white";
  capturedStones: { black: number; white: number };
  territoryScore: { black: number; white: number };
  totalScore: { black: number; white: number };
  gamePhase: "playing" | "demo" | "finished";
  moveCount: number;
  consecutivePasses: number;
  territoryMap: (null | "black" | "white" | "neutral")[][];
  captureAnimations: Array<{ row: number; col: number; startTime: number }>;
}

// ======================= Game Class =======================
class FutureGoGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: GameState;
  private readonly BOARD_SIZE = 19;
  private readonly CELL_SIZE = 30;
  private readonly STONE_RADIUS = 12;
  private animationFrame: number | null = null;
  private audioCtx: AudioContext;
  private demoInterval: number | null = null;
  private mode: "PVP" | "PVE" | "AIAI" = "PVP";
  private player1Name: string = "Player 1";
  private player2Name: string = "Player 2";
  private socket: WebSocket | null = null;
  private roomId: string | null = null;


  constructor() {
    this.canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    const canvasSize = this.CELL_SIZE * (this.BOARD_SIZE + 1);
    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;
    this.audioCtx = new AudioContext();
    this.gameState = this.createInitialState();

    this.setupEventListeners();
    this.animate();
    this.updateUI();
    getLeaderboard();
  }


  public connectToRoom(roomId: string) {
  this.roomId = roomId;
  this.socket = new WebSocket(`ws://127.0.0.1:8010/ws/${roomId}`);

  this.socket.onopen = () => {
    console.log(`Connected to room: ${roomId}`);
  };

  this.socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "move") {
      console.log("Received move:", data);
      this.placeStone(data.row, data.col); // Mirror the other player's move
    }
  };

  this.socket.onclose = () => console.log("Disconnected from room");
}


  private createInitialState(): GameState {
    return {
      board: Array(this.BOARD_SIZE)
        .fill(null)
        .map(() => Array(this.BOARD_SIZE).fill(null)),
      currentPlayer: "black",
      capturedStones: { black: 0, white: 0 },
      territoryScore: { black: 0, white: 0 },
      totalScore: { black: 0, white: 0 },
      gamePhase: "playing",
      moveCount: 0,
      consecutivePasses: 0,
      territoryMap: Array(this.BOARD_SIZE)
        .fill(null)
        .map(() => Array(this.BOARD_SIZE).fill(null)),
      captureAnimations: [],
    };
  }

  // ======================= Event Listeners =======================
  private setupEventListeners() {
    document.getElementById("pvpMode")?.addEventListener("click", () => {
      this.mode = "PVP";
      this.newGame();
    });
    document.getElementById("pveMode")?.addEventListener("click", () => {
      this.mode = "PVE";
      this.newGame();
    });
    document.getElementById("aiMode")?.addEventListener("click", () => {
      this.mode = "AIAI";
      this.startDemo();
    });
    document.getElementById("joinRoom")?.addEventListener("click", () => {
      const input = document.getElementById("roomId") as HTMLInputElement;
      if (input?.value) {
        this.connectToRoom(input.value);
        alert(`Joined room: ${input.value}`);
      }
    });


    document.getElementById("newGame")?.addEventListener("click", () => this.newGame());
    document.getElementById("pass")?.addEventListener("click", () => this.pass());
    document.getElementById("stopDemo")?.addEventListener("click", () => this.stopDemo());
    document
      .getElementById("viewFullLeaderboard")
      ?.addEventListener("click", () => showFullLeaderboardModal());

    this.canvas.addEventListener("click", (e) => {
      if (this.mode === "AIAI" || this.gameState.gamePhase !== "playing") return;

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.round((x - this.CELL_SIZE / 2) / this.CELL_SIZE);
      const row = Math.round((y - this.CELL_SIZE / 2) / this.CELL_SIZE);

      if (this.isValidPosition(row, col)) {
        this.placeStone(row, col);
        if (this.mode === "PVE" && this.gameState.currentPlayer === "white") {
          setTimeout(() => this.aiMove(), 150);
        }
      }
    });
  }

  // ======================= Core Gameplay =======================
  private placeStone(row: number, col: number) {
    if (!this.isValidPosition(row, col) || this.gameState.board[row][col] !== null) return;
    this.gameState.board[row][col] = this.gameState.currentPlayer;

    this.handleCaptures(row, col);
    this.playSound(600);
    this.gameState.moveCount++;
    this.gameState.consecutivePasses = 0;

    this.updateScores();
    this.checkGameOver();
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "move",
          row,
          col,
          color: this.gameState.currentPlayer,
        })
      );
    }

    this.switchPlayer();
    this.updateUI();
  }

  // ✅ Capture Detection
  private handleCaptures(row: number, col: number) {
    const opponent = this.gameState.currentPlayer === "black" ? "white" : "black";
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const toCapture: [number, number][] = [];

    const hasLiberty = (r: number, c: number, visited = new Set<string>()): boolean => {
      if (!this.isValidPosition(r, c)) return false;
      const key = `${r},${c}`;
      if (visited.has(key)) return false;
      visited.add(key);
      const stone = this.gameState.board[r][c];
      if (stone === null) return true;
      if (stone !== opponent) return false;
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (hasLiberty(nr, nc, visited)) return true;
      }
      return false;
    };

    const markGroup = (
      r: number,
      c: number,
      visited = new Set<string>(),
      group: [number, number][] = []
    ): [number, number][] => {
      if (!this.isValidPosition(r, c)) return group;
      const key = `${r},${c}`;
      if (visited.has(key)) return group;
      visited.add(key);
      if (this.gameState.board[r][c] !== opponent) return group;
      group.push([r, c]);
      for (const [dr, dc] of dirs) markGroup(r + dr, c + dc, visited, group);
      return group;
    };

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (!this.isValidPosition(nr, nc)) continue;
      if (this.gameState.board[nr][nc] === opponent) {
        const group = markGroup(nr, nc);
        const visited = new Set<string>();
        if (!hasLiberty(nr, nc, visited)) toCapture.push(...group);
      }
    }

    const count = toCapture.length;
    if (count > 0) {
      const now = performance.now();
      for (const [r, c] of toCapture) {
        this.gameState.board[r][c] = null;
        this.gameState.captureAnimations.push({ row: r, col: c, startTime: now });
      }
      this.gameState.capturedStones[this.gameState.currentPlayer] += count;
    }
  }

  private pass() {
    this.gameState.consecutivePasses++;
    this.switchPlayer();
    this.updateUI();

    if (this.gameState.consecutivePasses >= 2) {
      this.endGame("Both players passed.");
      return;
    }

    if (this.mode === "PVE" && this.gameState.currentPlayer === "white") {
      setTimeout(() => this.aiMove(), 150);
    }
  }

  private aiMove() {
    const emptyPositions: [number, number][] = [];
    for (let r = 0; r < this.BOARD_SIZE; r++) {
      for (let c = 0; c < this.BOARD_SIZE; c++) {
        if (this.gameState.board[r][c] === null) emptyPositions.push([r, c]);
      }
    }
    if (emptyPositions.length === 0) {
      this.endGame("Board full");
      return;
    }
    const [row, col] = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    this.placeStone(row, col);
  }

  private startDemo() {
    if (this.demoInterval) return;
    this.mode = "AIAI";
    this.gameState.gamePhase = "demo";
    this.demoInterval = window.setInterval(() => {
      this.aiMove();
      if (this.gameState.moveCount >= 150) this.stopDemo();
    }, 100);
  }

  private async stopDemo() {
    if (this.demoInterval) clearInterval(this.demoInterval);
    this.demoInterval = null;
    this.endGame("AI demo ended");
  }

  // ======================= Game Over =======================
  private async endGame(reason: string) {
    if (this.gameState.gamePhase === "finished") return;
    this.gameState.gamePhase = "finished";
    this.updateScores();

    const blackStones = this.gameState.totalScore.black;
    const whiteStones = this.gameState.totalScore.white;
    const blackTerritory = this.gameState.territoryScore.black;
    const whiteTerritory = this.gameState.territoryScore.white;
    const blackTotal = blackStones + blackTerritory;
    const whiteTotal = whiteStones + whiteTerritory;

    let winnerText = "";
    if (blackTotal > whiteTotal) winnerText = `🏆 ${this.player1Name} (Black) wins!`;
    else if (whiteTotal > blackTotal)
      winnerText = `🏆 ${this.player2Name} (White) wins!`;
    else winnerText = "🤝 It's a draw!";

    alert(`
🎮 Game Over: ${reason}
──────────────────────────
⚫ ${this.player1Name} (Black)
Stones: ${blackStones}
Territory: ${blackTerritory}
Total: ${blackTotal}

⚪ ${this.player2Name} (White)
Stones: ${whiteStones}
Territory: ${whiteTerritory}
Total: ${whiteTotal}

${winnerText}
`);

    const p1 = this.mode === "AIAI" ? "BlackAI" : this.player1Name;
    const p2 = this.mode === "AIAI" ? "WhiteAI" : this.player2Name;

    await addPlayer(p1);
    await addPlayer(p2);
    await recordGame(p1, p2, blackTotal, whiteTotal);
    await getLeaderboard();
  }

  private checkGameOver() {
    const isFull = this.gameState.board.every((row) => row.every((cell) => cell !== null));
    if (isFull) this.endGame("Board filled up");
  }

  // ======================= Scoring =======================
  private updateScores() {
    const blackStones = this.gameState.board.flat().filter((s) => s === "black").length;
    const whiteStones = this.gameState.board.flat().filter((s) => s === "white").length;
    this.gameState.totalScore.black = blackStones;
    this.gameState.totalScore.white = whiteStones;

    const { black, white, map } = this.calculateTerritory();
    this.gameState.territoryScore.black = black;
    this.gameState.territoryScore.white = white;
    this.gameState.territoryMap = map;
  }

  private calculateTerritory(): {
    black: number;
    white: number;
    map: (null | "black" | "white" | "neutral")[][];
  } {
    const visited = new Set<string>();
    const map = Array(this.BOARD_SIZE)
      .fill(null)
      .map(() => Array(this.BOARD_SIZE).fill(null));
    let blackTerritory = 0;
    let whiteTerritory = 0;

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    const explore = (r: number, c: number) => {
      const stack = [[r, c]];
      const region: [number, number][] = [];
      const borders = new Set<"black" | "white">();

      while (stack.length) {
        const [row, col] = stack.pop()!;
        const key = `${row},${col}`;
        if (visited.has(key)) continue;
        visited.add(key);
        region.push([row, col]);

        for (const [dr, dc] of dirs) {
          const nr = row + dr;
          const nc = col + dc;
          if (!this.isValidPosition(nr, nc)) continue;
          const neighbor = this.gameState.board[nr][nc];
          if (neighbor === null) stack.push([nr, nc]);
          else borders.add(neighbor);
        }
      }

      if (borders.size === 1) {
        const owner = Array.from(borders)[0];
        for (const [r2, c2] of region) map[r2][c2] = owner;
        if (owner === "black") blackTerritory += region.length;
        else whiteTerritory += region.length;
      } else {
        for (const [r2, c2] of region) map[r2][c2] = "neutral";
      }
    };

    for (let r = 0; r < this.BOARD_SIZE; r++) {
      for (let c = 0; c < this.BOARD_SIZE; c++) {
        if (this.gameState.board[r][c] === null && !visited.has(`${r},${c}`)) {
          explore(r, c);
        }
      }
    }

    return { black: blackTerritory, white: whiteTerritory, map };
  }

  // ======================= Utility =======================
  private newGame() {
    const p1Input = document.getElementById("player1Name") as HTMLInputElement;
    const p2Input = document.getElementById("player2Name") as HTMLInputElement;
    this.player1Name = p1Input?.value || "Player 1";
    this.player2Name = p2Input?.value || "Player 2";
    this.gameState = this.createInitialState();
    this.updateUI();
  }

  private switchPlayer() {
    this.gameState.currentPlayer =
      this.gameState.currentPlayer === "black" ? "white" : "black";
  }

  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.BOARD_SIZE && col >= 0 && col < this.BOARD_SIZE;
  }

  private animate() {
    this.draw();
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBoard();
    this.drawTerritoryOverlay();
    this.drawStones();
  }

  private drawBoard() {
    const g = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    g.addColorStop(0, "#d7b37d");
    g.addColorStop(1, "#c49a6c");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = "rgba(70,40,10,0.9)";
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
  }

  private drawTerritoryOverlay() {
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        const owner = this.gameState.territoryMap[row][col];
        if (owner && owner !== "neutral") {
          const x = (col + 0.5) * this.CELL_SIZE;
          const y = (row + 0.5) * this.CELL_SIZE;
          this.ctx.globalAlpha = 0.25;
          this.ctx.beginPath();
          this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
          this.ctx.fillStyle = owner === "black" ? "#000" : "#fff";
          this.ctx.fill();
          this.ctx.globalAlpha = 1.0;
        }
      }
    }
  }

  private drawStones() {
    const now = performance.now();
    const animationDuration = 300;

    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        const stone = this.gameState.board[row][col];
        if (!stone) continue;
        const x = (col + 0.5) * this.CELL_SIZE;
        const y = (row + 0.5) * this.CELL_SIZE;
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.STONE_RADIUS, 0, 2 * Math.PI);
        this.ctx.fillStyle = stone === "black" ? "#000" : "#fff";
        this.ctx.fill();
      }
    }

    this.gameState.captureAnimations = this.gameState.captureAnimations.filter((anim) => {
      const elapsed = now - anim.startTime;
      if (elapsed > animationDuration) return false;

      const progress = elapsed / animationDuration;
      const x = (anim.col + 0.5) * this.CELL_SIZE;
      const y = (anim.row + 0.5) * this.CELL_SIZE;
      const alpha = 1 - progress;
      const radius = this.STONE_RADIUS * (1 + progress * 0.5);

      const stoneColor = this.gameState.board[anim.row]?.[anim.col] === "black" ? "#000" : "#fff";
      const capturedByBlack = this.gameState.capturedStones.black > this.gameState.capturedStones.white;
      const captureColor = capturedByBlack ? "#000" : "#fff";

      this.ctx.globalAlpha = alpha;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
      this.ctx.fillStyle = captureColor;
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;

      return true;
    });
  }

   // ======================= UI Update =======================
  private updateUI() {
    const currentPlayerEl = document.getElementById("currentPlayer");
    const moveCountEl = document.getElementById("moveCount");

    if (currentPlayerEl)
      currentPlayerEl.textContent =
        this.gameState.currentPlayer === "black" ? "Black" : "White";
    if (moveCountEl) moveCountEl.textContent = this.gameState.moveCount.toString();

    const blackCapturedEl = document.getElementById("blackCaptured");
    const whiteCapturedEl = document.getElementById("whiteCaptured");
    const blackTerritoryEl = document.getElementById("blackTerritory");
    const whiteTerritoryEl = document.getElementById("whiteTerritory");
    const blackTotalEl = document.getElementById("blackTotal");
    const whiteTotalEl = document.getElementById("whiteTotal");

    if (blackCapturedEl)
      blackCapturedEl.textContent = this.gameState.capturedStones.black.toString();
    if (whiteCapturedEl)
      whiteCapturedEl.textContent = this.gameState.capturedStones.white.toString();
    if (blackTerritoryEl)
      blackTerritoryEl.textContent = this.gameState.territoryScore.black.toString();
    if (whiteTerritoryEl)
      whiteTerritoryEl.textContent = this.gameState.territoryScore.white.toString();

    const blackTotal =
      this.gameState.totalScore.black + this.gameState.territoryScore.black;
    const whiteTotal =
      this.gameState.totalScore.white + this.gameState.territoryScore.white;

    if (blackTotalEl) blackTotalEl.textContent = blackTotal.toString();
    if (whiteTotalEl) whiteTotalEl.textContent = whiteTotal.toString();
  }

  // ======================= Sound Effects =======================
  private playSound(freq: number) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
    osc.connect(gain).connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }
}

// ======================= Backend API =======================
const API_BASE = "http://127.0.0.1:8010";

async function addPlayer(name: string) {
  await fetch(`${API_BASE}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

async function recordGame(player1: string, player2: string, score1: number, score2: number) {
  await fetch(`${API_BASE}/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player1, player2, score_p1: score1, score_p2: score2 }),
  });
}

// ======================= Leaderboard Logic =======================
async function getLeaderboard() {
  const res = await fetch(`${API_BASE}/leaderboard`);
  const data = await res.json();

  // ✅ Filter players: only valid names, with wins, sorted top 10
  const filtered = data
    .filter(
      (p: any) =>
        p.wins > 0 &&
        !["Player 1", "Player 2", "TestPlayer", "Default", "test"].includes(p.name)
    )
    .sort((a: any, b: any) => b.wins - a.wins)
    .slice(0, 10);

  const container = document.getElementById("leaderboard");
  if (!container) return;

  container.innerHTML = `
    <h3>🏆 Leaderboard (Top 10)</h3>
    <table>
      <tr><th>Player</th><th>Wins</th></tr>
      ${filtered
        .map((p: any) => `<tr><td>${p.name}</td><td>${p.wins}</td></tr>`)
        .join("")}
    </table>
    <button id="viewFullLeaderboard" class="btn btn-secondary" style="margin-top:8px;">
      View Full Leaderboard
    </button>
  `;

  document
    .getElementById("viewFullLeaderboard")
    ?.addEventListener("click", () => showFullLeaderboardModal());
}

// ======================= Full Leaderboard Modal =======================
async function showFullLeaderboardModal() {
  const res = await fetch(`${API_BASE}/leaderboard`);
  const data = await res.json();

  const valid = data
    .filter(
      (p: any) =>
        !["Player 1", "Player 2", "TestPlayer", "Default", "test"].includes(p.name)
    )
    .sort((a: any, b: any) => b.wins - a.wins);

  // ✅ Create modal container if not exists
  let modal = document.getElementById("leaderboardModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "leaderboardModal";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgba(0,0,0,0.6)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "9999";
    modal.innerHTML = `
      <div style="
        background: #f8f5ef;
        padding: 20px;
        border-radius: 12px;
        width: 350px;
        max-height: 500px;
        overflow-y: auto;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      ">
        <h2 style="text-align:center;">🏆 Full Leaderboard</h2>
        <table style="width:100%; border-collapse:collapse;">
          <tr style="background:#e0d5c0;"><th>Player</th><th>Wins</th></tr>
          ${valid
            .map(
              (p: any) =>
                `<tr><td style="padding:6px;">${p.name}</td><td style="text-align:right;">${p.wins}</td></tr>`
            )
            .join("")}
        </table>
        <div style="text-align:center; margin-top:12px;">
          <button id="closeLeaderboardModal" class="btn btn-primary">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Close modal logic
  document
    .getElementById("closeLeaderboardModal")
    ?.addEventListener("click", () => modal?.remove());
}

// ======================= Initialize Game =======================
document.addEventListener("DOMContentLoaded", () => new FutureGoGame());

