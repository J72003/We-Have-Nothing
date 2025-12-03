export interface GameState {
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
  lastBoardState: string | null;
  koPoint: { row: number; col: number } | null;
  lastMove: { row: number; col: number } | null;
  moveHistory: MoveRecord[];
  timeControl?: { black: number; white: number };
  showTerritoryPreview: boolean;
}

export interface MoveRecord {
  row: number;
  col: number;
  player: "black" | "white";
  timestamp: number;
  boardState: string;
  capturedStones: { black: number; white: number };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export type GameMode = "PVP" | "PVE" | "AIAI";
export type BoardTheme = "classic" | "modern" | "dark" | "bamboo";
