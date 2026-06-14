export interface User {
  userNumber: number;
  name: string;
  userId: string;
  email: string;
}

export interface Message {
  sender: number;
  content: string; // E2EE encrypted string
  timestamp: number;
  status: 'read' | 'unread';
}

export interface DecryptedMessage extends Omit<Message, 'content'> {
  content: string; // Decrypted content
  rawEncryptedContent: string; // Displayed alongside for clarity
}

export interface Contact {
  userNumber: number;
  name: string;
  userId: string;
  email: string;
  lastMessage?: DecryptedMessage;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
