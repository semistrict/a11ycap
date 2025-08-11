import { randomUUID } from "node:crypto";
import type WebSocket from "ws";
import { log } from "./logging.js";

export interface BrowserConnection {
  id: string;
  sessionId?: string;  // Persistent session ID from sessionStorage
  ws: WebSocket;
  url?: string;
  title?: string;
  userAgent?: string;
  connected: boolean;
  lastSeen: Date;
  isReconnect?: boolean;  // Whether this is a reconnection of an existing session
}

export interface BrowserCommand {
  id: string;
  type:
    | "take_snapshot"
    | "execute_js"
    | "click_element"
    | "find_element"
    | "type_text"
    | "press_key"
    | "press_key_global"
    | "hover_element"
    | "select_option"
    | "wait_for";
  payload: any;
}

export interface BrowserResponse {
  commandId: string;
  success: boolean;
  data?: any;
  error?: string;
}

class BrowserConnectionManager {
  private connections = new Map<string, BrowserConnection>();
  private sessionConnections = new Map<string, string>(); // sessionId -> connectionId mapping
  private pendingCommands = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  addConnection(ws: WebSocket, metadata?: any): string {
    const id = randomUUID();
    const sessionId = metadata?.sessionId;
    
    // Check if this session already has a connection
    let existingConnectionId: string | undefined;
    if (sessionId) {
      existingConnectionId = this.sessionConnections.get(sessionId);
      if (existingConnectionId) {
        const existingConnection = this.connections.get(existingConnectionId);
        if (existingConnection) {
          log.debug(`Session ${sessionId} reconnecting, replacing old connection ${existingConnectionId}`);
          // Close the old WebSocket if still open
          if (existingConnection.ws.readyState === existingConnection.ws.OPEN) {
            existingConnection.ws.close();
          }
          // Remove old connection
          this.connections.delete(existingConnectionId);
        }
      }
    }
    
    const connection: BrowserConnection = {
      id,
      sessionId,
      ws,
      url: metadata?.url,
      userAgent: metadata?.userAgent,
      connected: true,
      lastSeen: new Date(),
      isReconnect: metadata?.isReconnect || false,
    };

    this.connections.set(id, connection);
    
    // Update session mapping
    if (sessionId) {
      this.sessionConnections.set(sessionId, id);
    }

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        // Handle page_info messages to update metadata
        if (message.type === 'page_info' && message.payload) {
          this.updateConnectionInfo(id, message.payload);
        } else if (message.type === 'heartbeat') {
          // Just update last seen, no action needed
          const conn = this.connections.get(id);
          if (conn) conn.lastSeen = new Date();
        } else {
          this.handleBrowserMessage(id, message);
        }
      } catch (error) {
        log.error("Error parsing browser message:", error);
      }
    });

    ws.on("close", () => {
      this.removeConnection(id);
    });

    ws.on("error", (error) => {
      log.error(`Browser connection ${id} error:`, error);
      this.removeConnection(id);
    });

    const logMessage = connection.isReconnect
      ? `Session ${sessionId} reconnected: ${id} from ${connection.url || "unknown"}`
      : `New browser connected: ${id} (session: ${sessionId || "none"}) from ${connection.url || "unknown"}`;
    log.info(logMessage);
    return id;
  }

  removeConnection(id: string) {
    const connection = this.connections.get(id);
    if (connection) {
      connection.connected = false;
      this.connections.delete(id);
      // Clean up session mapping if it exists
      if (connection.sessionId) {
        const currentMappedId = this.sessionConnections.get(connection.sessionId);
        // Only remove mapping if it points to this connection (not a newer one)
        if (currentMappedId === id) {
          this.sessionConnections.delete(connection.sessionId);
        }
      }
      log.debug(`Browser disconnected: ${id} (session: ${connection.sessionId || "none"})`);
    }
  }

  updateConnectionInfo(
    id: string,
    info: { url?: string; title?: string; userAgent?: string; sessionId?: string; isReconnect?: boolean },
  ) {
    const connection = this.connections.get(id);
    if (connection) {
      if (info.url) connection.url = info.url;
      if (info.title) connection.title = info.title;
      if (info.userAgent) connection.userAgent = info.userAgent;
      if (info.sessionId && !connection.sessionId) {
        connection.sessionId = info.sessionId;
        this.sessionConnections.set(info.sessionId, id);
      }
      if (info.isReconnect !== undefined) connection.isReconnect = info.isReconnect;
      connection.lastSeen = new Date();
    }
  }


  private handleBrowserMessage(connectionId: string, message: BrowserResponse) {
    const pending = this.pendingCommands.get(message.commandId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(message.commandId);

      if (message.success) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.error || "Command failed"));
      }
    }

    // Update last seen
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastSeen = new Date();
    }
  }

  async sendCommand(
    connectionId: string,
    command: Omit<BrowserCommand, "id">,
    timeoutMs = 10000,
  ): Promise<any> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.connected) {
      throw new Error(
        `Browser connection ${connectionId} not found or disconnected`,
      );
    }

    const fullCommand: BrowserCommand = {
      ...command,
      id: randomUUID(),
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(fullCommand.id);
        reject(
          new Error(
            `Command ${fullCommand.type} timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      this.pendingCommands.set(fullCommand.id, { resolve, reject, timeout });

      try {
        connection.ws.send(JSON.stringify(fullCommand));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingCommands.delete(fullCommand.id);
        reject(error);
      }
    });
  }

  getConnections(): BrowserConnection[] {
    return Array.from(this.connections.values()).filter((c) => c.connected);
  }

  getConnection(id: string): BrowserConnection | undefined {
    return this.connections.get(id);
  }

  getConnectionBySessionId(sessionId: string): BrowserConnection | undefined {
    const connectionId = this.sessionConnections.get(sessionId);
    if (connectionId) {
      return this.connections.get(connectionId);
    }
    return undefined;
  }

  getFirstBrowserId(): string | undefined {
    const connections = Array.from(this.connections.values()).filter((c) => c.connected);
    return connections.length > 0 ? connections[0].id : undefined;
  }



  cleanup() {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [id, connection] of this.connections.entries()) {
      if (now.getTime() - connection.lastSeen.getTime() > staleThreshold) {
        log.debug(`Cleaning up stale connection: ${id}`);
        this.removeConnection(id);
      }
    }
  }
}

export const browserConnectionManager = new BrowserConnectionManager();

// Clean up stale connections every minute
setInterval(() => {
  browserConnectionManager.cleanup();
}, 60000);
