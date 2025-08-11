/**
 * MCP WebSocket connection for browser-server communication
 */

import { toolHandlers } from './tools/index.js';

// All tools are now handled by the modular tool system

/**
 * WebSocket connection for MCP server communication
 */
export class MCPWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = Number.POSITIVE_INFINITY;
  private readonly reconnectInterval = 2000; // 2 seconds
  private readonly wsUrl: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  connect(): void {
    if (typeof window === 'undefined') return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('🐱 Connected to a11ycap MCP server');
      this.reconnectAttempts = 0;

      // Send page info to server
      this.send({
        type: 'page_info',
        payload: {
          url: window.location.href,
          title: document.title,
          userAgent: navigator.userAgent,
        },
      });
    };

    this.ws.onclose = () => {
      console.log('🐱 Disconnected from MCP server');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(
          `🐱 Attempting to reconnect... (attempt ${this.reconnectAttempts})`
        );
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    };

    this.ws.onerror = () => {
      console.warn('🐱 WebSocket error - will retry connection');
    };

    this.ws.onmessage = this.handleMessage.bind(this);
  }

  private send(message: Record<string, unknown>): void {
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
    this.send({
      commandId,
      success,
      ...(data !== undefined && { data }),
      ...(error && { error }),
    });
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const rawMessage = JSON.parse(event.data);

      // Check if we have a modular tool handler for this message type
      const toolHandler = toolHandlers[rawMessage.type];
      if (toolHandler) {
        try {
          const message = toolHandler.messageSchema.parse(rawMessage);
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

      // No legacy handlers needed - all tools are modular now
      console.warn(`Unknown message type: ${rawMessage.type}`);
    } catch (error) {
      console.error('Error handling MCP command:', error);
    }
  }

  startHeartbeat(): void {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'heartbeat',
          payload: {
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
          },
        });
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

  console.log('🐱 A11yCap loaded');
  const client = new MCPWebSocketClient(wsUrl);
  client.connect();
  client.startHeartbeat();
  console.log(
    '🐱 a11ycap initialized! Try: window.A11yCap.snapshotForAI(document.body)'
  );
  return client;
}
