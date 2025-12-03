import { AIDifficulty } from './types';

export class AIEngine {
  private boardSize: number;
  private difficulty: AIDifficulty;

  constructor(boardSize: number, difficulty: AIDifficulty = 'medium') {
    this.boardSize = boardSize;
    this.difficulty = difficulty;
  }

  setDifficulty(difficulty: AIDifficulty) {
    this.difficulty = difficulty;
  }

  evaluateMove(
    row: number,
    col: number,
    board: (null | "black" | "white")[][],
    currentPlayer: "black" | "white"
  ): number {
    let score = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.isValidPosition(nr, nc)) {
        const stone = board[nr][nc];
        if (stone === currentPlayer) {
          score += 2;
        } else if (stone !== null) {
          score += 1;
        }
      }
    }

    const edgeBonus =
      (row === 0 || row === this.boardSize - 1 ||
       col === 0 || col === this.boardSize - 1) ? -3 : 0;
    const centerBonus =
      (Math.abs(row - this.boardSize / 2) < 3 &&
       Math.abs(col - this.boardSize / 2) < 3) ? 5 : 0;

    score += edgeBonus + centerBonus;

    const randomness = this.getRandomnessFactor();
    score += Math.random() * randomness;

    if (this.difficulty === 'hard') {
      score += this.evaluateLibertiesAdvanced(row, col, board, currentPlayer);
      score += this.evaluateTerritoryPotential(row, col, board, currentPlayer);
    }

    return score;
  }

  private getRandomnessFactor(): number {
    switch (this.difficulty) {
      case 'easy':
        return 10;
      case 'medium':
        return 4;
      case 'hard':
        return 1;
      default:
        return 4;
    }
  }

  private evaluateLibertiesAdvanced(
    row: number,
    col: number,
    board: (null | "black" | "white")[][],
    player: "black" | "white"
  ): number {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let liberties = 0;

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.isValidPosition(nr, nc) && board[nr][nc] === null) {
        liberties++;
      }
    }

    return liberties * 1.5;
  }

  private evaluateTerritoryPotential(
    row: number,
    col: number,
    board: (null | "black" | "white")[][],
    player: "black" | "white"
  ): number {
    let score = 0;
    const radius = 3;

    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (this.isValidPosition(nr, nc)) {
          const stone = board[nr][nc];
          if (stone === player) {
            score += 1 / (Math.abs(dr) + Math.abs(dc) + 1);
          }
        }
      }
    }

    return score;
  }

  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize;
  }

  getThinkingTime(): number {
    switch (this.difficulty) {
      case 'easy':
        return 100;
      case 'medium':
        return 300;
      case 'hard':
        return 600;
      default:
        return 300;
    }
  }
}
