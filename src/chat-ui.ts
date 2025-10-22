import { onlineService } from './online';
import { supabase, ChatMessage } from './supabase';
import { authService } from './auth';

export class ChatUI {
  private container: HTMLElement;
  private roomId: string;
  private subscription: any;
  private userProfiles: Map<string, any> = new Map();

  constructor(containerId: string, roomId: string) {
    this.container = document.getElementById(containerId)!;
    this.roomId = roomId;
    this.render();
    this.loadMessages();
    this.subscribeToMessages();
  }

  private render() {
    this.container.innerHTML = `
      <div class="chat-container">
        <div class="chat-header">
          <h3>Game Chat</h3>
        </div>
        <div id="chatMessages" class="chat-messages"></div>
        <div class="chat-input-container">
          <input
            type="text"
            id="chatInput"
            class="chat-input"
            placeholder="Type a message..."
            maxlength="500"
          />
          <button id="sendChatBtn" class="chat-send-btn">Send</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners() {
    const input = document.getElementById('chatInput') as HTMLInputElement;
    const sendBtn = document.getElementById('sendChatBtn')!;

    sendBtn.addEventListener('click', () => this.sendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  private async loadMessages() {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, profiles:sender_id(username, display_name)')
        .eq('game_room_id', this.roomId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const messagesContainer = document.getElementById('chatMessages')!;
      messagesContainer.innerHTML = '';

      data?.forEach((msg: any) => {
        this.appendMessage(msg);
      });

      this.scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  private subscribeToMessages() {
    this.subscription = onlineService.subscribeToChat(this.roomId, (payload) => {
      if (payload.eventType === 'INSERT') {
        this.loadSingleMessage(payload.new.id);
      }
    });
  }

  private async loadSingleMessage(messageId: string) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, profiles:sender_id(username, display_name)')
        .eq('id', messageId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        this.appendMessage(data);
        this.scrollToBottom();
      }
    } catch (error) {
      console.error('Error loading message:', error);
    }
  }

  private appendMessage(message: any) {
    const messagesContainer = document.getElementById('chatMessages')!;
    const currentUser = authService.getCurrentUser();
    const isOwnMessage = currentUser && message.sender_id === currentUser.id;

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`;

    const username = message.profiles?.display_name || message.profiles?.username || 'Unknown';
    const timestamp = new Date(message.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    messageEl.innerHTML = `
      <div class="chat-message-header">
        <span class="chat-username">${username}</span>
        <span class="chat-timestamp">${timestamp}</span>
      </div>
      <div class="chat-message-text">${this.escapeHtml(message.message)}</div>
    `;

    messagesContainer.appendChild(messageEl);
  }

  private async sendMessage() {
    const input = document.getElementById('chatInput') as HTMLInputElement;
    const message = input.value.trim();

    if (!message) return;

    try {
      await onlineService.sendChatMessage(this.roomId, message);
      input.value = '';
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  }

  private scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages')!;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
