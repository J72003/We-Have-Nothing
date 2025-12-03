import { BoardTheme } from './types';

export interface ThemeConfig {
  name: string;
  boardGradient: { start: string; end: string };
  gridColor: string;
  blackStone: string;
  whiteStone: string;
  backgroundColor: string;
  territoryAlpha: number;
}

export const THEMES: Record<BoardTheme, ThemeConfig> = {
  classic: {
    name: 'Classic Wood',
    boardGradient: { start: '#d7b37d', end: '#c49a6c' },
    gridColor: 'rgba(70,40,10,0.9)',
    blackStone: '#000',
    whiteStone: '#fff',
    backgroundColor: 'radial-gradient(circle at center, #e8e3d9, #b6a78a)',
    territoryAlpha: 0.25
  },
  modern: {
    name: 'Modern Blue',
    boardGradient: { start: '#4a90e2', end: '#357abd' },
    gridColor: 'rgba(255,255,255,0.8)',
    blackStone: '#1a1a1a',
    whiteStone: '#f8f8f8',
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    territoryAlpha: 0.3
  },
  dark: {
    name: 'Dark Mode',
    boardGradient: { start: '#2c3e50', end: '#1a252f' },
    gridColor: 'rgba(236,240,241,0.6)',
    blackStone: '#0a0a0a',
    whiteStone: '#ecf0f1',
    backgroundColor: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
    territoryAlpha: 0.35
  },
  bamboo: {
    name: 'Bamboo Forest',
    boardGradient: { start: '#8fbc8f', end: '#6b8e6b' },
    gridColor: 'rgba(34,60,34,0.8)',
    blackStone: '#1a1a1a',
    whiteStone: '#fffff0',
    backgroundColor: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
    territoryAlpha: 0.28
  }
};

export class ThemeManager {
  private currentTheme: BoardTheme = 'classic';

  setTheme(theme: BoardTheme) {
    this.currentTheme = theme;
    this.applyTheme();
    localStorage.setItem('go-game-theme', theme);
  }

  getCurrentTheme(): BoardTheme {
    return this.currentTheme;
  }

  getThemeConfig(): ThemeConfig {
    return THEMES[this.currentTheme];
  }

  loadSavedTheme() {
    const saved = localStorage.getItem('go-game-theme') as BoardTheme;
    if (saved && THEMES[saved]) {
      this.currentTheme = saved;
      this.applyTheme();
    }
  }

  private applyTheme() {
    const theme = THEMES[this.currentTheme];
    document.body.style.background = theme.backgroundColor;
  }
}

export const themeManager = new ThemeManager();
