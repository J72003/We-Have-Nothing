interface GameState {
  board: (null | 'black' | 'white')[][];
  currentPlayer: 'black' | 'white';
  blackScore: number;
  whiteScore: number;
}

interface CapturedStone {
  row: number;
  col: number;
  color: 'black' | 'white';
  opacity: number;
}

class SimpleGoGame {
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

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    const canvasSize = this.CELL_SIZE * (this.BOARD_SIZE + 1);
    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;
    
    this.gameState = {
      board: Array(this.BOARD_SIZE).fill(null).map(() => Array(this.BOARD_SIZE).fill(null)),
      currentPlayer: 'black',
      blackScore: 0,
      whiteScore: 0
    };

    this.audioCtx = new AudioContext();

    this.setupEventListeners();
    this.animate();
    this.updateUI();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const col = Math.round((x - this.CELL_SIZE / 2) / this.CELL_SIZE);
      const row = Math.round((y - this.CELL_SIZE / 2) / this.CELL_SIZE);
      
      this.placeStone(row, col);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const col = Math.round((x - this.CELL_SIZE / 2) / this.CELL_SIZE);
      const row = Math.round((y - this.CELL_SIZE / 2) / this.CELL_SIZE);

      if (this.isValidPosition(row, col)) {
        this.hoverCell = [row, col];
      } else {
        this.hoverCell = null;
      }
      this.draw();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverCell = null;
      this.draw();
    });

    document.getElementById('newGame')?.addEventListener('click', () => {
      this.newGame();
    });

    document.getElementById('pass')?.addEventListener('click', () => {
      this.pass();
    });
  }

  private placeStone(row: number, col: number) {
    if (!this.isValidPosition(row, col) || this.gameState.board[row][col] !== null) {
      return;
    }

    this.gameState.board[row][col] = this.gameState.currentPlayer;

    // Check captures
    this.checkCaptures(row, col);

    // Suicide rule check
    const group = this.getGroup(row, col);
    if (this.hasNoLiberties(group)) {
      this.gameState.board[row][col] = null;
      return;
    }

    this.lastMove = [row, col];
    this.playPlaceSound();
    this.switchPlayer();
    this.updateUI();
  }

  private checkCaptures(row: number, col: number) {
    const opponent = this.gameState.currentPlayer === 'black' ? 'white' : 'black';
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;

      if (this.isValidPosition(newRow, newCol) && 
          this.gameState.board[newRow][newCol] === opponent) {
        
        const group = this.getGroup(newRow, newCol);
        if (this.hasNoLiberties(group)) {
          this.captureGroup(group);
        }
      }
    }
  }

  private getGroup(row: number, col: number): [number, number][] {
    const color = this.gameState.board[row][col];
    if (!color) return [];

    const visited = new Set<string>();
    const group: [number, number][] = [];
    const stack: [number, number][] = [[row, col]];

    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      const key = `${r},${c}`;

      if (visited.has(key)) continue;
      visited.add(key);
      group.push([r, c]);

      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        const newRow = r + dr;
        const newCol = c + dc;

        if (this.isValidPosition(newRow, newCol) && 
            this.gameState.board[newRow][newCol] === color &&
            !visited.has(`${newRow},${newCol}`)) {
          stack.push([newRow, newCol]);
        }
      }
    }

    return group;
  }

  private hasNoLiberties(group: [number, number][]): boolean {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [row, col] of group) {
      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;

        if (this.isValidPosition(newRow, newCol) && 
            this.gameState.board[newRow][newCol] === null) {
          return false;
        }
      }
    }
    return true;
  }

  private captureGroup(group: [number, number][]) {
    const capturedColor = this.gameState.board[group[0][0]][group[0][1]] as 'black' | 'white';
    
    for (const [row, col] of group) {
      this.capturedStones.push({ row, col, color: capturedColor, opacity: 1 });
      this.gameState.board[row][col] = null;
    }

    if (capturedColor === 'black') {
      this.gameState.whiteScore += group.length;
    } else {
      this.gameState.blackScore += group.length;
    }

    this.playCaptureSound();
    this.updateUI();
  }

  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.BOARD_SIZE && col >= 0 && col < this.BOARD_SIZE;
  }

  private switchPlayer() {
    this.gameState.currentPlayer = this.gameState.currentPlayer === 'black' ? 'white' : 'black';
  }

  private pass() {
    this.switchPlayer();
    this.updateUI();
  }

  private newGame() {
    this.gameState = {
      board: Array(this.BOARD_SIZE).fill(null).map(() => Array(this.BOARD_SIZE).fill(null)),
      currentPlayer: 'black',
      blackScore: 0,
      whiteScore: 0
    };
    this.lastMove = null;
    this.capturedStones = [];
    this.updateUI();
  }

  // === Rendering & Animation ===

  private animate() {
    this.draw();
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBoard();
    this.drawStones();
    this.drawCapturedStones();
    this.drawHoverPreview();
  }

  private drawBoard() {
    // Wooden look (gradient fallback for no texture)
    const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, "#d7b37d");
    gradient.addColorStop(1, "#c49a6c");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid lines
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

    // Star points
    const starPoints = [3, 9, 15];
    this.ctx.fillStyle = "#3a1f0d";
    for (const row of starPoints) {
      for (const col of starPoints) {
        const x = (col + 0.5) * this.CELL_SIZE;
        const y = (row + 0.5) * this.CELL_SIZE;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }
  }

  private drawStones() {
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        const stone = this.gameState.board[row][col];
        if (stone) {
          const x = (col + 0.5) * this.CELL_SIZE;
          const y = (row + 0.5) * this.CELL_SIZE;

          // Shadow for realism
          this.ctx.shadowColor = "rgba(0,0,0,0.4)";
          this.ctx.shadowBlur = 4;
          this.ctx.shadowOffsetX = 2;
          this.ctx.shadowOffsetY = 2;

          // Radial gradient for 3D stone look
          const gradient = this.ctx.createRadialGradient(x - 4, y - 4, 4, x, y, this.STONE_RADIUS);
          if (stone === "black") {
            gradient.addColorStop(0, "#555");
            gradient.addColorStop(1, "#000");
          } else {
            gradient.addColorStop(0, "#fff");
            gradient.addColorStop(1, "#ddd");
          }

          this.ctx.fillStyle = gradient;
          this.ctx.beginPath();
          this.ctx.arc(x, y, this.STONE_RADIUS, 0, 2 * Math.PI);
          this.ctx.fill();

          // Reset shadow
          this.ctx.shadowBlur = 0;
          this.ctx.shadowOffsetX = 0;
          this.ctx.shadowOffsetY = 0;

          // Highlight last move
          if (this.lastMove && this.lastMove[0] === row && this.lastMove[1] === col) {
            this.ctx.strokeStyle = "red";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.STONE_RADIUS + 3, 0, 2 * Math.PI);
            this.ctx.stroke();
          }
        }
      }
    }
  }

  private drawCapturedStones() {
    this.capturedStones = this.capturedStones.filter(stone => stone.opacity > 0);

    for (const stone of this.capturedStones) {
      const x = (stone.col + 0.5) * this.CELL_SIZE;
      const y = (stone.row + 0.5) * this.CELL_SIZE;

      this.ctx.save();
      this.ctx.globalAlpha = stone.opacity;
      this.ctx.translate(x, y);
      this.ctx.scale(stone.opacity, stone.opacity); // shrink
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.STONE_RADIUS, 0, 2 * Math.PI);
      this.ctx.fillStyle = stone.color === "black" ? "#000" : "#fff";
      this.ctx.fill();
      this.ctx.restore();

      stone.opacity -= 0.02;
    }
  }

  private drawHoverPreview() {
    if (!this.hoverCell) return;
    const [row, col] = this.hoverCell;
    if (this.isValidPosition(row, col) && this.gameState.board[row][col] === null) {
      const x = (col + 0.5) * this.CELL_SIZE;
      const y = (row + 0.5) * this.CELL_SIZE;
      this.ctx.globalAlpha = 0.5;
      this.ctx.beginPath();
      this.ctx.arc(x, y, this.STONE_RADIUS, 0, 2 * Math.PI);
      this.ctx.fillStyle = this.gameState.currentPlayer === "black" ? "#2C2C2C" : "#F5F5F5";
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    }
  }

  private updateUI() {
    const currentPlayerEl = document.getElementById('currentPlayer');
    const blackScoreEl = document.getElementById('blackScore');
    const whiteScoreEl = document.getElementById('whiteScore');

    if (currentPlayerEl) {
      currentPlayerEl.textContent = this.gameState.currentPlayer === 'black' ? 'Black' : 'White';
      currentPlayerEl.className = `current-player ${this.gameState.currentPlayer}`;
    }
    if (blackScoreEl) blackScoreEl.textContent = this.gameState.blackScore.toString();
    if (whiteScoreEl) whiteScoreEl.textContent = this.gameState.whiteScore.toString();
  }

  // === Sound Effects ===

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

// === Start Game ===
document.addEventListener('DOMContentLoaded', () => {
  new SimpleGoGame();
});
