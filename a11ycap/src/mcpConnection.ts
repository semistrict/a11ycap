/**
 * MCP connection for browser-server communication
 * Supports multiple transport types (WebSocket, Chrome Extension, etc.)
 */

import { toolHandlers } from './tools/index.js';
import type {
  BrowserCommand,
  CommandResponseMessage,
  HeartbeatMessage,
  PageInfoMessage,
} from './types/messages.js';
import {
  type Transport,
  TransportFactory,
  type TransportConfig,
  TransportState,
} from './transport/index.js';

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
 * MCP connection for server communication
 * Supports multiple transport types via Transport abstraction
 */
export class MCPConnection {
  private transport: Transport;
  readonly sessionId: string;
  private heartbeatInterval?: number;

  constructor(config: TransportConfig) {
    this.sessionId = getTabSessionId();
    this.transport = TransportFactory.create(config);
    this.setupTransport();
  }

  private setupTransport(): void {
    if (typeof window === 'undefined') return;

    this.transport.setHandlers({
      onOpen: () => {
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
      },

      onClose: () => {
        // Transport handles reconnection internally
      },

      onError: (error) => {
        // Silently handle errors - transport handles reconnection
        console.debug('MCP transport error:', error);
      },

      onMessage: (message) => {
        this.handleMessage(message);
      },
    });
  }

  send(
    message: PageInfoMessage | HeartbeatMessage | CommandResponseMessage
  ): void {
    if (this.transport.getState() === TransportState.OPEN) {
      this.transport.send(message);
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

  private async handleMessage(rawMessage: BrowserCommand): Promise<void> {
    try {

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
    this.heartbeatInterval = window.setInterval(() => {
      if (this.transport.getState() === TransportState.OPEN) {
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

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    this.transport.close();
  }
}

// Legacy export for backward compatibility
export const MCPWebSocketClient = MCPConnection;

/**
 * Initialize MCP connection with WebSocket URL (backward compatibility)
 */
export function initializeMCPConnection(
  wsUrl: string
): MCPConnection | null {
  if (typeof window === 'undefined') return null;

  const client = new MCPConnection({ wsUrl });
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
