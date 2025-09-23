interface GameState {
  board: (null | 'black' | 'white')[][];
  currentPlayer: 'black' | 'white';
  capturedStones: { black: number; white: number };
  territoryScore: { black: number; white: number };
  totalScore: { black: number; white: number };
  gamePhase: 'playing' | 'demo' | 'finished';
  moveCount: number;
}

interface CapturedStone {
  row: number;
  col: number;
  color: 'black' | 'white';
  opacity: number;
}

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
  private territory: (null | 'black' | 'white' | 'neutral')[][] = [];

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    const canvasSize = this.CELL_SIZE * (this.BOARD_SIZE + 1);
    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;
    
    this.gameState = {
      board: Array(this.BOARD_SIZE).fill(null).map(() => Array(this.BOARD_SIZE).fill(null)),
      currentPlayer: 'black',
      capturedStones: { black: 0, white: 0 },
      territoryScore: { black: 0, white: 0 },
      totalScore: { black: 0, white: 0 },
      gamePhase: 'demo',
      moveCount: 0
    };

    this.territory = Array(this.BOARD_SIZE).fill(null).map(() => Array(this.BOARD_SIZE).fill(null));
    this.audioCtx = new AudioContext();

    this.setupEventListeners();
    this.animate();
    this.updateUI();
    this.startDemo();
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

    document.getElementById('startDemo')?.addEventListener('click', () => {
      this.startDemo();
    });

    document.getElementById('stopDemo')?.addEventListener('click', () => {
      this.stopDemo();
    });
  }

  private startDemo() {
    this.gameState.gamePhase = 'demo';
    this.demoInterval = window.setInterval(() => {
      this.makeDemoMove();
    }, 800);
    this.updateUI();
  }

  private stopDemo() {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.gameState.gamePhase = 'playing';
    this.updateUI();
  }

  private makeDemoMove() {
    const emptyPositions: [number, number][] = [];
    
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        if (this.gameState.board[row][col] === null) {
          emptyPositions.push([row, col]);
        }
      }
    }

    if (emptyPositions.length === 0) {
      this.stopDemo();
      return;
    }

    // Prefer moves near existing stones for more realistic gameplay
    const strategicPositions = emptyPositions.filter(([row, col]) => {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      return directions.some(([dr, dc]) => {
        const newRow = row + dr;
        const newCol = col + dc;
        return this.isValidPosition(newRow, newCol) && 
               this.gameState.board[newRow][newCol] !== null;
      });
    });

    const positions = strategicPositions.length > 0 ? strategicPositions : emptyPositions;
    const [row, col] = positions[Math.floor(Math.random() * positions.length)];
    
    this.placeStone(row, col);
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
    this.gameState.moveCount++;
    this.calculateTerritoryScore();
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
      this.gameState.capturedStones.white += group.length;
    } else {
      this.gameState.capturedStones.black += group.length;
    }

    this.playCaptureSound();
    this.calculateTerritoryScore();
    this.updateUI();
  }

  private calculateTerritoryScore() {
    // Reset territory
    this.territory = Array(this.BOARD_SIZE).fill(null).map(() => Array(this.BOARD_SIZE).fill(null));
    
    const visited = new Set<string>();
    let blackTerritory = 0;
    let whiteTerritory = 0;

    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        if (this.gameState.board[row][col] === null && !visited.has(`${row},${col}`)) {
          const territory = this.getTerritory(row, col, visited);
          const owner = this.getTerritoryOwner(territory);
          
          for (const [r, c] of territory) {
            this.territory[r][c] = owner;
          }

          if (owner === 'black') {
            blackTerritory += territory.length;
          } else if (owner === 'white') {
            whiteTerritory += territory.length;
          }
        }
      }
    }

    this.gameState.territoryScore = { black: blackTerritory, white: whiteTerritory };
    this.gameState.totalScore = {
      black: this.gameState.capturedStones.black + this.gameState.territoryScore.black,
      white: this.gameState.capturedStones.white + this.gameState.territoryScore.white
    };
  }

  private getTerritory(startRow: number, startCol: number, visited: Set<string>): [number, number][] {
    const territory: [number, number][] = [];
    const stack: [number, number][] = [[startRow, startCol]];

    while (stack.length > 0) {
      const [row, col] = stack.pop()!;
      const key = `${row},${col}`;

      if (visited.has(key) || this.gameState.board[row][col] !== null) continue;
      
      visited.add(key);
      territory.push([row, col]);

      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (this.isValidPosition(newRow, newCol)) {
          stack.push([newRow, newCol]);
        }
      }
    }

    return territory;
  }

  private getTerritoryOwner(territory: [number, number][]): 'black' | 'white' | 'neutral' {
    const surroundingStones = new Set<'black' | 'white'>();
    
    for (const [row, col] of territory) {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (this.isValidPosition(newRow, newCol)) {
          const stone = this.gameState.board[newRow][newCol];
          if (stone) {
            surroundingStones.add(stone);
          }
        }
      }
    }

    if (surroundingStones.size === 1) {
      return Array.from(surroundingStones)[0];
    }
    return 'neutral';
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
      capturedStones: { black: 0, white: 0 },
      territoryScore: { black: 0, white: 0 },
      totalScore: { black: 0, white: 0 },
      gamePhase: 'playing',
      moveCount: 0
    };
    this.lastMove = null;
    this.capturedStones = [];
    this.territory = Array(this.BOARD_SIZE).fill(null).map(() => Array(this.BOARD_SIZE).fill(null));
    this.stopDemo();
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
    this.drawTerritory();
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

  private drawTerritory() {
    if (this.gameState.gamePhase === 'demo') {
      for (let row = 0; row < this.BOARD_SIZE; row++) {
        for (let col = 0; col < this.BOARD_SIZE; col++) {
          const owner = this.territory[row][col];
          if (owner && owner !== 'neutral' && this.gameState.board[row][col] === null) {
            const x = (col + 0.5) * this.CELL_SIZE;
            const y = (row + 0.5) * this.CELL_SIZE;
            
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillStyle = owner === 'black' ? '#2C2C2C' : '#F5F5F5';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.restore();
          }
        }
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
    if (!this.hoverCell || this.gameState.gamePhase === 'demo') return;
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
    const blackCapturedEl = document.getElementById('blackCaptured');
    const whiteCapturedEl = document.getElementById('whiteCaptured');
    const blackTerritoryEl = document.getElementById('blackTerritory');
    const whiteTerritoryEl = document.getElementById('whiteTerritory');
    const blackTotalEl = document.getElementById('blackTotal');
    const whiteTotalEl = document.getElementById('whiteTotal');
    const gameStatusEl = document.getElementById('gameStatus');
    const moveCountEl = document.getElementById('moveCount');

    if (currentPlayerEl) {
      currentPlayerEl.textContent = this.gameState.currentPlayer === 'black' ? 'Black' : 'White';
      currentPlayerEl.className = `current-player ${this.gameState.currentPlayer}`;
    }
    
    if (blackCapturedEl) blackCapturedEl.textContent = this.gameState.capturedStones.black.toString();
    if (whiteCapturedEl) whiteCapturedEl.textContent = this.gameState.capturedStones.white.toString();
    if (blackTerritoryEl) blackTerritoryEl.textContent = this.gameState.territoryScore.black.toString();
    if (whiteTerritoryEl) whiteTerritoryEl.textContent = this.gameState.territoryScore.white.toString();
    if (blackTotalEl) blackTotalEl.textContent = this.gameState.totalScore.black.toString();
    if (whiteTotalEl) whiteTotalEl.textContent = this.gameState.totalScore.white.toString();
    
    if (gameStatusEl) {
      if (this.gameState.gamePhase === 'demo') {
        gameStatusEl.textContent = 'Demo Mode - Auto Playing';
        gameStatusEl.className = 'game-status demo';
      } else {
        gameStatusEl.textContent = 'Manual Play Mode';
        gameStatusEl.className = 'game-status playing';
      }
    }
    
    if (moveCountEl) moveCountEl.textContent = this.gameState.moveCount.toString();
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
  new FutureGoGameDemo();
});
