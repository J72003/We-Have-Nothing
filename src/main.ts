interface GameState {
  board: (null | 'black' | 'white')[][];
  currentPlayer: 'black' | 'white';
  blackScore: number;
  whiteScore: number;
}

class SimpleGoGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: GameState;
  private readonly BOARD_SIZE = 19;
  private readonly CELL_SIZE = 25;
  private readonly STONE_RADIUS = 10;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    // Set canvas size
    const canvasSize = this.CELL_SIZE * (this.BOARD_SIZE + 1);
    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;
    
    this.gameState = {
      board: Array(this.BOARD_SIZE).fill(null).map(() => Array(this.BOARD_SIZE).fill(null)),
      currentPlayer: 'black',
      blackScore: 0,
      whiteScore: 0
    };

    this.setupEventListeners();
    this.draw();
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

    document.getElementById('newGame')?.addEventListener('click', () => {
      this.newGame();
    });

    document.getElementById('pass')?.addEventListener('click', () => {
      this.pass();
    });
  }

  private placeStone(row: number, col: number) {
    if (row < 0 || row >= this.BOARD_SIZE || col < 0 || col >= this.BOARD_SIZE) {
      return;
    }

    if (this.gameState.board[row][col] !== null) {
      return;
    }

    this.gameState.board[row][col] = this.gameState.currentPlayer;
    this.checkCaptures(row, col);
    this.switchPlayer();
    this.draw();
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
    const capturedColor = this.gameState.board[group[0][0]][group[0][1]];
    
    for (const [row, col] of group) {
      this.gameState.board[row][col] = null;
    }

    if (capturedColor === 'black') {
      this.gameState.whiteScore += group.length;
    } else {
      this.gameState.blackScore += group.length;
    }
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
    this.draw();
    this.updateUI();
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBoard();
    this.drawStones();
  }

  private drawBoard() {
    // Board background
    this.ctx.fillStyle = '#D4A574';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid lines
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 1;

    for (let i = 0; i < this.BOARD_SIZE; i++) {
      const pos = (i + 0.5) * this.CELL_SIZE;
      
      // Vertical lines
      this.ctx.beginPath();
      this.ctx.moveTo(pos, this.CELL_SIZE / 2);
      this.ctx.lineTo(pos, this.canvas.height - this.CELL_SIZE / 2);
      this.ctx.stroke();

      // Horizontal lines
      this.ctx.beginPath();
      this.ctx.moveTo(this.CELL_SIZE / 2, pos);
      this.ctx.lineTo(this.canvas.width - this.CELL_SIZE / 2, pos);
      this.ctx.stroke();
    }

    // Star points
    const starPoints = [3, 9, 15];
    this.ctx.fillStyle = '#8B4513';
    
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

          this.ctx.beginPath();
          this.ctx.arc(x, y, this.STONE_RADIUS, 0, 2 * Math.PI);
          
          if (stone === 'black') {
            this.ctx.fillStyle = '#2C2C2C';
          } else {
            this.ctx.fillStyle = '#F5F5F5';
          }
          
          this.ctx.fill();
          this.ctx.strokeStyle = '#666';
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      }
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

    if (blackScoreEl) {
      blackScoreEl.textContent = this.gameState.blackScore.toString();
    }

    if (whiteScoreEl) {
      whiteScoreEl.textContent = this.gameState.whiteScore.toString();
    }
  }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new SimpleGoGame();
});