import { GameState, MoveRecord, GameMode, BoardTheme } from './types';
import { achievementSystem } from './achievements';
import { themeManager, THEMES } from './themes';

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
  private mode: GameMode = "PVP";
  private hoverPosition: { row: number; col: number } | null = null;
  private replayMode = false;
  private replayIndex = 0;
  private timerInterval: number | null = null;
  private gamesPlayed = 0;
  private hintPosition: { row: number; col: number; alpha: number } | null = null;
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

    themeManager.loadSavedTheme();
    this.setupEventListeners();
    this.animate();
    this.updateUI();
    this.loadGameStats();
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
      lastBoardState: null,
      koPoint: null,
      lastMove: null,
      moveHistory: [],
      timeControl: { black: 600000, white: 600000 },
      showTerritoryPreview: false
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
    document.getElementById("newGame")?.addEventListener("click", () => this.newGame());
    document.getElementById("pass")?.addEventListener("click", () => this.pass());
    document.getElementById("startDemo")?.addEventListener("click", () => this.startDemo());
    document.getElementById("stopDemo")?.addEventListener("click", () => this.stopDemo());
    document.getElementById("undoMove")?.addEventListener("click", () => this.undoMove());
    document.getElementById("showHint")?.addEventListener("click", () => this.showHint());
    document.getElementById("toggleTerritory")?.addEventListener("click", () => this.toggleTerritoryPreview());
    document.getElementById("replayGame")?.addEventListener("click", () => this.startReplay());
    document.getElementById("viewAchievements")?.addEventListener("click", () => this.showAchievementsModal());
    document
      .getElementById("viewFullLeaderboard")
      ?.addEventListener("click", () => showFullLeaderboardModal());

    const themeSelector = document.getElementById("boardTheme") as HTMLSelectElement;
    themeSelector?.addEventListener("change", (e) => {
      const theme = (e.target as HTMLSelectElement).value as BoardTheme;
      themeManager.setTheme(theme);
    });

    const timerToggle = document.getElementById("enableTimer") as HTMLInputElement;
    timerToggle?.addEventListener("change", (e) => {
      if ((e.target as HTMLInputElement).checked) {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (this.replayMode || this.mode === "AIAI" || this.gameState.gamePhase !== "playing") {
        this.hoverPosition = null;
        return;
      }
      if (this.mode === "PVE" && this.gameState.currentPlayer === "white") {
        this.hoverPosition = null;
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.round((x - this.CELL_SIZE / 2) / this.CELL_SIZE);
      const row = Math.round((y - this.CELL_SIZE / 2) / this.CELL_SIZE);

      if (this.isValidPosition(row, col) && this.gameState.board[row][col] === null) {
        this.hoverPosition = { row, col };
      } else {
        this.hoverPosition = null;
      }
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.hoverPosition = null;
    });

    this.canvas.addEventListener("click", (e) => {
      if (this.replayMode || this.mode === "AIAI" || this.gameState.gamePhase !== "playing") return;
      if (this.mode === "PVE" && this.gameState.currentPlayer === "white") return;

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.round((x - this.CELL_SIZE / 2) / this.CELL_SIZE);
      const row = Math.round((y - this.CELL_SIZE / 2) / this.CELL_SIZE);

      if (this.isValidPosition(row, col)) {
        this.placeStone(row, col);
      }
    });
  }

  // ======================= Core Gameplay =======================
  private placeStone(row: number, col: number) {
    if (this.gameState.gamePhase !== "playing" && this.gameState.gamePhase !== "demo") return;
    if (!this.isValidPosition(row, col) || this.gameState.board[row][col] !== null) return;

    if (this.gameState.koPoint && this.gameState.koPoint.row === row && this.gameState.koPoint.col === col) {
      return;
    }

    const boardSnapshot = JSON.stringify(this.gameState.board);

    this.gameState.board[row][col] = this.gameState.currentPlayer;
    const capturedCount = this.handleCaptures(row, col);

    if (!this.hasLibertyCheck(row, col)) {
      this.gameState.board[row][col] = null;
      return;
    }

    const newBoardState = JSON.stringify(this.gameState.board);
    if (capturedCount === 1 && newBoardState === this.gameState.lastBoardState) {
      this.gameState.board[row][col] = null;
      return;
    }

    this.gameState.lastBoardState = boardSnapshot;
    this.gameState.koPoint = null;

    this.gameState.moveHistory.push({
      row,
      col,
      player: this.gameState.currentPlayer,
      timestamp: Date.now(),
      boardState: boardSnapshot,
      capturedStones: { ...this.gameState.capturedStones }
    });

    this.gameState.lastMove = { row, col };

    this.playSound(600);
    this.gameState.moveCount++;
    this.gameState.consecutivePasses = 0;

    this.checkAchievements();
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

    if (this.mode === "PVE" && this.gameState.currentPlayer === "white" && this.gameState.gamePhase === "playing") {
      setTimeout(() => this.aiMove(), 300);
    }
  }

  private undoMove() {
    if (this.gameState.moveHistory.length === 0 || this.gameState.gamePhase !== "playing") return;
    if (this.mode === "PVE" && this.gameState.currentPlayer === "white") return;

    const lastMove = this.gameState.moveHistory.pop();
    if (!lastMove) return;

    if (this.mode === "PVE" && this.gameState.moveHistory.length > 0) {
      this.gameState.moveHistory.pop();
    }

    if (this.gameState.moveHistory.length > 0) {
      const prevMove = this.gameState.moveHistory[this.gameState.moveHistory.length - 1];
      this.gameState.board = JSON.parse(prevMove.boardState);
      this.gameState.capturedStones = { ...prevMove.capturedStones };
      this.gameState.currentPlayer = prevMove.player === "black" ? "white" : "black";
      this.gameState.lastMove = { row: prevMove.row, col: prevMove.col };
    } else {
      this.gameState = this.createInitialState();
    }

    this.gameState.moveCount = this.gameState.moveHistory.length;
    this.updateScores();
    this.updateUI();
  }

  private showHint() {
    if (this.gameState.gamePhase !== "playing" || this.mode === "AIAI") return;

    const emptyPositions: [number, number][] = [];
    for (let r = 0; r < this.BOARD_SIZE; r++) {
      for (let c = 0; c < this.BOARD_SIZE; c++) {
        if (this.gameState.board[r][c] === null && this.canPlaceStone(r, c)) {
          emptyPositions.push([r, c]);
        }
      }
    }

    if (emptyPositions.length === 0) return;

    let bestMove: [number, number] | null = null;
    let bestScore = -Infinity;

    for (const [row, col] of emptyPositions) {
      const score = this.evaluateMove(row, col);
      if (score > bestScore) {
        bestScore = score;
        bestMove = [row, col];
      }
    }

    if (bestMove) {
      this.highlightHint(bestMove[0], bestMove[1]);
    }
  }

  private evaluateMove(row: number, col: number): number {
    let score = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.isValidPosition(nr, nc)) {
        const stone = this.gameState.board[nr][nc];
        if (stone === this.gameState.currentPlayer) {
          score += 2;
        } else if (stone !== null) {
          score += 1;
        }
      }
    }

    const edgeBonus =
      (row === 0 || row === this.BOARD_SIZE - 1 ||
       col === 0 || col === this.BOARD_SIZE - 1) ? -3 : 0;
    const centerBonus =
      (Math.abs(row - this.BOARD_SIZE / 2) < 3 &&
       Math.abs(col - this.BOARD_SIZE / 2) < 3) ? 5 : 0;

    score += edgeBonus + centerBonus;
    score += Math.random() * 2;

    return score;
  }

  private highlightHint(row: number, col: number) {
    this.hintPosition = { row, col, alpha: 1.0 };

    const fadeHint = () => {
      if (this.hintPosition && this.hintPosition.alpha > 0) {
        this.hintPosition.alpha -= 0.015;
        requestAnimationFrame(fadeHint);
      } else {
        this.hintPosition = null;
      }
    };

    fadeHint();
  }

  private toggleTerritoryPreview() {
    this.gameState.showTerritoryPreview = !this.gameState.showTerritoryPreview;
    if (this.gameState.showTerritoryPreview) {
      this.updateScores();
    }
  }

  private hasLibertyCheck(row: number, col: number): boolean {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const visited = new Set<string>();
    const color = this.gameState.board[row][col];

    const check = (r: number, c: number): boolean => {
      if (!this.isValidPosition(r, c)) return false;
      const key = `${r},${c}`;
      if (visited.has(key)) return false;
      visited.add(key);

      const stone = this.gameState.board[r][c];
      if (stone === null) return true;
      if (stone !== color) return false;

      for (const [dr, dc] of dirs) {
        if (check(r + dr, c + dc)) return true;
      }
      return false;
    };

    return check(row, col);
  }

  // ✅ Capture Detection
  private handleCaptures(row: number, col: number): number {
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
    return count;
  }

  private pass() {
    if (this.gameState.gamePhase !== "playing") return;

    this.gameState.consecutivePasses++;
    this.switchPlayer();
    this.updateUI();

    if (this.gameState.consecutivePasses >= 2) {
      this.endGame("Both players passed.");
      return;
    }

    if (this.mode === "PVE" && this.gameState.currentPlayer === "white" && this.gameState.gamePhase === "playing") {
      setTimeout(() => this.aiMove(), 300);
    }
  }

  private startReplay() {
    if (this.gameState.moveHistory.length === 0) {
      alert('No moves to replay!');
      return;
    }

    this.replayMode = true;
    this.replayIndex = 0;
    this.gameState = this.createInitialState();
    this.gameState.gamePhase = "finished";

    const replayInterval = setInterval(() => {
      if (this.replayIndex >= this.gameState.moveHistory.length) {
        clearInterval(replayInterval);
        this.replayMode = false;
        return;
      }

      const move = this.gameState.moveHistory[this.replayIndex];
      this.gameState.board[move.row][move.col] = move.player;
      this.gameState.lastMove = { row: move.row, col: move.col };
      this.replayIndex++;
      this.updateUI();
    }, 500);
  }

  private startTimer() {
    if (this.timerInterval) return;

    const startTime = Date.now();
    this.timerInterval = window.setInterval(() => {
      if (this.gameState.gamePhase !== "playing") {
        this.stopTimer();
        return;
      }

      const elapsed = Date.now() - startTime;
      const player = this.gameState.currentPlayer;

      if (this.gameState.timeControl) {
        this.gameState.timeControl[player] = Math.max(0, 600000 - elapsed);

        if (this.gameState.timeControl[player] <= 0) {
          this.endGame(`${player} ran out of time!`);
        }

        this.updateUI();
      }
    }, 100);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private checkAchievements() {
    if (this.gameState.moveCount === 1) {
      achievementSystem.unlock('first-stone');
    }

    if (this.gameState.capturedStones.black + this.gameState.capturedStones.white > 0) {
      achievementSystem.unlock('first-capture');
    }

    if (this.gameState.capturedStones[this.gameState.currentPlayer] >= 10) {
      achievementSystem.unlock('capture-combo');
    }

    if (this.gameState.territoryScore[this.gameState.currentPlayer] >= 50) {
      achievementSystem.unlock('territory-master');
    }

    if (this.gameState.moveCount >= 200) {
      achievementSystem.unlock('patience');
    }
  }

  private checkGameEndAchievements(winner: "black" | "white" | "draw") {
    if (winner !== "draw") {
      this.gamesPlayed++;
      localStorage.setItem('go-games-played', this.gamesPlayed.toString());

      if (this.gamesPlayed === 1) {
        achievementSystem.unlock('beginner');
      }
      if (this.gamesPlayed === 10) {
        achievementSystem.unlock('veteran');
      }

      if (this.gameState.moveCount < 50) {
        achievementSystem.unlock('quick-win');
      }

      const winnerCaptured = this.gameState.capturedStones[winner];
      if (winnerCaptured === 0) {
        achievementSystem.unlock('perfect-game');
      }

      const corners = [
        [0, 0], [0, this.BOARD_SIZE - 1],
        [this.BOARD_SIZE - 1, 0], [this.BOARD_SIZE - 1, this.BOARD_SIZE - 1]
      ];
      const cornerControl = corners.every(([r, c]) => this.gameState.board[r][c] === winner);
      if (cornerControl) {
        achievementSystem.unlock('corner-master');
      }
    }
  }

  private loadGameStats() {
    const saved = localStorage.getItem('go-games-played');
    this.gamesPlayed = saved ? parseInt(saved) : 0;
  }

  private showAchievementsModal() {
    const achievements = achievementSystem.getAll();
    const progress = achievementSystem.getProgress();

    let modal = document.getElementById('achievementsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'achievementsModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content achievements-modal">
        <h2>Achievements</h2>
        <div class="achievement-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress.percentage}%"></div>
          </div>
          <div class="progress-text">${progress.unlocked} / ${progress.total} (${progress.percentage}%)</div>
        </div>
        <div class="achievements-grid">
          ${achievements.map(ach => `
            <div class="achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}">
              <div class="achievement-icon">${ach.icon}</div>
              <div class="achievement-info">
                <div class="achievement-title">${ach.title}</div>
                <div class="achievement-description">${ach.description}</div>
                ${ach.unlocked && ach.unlockedAt ? `
                  <div class="achievement-unlocked-date">
                    Unlocked: ${new Date(ach.unlockedAt).toLocaleDateString()}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-primary" onclick="document.getElementById('achievementsModal').remove()">Close</button>
      </div>
    `;

    modal.style.display = 'flex';
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  private aiMove() {
    if (this.gameState.gamePhase !== "playing" && this.gameState.gamePhase !== "demo") return;

    const emptyPositions: [number, number][] = [];
    for (let r = 0; r < this.BOARD_SIZE; r++) {
      for (let c = 0; c < this.BOARD_SIZE; c++) {
        if (this.gameState.board[r][c] === null) {
          if (this.canPlaceStone(r, c)) {
            emptyPositions.push([r, c]);
          }
        }
      }
    }
    if (emptyPositions.length === 0) {
      this.pass();
      return;
    }

    let bestMove: [number, number] | null = null;
    let bestScore = -Infinity;

    for (const [row, col] of emptyPositions) {
      const score = this.evaluateMove(row, col);
      if (score > bestScore) {
        bestScore = score;
        bestMove = [row, col];
      }
    }

    if (bestMove) {
      const [row, col] = bestMove;
      this.placeStone(row, col);
    } else {
      this.pass();
    }
  }

  private canPlaceStone(row: number, col: number): boolean {
    if (!this.isValidPosition(row, col) || this.gameState.board[row][col] !== null) return false;
    if (this.gameState.koPoint && this.gameState.koPoint.row === row && this.gameState.koPoint.col === col) return false;

    const originalBoard = this.gameState.board.map(r => [...r]);
    const currentPlayer = this.gameState.currentPlayer;

    this.gameState.board[row][col] = currentPlayer;
    this.handleCaptures(row, col);
    const hasLiberty = this.hasLibertyCheck(row, col);

    this.gameState.board = originalBoard;

    return hasLiberty;
  }


  private startDemo() {
    if (this.demoInterval) return;
    this.mode = "AIAI";
    this.gameState = this.createInitialState();
    this.gameState.gamePhase = "demo";
    const gameOverDisplay = document.getElementById("gameOverDisplay");
    if (gameOverDisplay) gameOverDisplay.style.display = "none";
    this.demoInterval = window.setInterval(() => {
      if (this.gameState.gamePhase === "demo") {
        this.aiMove();
        this.updateScores();
        this.updateUI();
      }
      if (this.gameState.moveCount >= 150 || this.gameState.gamePhase === "finished") {
        this.stopDemo();
      }
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
    this.stopTimer();
    this.updateScores();

    const blackStones = this.gameState.totalScore.black;
    const whiteStones = this.gameState.totalScore.white;
    const blackTerritory = this.gameState.territoryScore.black;
    const whiteTerritory = this.gameState.territoryScore.white;
    const blackTotal = blackStones + blackTerritory;
    const whiteTotal = whiteStones + whiteTerritory;

    let winner: "black" | "white" | "draw" = "draw";
    if (blackTotal > whiteTotal) winner = "black";
    else if (whiteTotal > blackTotal) winner = "white";

    this.checkGameEndAchievements(winner);

    let winnerText = "";
    if (blackTotal > whiteTotal) winnerText = `${this.player1Name} (Black) wins!`;
    else if (whiteTotal > blackTotal)
      winnerText = `${this.player2Name} (White) wins!`;
    else winnerText = "It's a draw!";

    const gameOverDisplay = document.getElementById("gameOverDisplay");
    const gameOverReason = document.getElementById("gameOverReason");
    const gameOverScores = document.getElementById("gameOverScores");
    const gameOverWinner = document.getElementById("gameOverWinner");

    if (gameOverDisplay) gameOverDisplay.style.display = "block";
    if (gameOverReason) gameOverReason.textContent = reason;
    if (gameOverScores) {
      gameOverScores.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong>⚫ ${this.player1Name} (Black)</strong><br>
          Stones: ${blackStones} | Territory: ${blackTerritory} | Total: ${blackTotal}
        </div>
        <div>
          <strong>⚪ ${this.player2Name} (White)</strong><br>
          Stones: ${whiteStones} | Territory: ${whiteTerritory} | Total: ${whiteTotal}
        </div>
      `;
    }
    if (gameOverWinner) gameOverWinner.textContent = winnerText;

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
    this.gameState = this.createInitialState();
    const gameOverDisplay = document.getElementById("gameOverDisplay");
    if (gameOverDisplay) gameOverDisplay.style.display = "none";
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
    if (this.gameState.showTerritoryPreview || this.gameState.gamePhase === "finished") {
      this.drawTerritoryOverlay();
    }
    this.drawStones();
    this.drawLastMoveMarker();
    this.drawHoverPreview();
    this.drawHintMarker();
  }

  private drawHintMarker() {
    if (!this.hintPosition || this.hintPosition.alpha <= 0) return;

    const { row, col, alpha } = this.hintPosition;
    const x = (col + 0.5) * this.CELL_SIZE;
    const y = (row + 0.5) * this.CELL_SIZE;

    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.STONE_RADIUS + 4, 0, 2 * Math.PI);
    this.ctx.stroke();

    this.ctx.fillStyle = '#FFD700';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;
  }

  private drawBoard() {
    const theme = themeManager.getThemeConfig();
    const g = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    g.addColorStop(0, theme.boardGradient.start);
    g.addColorStop(1, theme.boardGradient.end);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = theme.gridColor;
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

    const starPoints = this.getStarPoints();
    this.ctx.fillStyle = theme.gridColor;
    for (const [row, col] of starPoints) {
      const x = (col + 0.5) * this.CELL_SIZE;
      const y = (row + 0.5) * this.CELL_SIZE;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  private getStarPoints(): [number, number][] {
    if (this.BOARD_SIZE === 19) {
      return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
    } else if (this.BOARD_SIZE === 13) {
      return [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];
    } else if (this.BOARD_SIZE === 9) {
      return [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]];
    }
    return [];
  }

  private drawTerritoryOverlay() {
    const theme = themeManager.getThemeConfig();
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        const owner = this.gameState.territoryMap[row][col];
        if (owner && owner !== "neutral") {
          const x = (col + 0.5) * this.CELL_SIZE;
          const y = (row + 0.5) * this.CELL_SIZE;
          this.ctx.globalAlpha = theme.territoryAlpha;
          this.ctx.beginPath();
          this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
          this.ctx.fillStyle = owner === "black" ? theme.blackStone : theme.whiteStone;
          this.ctx.fill();
          this.ctx.globalAlpha = 1.0;
        }
      }
    }
  }

  private drawLastMoveMarker() {
    if (!this.gameState.lastMove) return;

    const { row, col } = this.gameState.lastMove;
    const x = (col + 0.5) * this.CELL_SIZE;
    const y = (row + 0.5) * this.CELL_SIZE;

    this.ctx.strokeStyle = '#FF4444';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.STONE_RADIUS + 3, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  private drawHoverPreview() {
    if (!this.hoverPosition) return;

    const { row, col } = this.hoverPosition;
    const x = (col + 0.5) * this.CELL_SIZE;
    const y = (row + 0.5) * this.CELL_SIZE;

    const theme = themeManager.getThemeConfig();
    this.ctx.globalAlpha = 0.4;
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.STONE_RADIUS, 0, 2 * Math.PI);
    this.ctx.fillStyle = this.gameState.currentPlayer === "black" ? theme.blackStone : theme.whiteStone;
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;
  }

  private drawStones() {
    const now = performance.now();
    const animationDuration = 300;
    const theme = themeManager.getThemeConfig();

    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        const stone = this.gameState.board[row][col];
        if (!stone) continue;
        const x = (col + 0.5) * this.CELL_SIZE;
        const y = (row + 0.5) * this.CELL_SIZE;

        this.ctx.beginPath();
        this.ctx.arc(x, y, this.STONE_RADIUS, 0, 2 * Math.PI);
        this.ctx.fillStyle = stone === "black" ? theme.blackStone : theme.whiteStone;
        this.ctx.fill();

        if (stone === "white") {
          this.ctx.strokeStyle = "rgba(0,0,0,0.2)";
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }

        const gradient = this.ctx.createRadialGradient(
          x - this.STONE_RADIUS * 0.3,
          y - this.STONE_RADIUS * 0.3,
          0,
          x,
          y,
          this.STONE_RADIUS
        );
        if (stone === "black") {
          gradient.addColorStop(0, "rgba(100,100,100,0.3)");
          gradient.addColorStop(1, "rgba(0,0,0,0)");
        } else {
          gradient.addColorStop(0, "rgba(255,255,255,0.8)");
          gradient.addColorStop(1, "rgba(255,255,255,0)");
        }
        this.ctx.fillStyle = gradient;
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

      const capturedByBlack = this.gameState.capturedStones.black > this.gameState.capturedStones.white;
      const captureColor = capturedByBlack ? theme.blackStone : theme.whiteStone;

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
    const historyCountEl = document.getElementById("historyCount");

    if (currentPlayerEl)
      currentPlayerEl.textContent =
        this.gameState.currentPlayer === "black" ? "Black" : "White";
    if (moveCountEl) moveCountEl.textContent = this.gameState.moveCount.toString();
    if (historyCountEl) historyCountEl.textContent = this.gameState.moveHistory.length.toString();

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

    const timerDisplay = document.getElementById('timerDisplay');
    const enableTimer = document.getElementById('enableTimer') as HTMLInputElement;
    if (timerDisplay && enableTimer?.checked && this.gameState.timeControl) {
      timerDisplay.style.display = 'block';
      const blackTimer = document.getElementById('blackTimer');
      const whiteTimer = document.getElementById('whiteTimer');
      if (blackTimer) {
        const minutes = Math.floor(this.gameState.timeControl.black / 60000);
        const seconds = Math.floor((this.gameState.timeControl.black % 60000) / 1000);
        blackTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      if (whiteTimer) {
        const minutes = Math.floor(this.gameState.timeControl.white / 60000);
        const seconds = Math.floor((this.gameState.timeControl.white % 60000) / 1000);
        whiteTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    } else if (timerDisplay) {
      timerDisplay.style.display = 'none';
    }
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

