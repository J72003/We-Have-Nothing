import { Achievement } from './types';

const ACHIEVEMENTS_STORAGE_KEY = 'go-game-achievements';

export class AchievementSystem {
  private achievements: Map<string, Achievement> = new Map();
  private listeners: ((achievement: Achievement) => void)[] = [];

  constructor() {
    this.initializeAchievements();
    this.loadProgress();
  }

  private initializeAchievements() {
    const achievementsList: Achievement[] = [
      {
        id: 'first-stone',
        title: 'First Stone',
        description: 'Place your first stone',
        icon: '🪨',
        unlocked: false
      },
      {
        id: 'first-capture',
        title: 'First Blood',
        description: 'Capture your first stone',
        icon: '⚔️',
        unlocked: false
      },
      {
        id: 'territory-master',
        title: 'Territory Master',
        description: 'Control 50+ territory points',
        icon: '🏰',
        unlocked: false
      },
      {
        id: 'capture-combo',
        title: 'Combo Master',
        description: 'Capture 10+ stones in one game',
        icon: '💥',
        unlocked: false
      },
      {
        id: 'quick-win',
        title: 'Speed Demon',
        description: 'Win a game in under 50 moves',
        icon: '⚡',
        unlocked: false
      },
      {
        id: 'patience',
        title: 'Patient Player',
        description: 'Complete a game with 200+ moves',
        icon: '🧘',
        unlocked: false
      },
      {
        id: 'corner-master',
        title: 'Corner King',
        description: 'Control all four corners',
        icon: '👑',
        unlocked: false
      },
      {
        id: 'perfect-game',
        title: 'Perfect Victory',
        description: 'Win without losing any stones',
        icon: '🏆',
        unlocked: false
      },
      {
        id: 'comeback',
        title: 'Comeback Kid',
        description: 'Win after being 30 points behind',
        icon: '🎯',
        unlocked: false
      },
      {
        id: 'beginner',
        title: 'Getting Started',
        description: 'Complete your first game',
        icon: '🎓',
        unlocked: false
      },
      {
        id: 'veteran',
        title: 'Veteran Player',
        description: 'Play 10 games',
        icon: '🎖️',
        unlocked: false
      },
      {
        id: 'master',
        title: 'Go Master',
        description: 'Win 25 games',
        icon: '🥇',
        unlocked: false
      }
    ];

    achievementsList.forEach(ach => this.achievements.set(ach.id, ach));
  }

  private loadProgress() {
    const saved = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        Object.keys(data).forEach(id => {
          const achievement = this.achievements.get(id);
          if (achievement && data[id].unlocked) {
            achievement.unlocked = true;
            achievement.unlockedAt = data[id].unlockedAt;
          }
        });
      } catch (e) {
        console.error('Failed to load achievements:', e);
      }
    }
  }

  private saveProgress() {
    const data: any = {};
    this.achievements.forEach((ach, id) => {
      data[id] = {
        unlocked: ach.unlocked,
        unlockedAt: ach.unlockedAt
      };
    });
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(data));
  }

  unlock(achievementId: string) {
    const achievement = this.achievements.get(achievementId);
    if (achievement && !achievement.unlocked) {
      achievement.unlocked = true;
      achievement.unlockedAt = Date.now();
      this.saveProgress();
      this.notifyListeners(achievement);
      this.showNotification(achievement);
    }
  }

  private showNotification(achievement: Achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-icon">${achievement.icon}</div>
      <div class="achievement-details">
        <div class="achievement-title">Achievement Unlocked!</div>
        <div class="achievement-name">${achievement.title}</div>
        <div class="achievement-desc">${achievement.description}</div>
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  onUnlock(callback: (achievement: Achievement) => void) {
    this.listeners.push(callback);
  }

  private notifyListeners(achievement: Achievement) {
    this.listeners.forEach(cb => cb(achievement));
  }

  getAll(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  getUnlocked(): Achievement[] {
    return this.getAll().filter(a => a.unlocked);
  }

  getProgress(): { unlocked: number; total: number; percentage: number } {
    const all = this.getAll();
    const unlocked = all.filter(a => a.unlocked).length;
    return {
      unlocked,
      total: all.length,
      percentage: Math.round((unlocked / all.length) * 100)
    };
  }
}

export const achievementSystem = new AchievementSystem();
