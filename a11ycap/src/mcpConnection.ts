/**
 * MCP WebSocket connection for browser-server communication
 */

import { toolHandlers } from './tools/index.js';
import type {
  BrowserCommand,
  CommandResponseMessage,
  HeartbeatMessage,
  PageInfoMessage,
} from './types/messages.js';

// All tools are now handled by the modular tool system

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a persistent session ID for this tab
 */
function getTabSessionId(): string {
  const SESSION_KEY = 'a11ycap_session_id';
  let sessionId: string | null = null;

  try {
    sessionId = sessionStorage.getItem(SESSION_KEY);
  } catch {
    // sessionStorage may not be available (private mode, etc.)
  }

  if (!sessionId) {
    sessionId = generateUUID();
    try {
      sessionStorage.setItem(SESSION_KEY, sessionId);
      sessionStorage.setItem('a11ycap_session_created', Date.now().toString());
    } catch {
      // Ignore storage errors (e.g., private mode or quota)
    }
  }

  return sessionId;
}

/**
 * WebSocket connection for MCP server communication
 */
export class MCPWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = Number.POSITIVE_INFINITY;
  private readonly reconnectInterval = 2000; // 2 seconds
  private readonly wsUrl: string;
  readonly sessionId: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
    this.sessionId = getTabSessionId();
  }

  connect(): void {
    if (typeof window === 'undefined') return;

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;

        // Send page info to server with session ID at top level
        let isReconnect = false;
        try {
          isReconnect =
            sessionStorage.getItem('a11ycap_has_connected') === 'true';
        } catch {
          // Ignore sessionStorage errors
        }

        const message: PageInfoMessage = {
          sessionId: this.sessionId,
          type: 'page_info',
          payload: {
            url: window.location.href,
            title: document.title,
            userAgent: navigator.userAgent,
            isReconnect,
          },
        };
        this.send(message);

        // Mark that we've connected at least once
        try {
          sessionStorage.setItem('a11ycap_has_connected', 'true');
        } catch {
          // Ignore storage errors
        }
      };

      this.ws.onclose = () => {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.reconnectInterval);
        }
      };

      this.ws.onerror = () => {
        // Silently handle errors - onclose will handle reconnection
      };

      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (_error) {
      // Silently handle WebSocket creation errors
    }
  }

  send(
    message: PageInfoMessage | HeartbeatMessage | CommandResponseMessage
  ): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendResponse(
    commandId: string,
    success: boolean,
    data?: any,
    error?: string
  ): void {
    const response: CommandResponseMessage = {
      sessionId: this.sessionId,
      type: 'command_response',
      commandId,
      success,
      ...(data !== undefined && { data }),
      ...(error && { error }),
    };
    this.send(response);
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const rawMessage = JSON.parse(event.data) as BrowserCommand;

      // Server sends commands with type 'command', actual command type in commandType
      if (rawMessage.type === 'command') {
        // Check if we have a modular tool handler for this command type
        const toolHandler = toolHandlers[rawMessage.commandType];
        if (toolHandler) {
          try {
            // Create message in expected format for the tool handler
            const toolMessage = {
              id: rawMessage.id,
              type: rawMessage.commandType,
              payload: rawMessage.payload,
            };
            const message = toolHandler.messageSchema.parse(toolMessage);
            const result = await toolHandler.execute(message);
            this.sendResponse(rawMessage.id, true, result);
          } catch (error) {
            this.sendResponse(
              rawMessage.id,
              false,
              undefined,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
          return;
        }
        console.warn(`Unknown command type: ${rawMessage.commandType}`);
        this.sendResponse(
          rawMessage.id,
          false,
          undefined,
          `Unknown command type: ${rawMessage.commandType}`
        );
      } else {
        console.warn(`Unknown message type: ${rawMessage.type}`);
        // For unknown message types, try to extract an id and send error response
        if ('id' in rawMessage && typeof rawMessage.id === 'string') {
          this.sendResponse(
            rawMessage.id,
            false,
            undefined,
            `Unknown message type: ${rawMessage.type}`
          );
        }
      }
    } catch (error) {
      console.error('Error handling MCP command:', error);
    }
  }

  startHeartbeat(): void {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat: HeartbeatMessage = {
          sessionId: this.sessionId,
          type: 'heartbeat',
          payload: {
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
          },
        };
        this.send(heartbeat);
      }
    }, 30000);
  }
}

/**
 * Initialize MCP WebSocket connection if wsUrl is provided
 */
export function initializeMCPConnection(
  wsUrl: string
): MCPWebSocketClient | null {
  if (typeof window === 'undefined') return null;

  const client = new MCPWebSocketClient(wsUrl);
  client.connect();
  client.startHeartbeat();

  // Log a single consolidated message
  const sessionId = client.sessionId;
  let isReconnect = false;
  let sessionAge: string | null = null;

  try {
    isReconnect = sessionStorage.getItem('a11ycap_has_connected') === 'true';
    sessionAge = sessionStorage.getItem('a11ycap_session_created');
  } catch {
    // Ignore sessionStorage errors
  }

  const age = sessionAge
    ? Math.round((Date.now() - Number.parseInt(sessionAge, 10)) / 1000)
    : 0;

  console.log(
    `🐱 a11ycap ${isReconnect ? `reconnected (session: ${sessionId.slice(0, 8)}..., age: ${age}s)` : 'loaded'} - Try: window.A11yCap.snapshotForAI(document.body)`
  );

  return client;
}
