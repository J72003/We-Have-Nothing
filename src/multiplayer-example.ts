import { ChatUI } from './chat-ui';
import { onlineService } from './online';
import { authService } from './auth';

export class MultiplayerGameExample {
  private chatUI: ChatUI | null = null;
  private currentGameRoomId: string | null = null;
  private gameRoomSubscription: any = null;
  private gameMovesSubscription: any = null;

  async startOnlineGame(roomId: string) {
    this.currentGameRoomId = roomId;

    const chatContainer = document.getElementById('chatContainer')!;
    chatContainer.style.display = 'block';

    this.chatUI = new ChatUI('chatContainer', roomId);

    this.subscribeToGameUpdates(roomId);
  }

  private subscribeToGameUpdates(roomId: string) {
    this.gameRoomSubscription = onlineService.subscribeToGameRoom(roomId, (payload) => {
      console.log('Game room updated:', payload);
      if (payload.eventType === 'UPDATE') {
        this.handleGameStateUpdate(payload.new);
      }
    });

    this.gameMovesSubscription = onlineService.subscribeToGameMoves(roomId, (payload) => {
      console.log('New move:', payload);
      if (payload.eventType === 'INSERT') {
        this.handleOpponentMove(payload.new);
      }
    });
  }

  private handleGameStateUpdate(gameState: any) {
    console.log('Game state updated:', gameState);
  }

  private handleOpponentMove(move: any) {
    console.log('Opponent made a move:', move);
  }

  async makeMove(row: number, col: number) {
    if (!this.currentGameRoomId) return;

    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    try {
      await onlineService.makeMove(
        this.currentGameRoomId,
        row,
        col,
        false,
        1
      );
    } catch (error) {
      console.error('Error making move:', error);
    }
  }

  async endGame(winnerId: string | null) {
    if (!this.currentGameRoomId) return;

    try {
      await onlineService.finishGame(this.currentGameRoomId, winnerId);
      this.cleanup();
    } catch (error) {
      console.error('Error ending game:', error);
    }
  }

  cleanup() {
    if (this.chatUI) {
      this.chatUI.destroy();
      this.chatUI = null;
    }

    if (this.gameRoomSubscription) {
      this.gameRoomSubscription.unsubscribe();
    }

    if (this.gameMovesSubscription) {
      this.gameMovesSubscription.unsubscribe();
    }

    const chatContainer = document.getElementById('chatContainer')!;
    chatContainer.style.display = 'none';
    chatContainer.innerHTML = '';

    this.currentGameRoomId = null;
  }
}
