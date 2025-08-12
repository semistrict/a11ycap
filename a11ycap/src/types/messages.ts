/**
 * Message type definitions for browser-server WebSocket communication
 */

// Base message types that all messages extend
export interface BaseMessage {
  sessionId: string;
  type: string;
}

// Browser to Server messages

export interface PageInfoMessage extends BaseMessage {
  type: 'page_info';
  payload: {
    url: string;
    title: string;
    userAgent: string;
    isReconnect?: boolean;
  };
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
  payload: {
    url: string;
    title: string;
    timestamp: number;
  };
}

export interface CommandResponseMessage extends BaseMessage {
  type: 'command_response';
  commandId: string;
  success: boolean;
  data?: any;
  error?: string;
}

// Union type for all browser-to-server messages
export type BrowserToServerMessage =
  | PageInfoMessage
  | HeartbeatMessage
  | CommandResponseMessage;

// Server to Browser messages

export interface BrowserCommand extends BaseMessage {
  type: 'command';
  id: string;
  commandType: string;
  payload: any;
}

// Union type for all server-to-browser messages
export type ServerToBrowserMessage = BrowserCommand;
