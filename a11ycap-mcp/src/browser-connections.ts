import { randomUUID } from "node:crypto";
import type WebSocket from "ws";

export interface BrowserConnection {
  id: string;
  ws: WebSocket;
  url?: string;
  title?: string;
  userAgent?: string;
  connected: boolean;
  lastSeen: Date;
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
    const connection: BrowserConnection = {
      id,
      ws,
      url: metadata?.url,
      userAgent: metadata?.userAgent,
      connected: true,
      lastSeen: new Date(),
    };

    this.connections.set(id, connection);

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleBrowserMessage(id, message);
      } catch (error) {
        console.error("Error parsing browser message:", error);
      }
    });

    ws.on("close", () => {
      this.removeConnection(id);
    });

    ws.on("error", (error) => {
      console.error(`Browser connection ${id} error:`, error);
      this.removeConnection(id);
    });

    console.log(`Browser connected: ${id} from ${connection.url || "unknown"}`);
    return id;
  }

  removeConnection(id: string) {
    const connection = this.connections.get(id);
    if (connection) {
      connection.connected = false;
      this.connections.delete(id);
      console.log(`Browser disconnected: ${id}`);
    }
  }

  updateConnectionInfo(
    id: string,
    info: { url?: string; title?: string; userAgent?: string },
  ) {
    const connection = this.connections.get(id);
    if (connection) {
      if (info.url) connection.url = info.url;
      if (info.title) connection.title = info.title;
      if (info.userAgent) connection.userAgent = info.userAgent;
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

  // Clean up stale connections
  cleanup() {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [id, connection] of this.connections.entries()) {
      if (now.getTime() - connection.lastSeen.getTime() > staleThreshold) {
        console.log(`Cleaning up stale connection: ${id}`);
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
