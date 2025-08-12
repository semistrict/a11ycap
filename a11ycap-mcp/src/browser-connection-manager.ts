/**
 * Browser Connection Manager Interface and Implementations
 *
 * Provides two implementations:
 * 1. PrimaryBrowserConnectionManager - Direct WebSocket management for primary server
 * 2. RemoteBrowserConnectionManager - HTTP client for secondary instances
 */

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import { log } from "./logging.js";
import { setupLibraryRoutes } from "./routes/library.js";
import type { 
  BrowserToServerMessage,
  PageInfoMessage,
  HeartbeatMessage,
  CommandResponseMessage,
  BrowserCommand
} from "a11ycap";

export interface BrowserConnection {
  sessionId: string;
  ws: WebSocket;
  url: string;
  title: string;
  userAgent: string;
  connected: boolean;
  lastSeen: Date;
}

export interface BrowserResponse {
  commandId: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Abstract interface for browser connection management
 */
export interface IBrowserConnectionManager {
  addConnection(ws: WebSocket, metadata?: any): void;
  removeConnection(sessionId: string): void;
  updateConnectionInfo(
    sessionId: string,
    info: { url?: string; title?: string; userAgent?: string },
  ): void;
  sendCommand(
    sessionId: string,
    command: Omit<BrowserCommand, "id" | "sessionId" | "type">,
    timeoutMs?: number,
  ): Promise<any>;
  getConnections(): Promise<BrowserConnection[]>;
  getConnection(sessionId: string): Promise<BrowserConnection | undefined>;
  getFirstSessionId(): string | undefined;
  cleanup(): void;
}

/**
 * Primary browser connection manager - handles WebSockets directly and provides HTTP API
 */
export class PrimaryBrowserConnectionManager
  implements IBrowserConnectionManager
{
  private connections = new Map<string, BrowserConnection>(); // keyed by sessionId
  private wsToSessionId = new Map<WebSocket, string>(); // temporary mapping until sessionId is known
  private pendingCommands = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private httpServer: any;
  private wsServer: WebSocketServer | null = null;
  private port: number;
  private isStarted = false;

  constructor(port = 12456) {
    this.port = port;
  }

  async start(): Promise<void> {
    if (this.isStarted) return;

    // Create Express app with CORS
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Library route for /a11ycap.js
    setupLibraryRoutes(app);

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", connections: this.connections.size });
    });

    // API endpoint to get browser connections
    app.get("/api/browser-connections", (req, res) => {
      const connections = Array.from(this.connections.values())
        .filter((c) => c.connected)
        .map((c) => ({
          sessionId: c.sessionId,
          url: c.url,
          title: c.title,
          userAgent: c.userAgent,
          connected: c.connected,
          lastSeen: c.lastSeen,
        }));
      res.json({ connections });
    });

    // API endpoint to send commands to browsers
    app.post("/api/browser-command", async (req, res) => {
      try {
        const { command, sessionId } = req.body;

        if (!command || !sessionId) {
          return res
            .status(400)
            .json({ error: "Missing command or sessionId" });
        }

        const result = await this.sendCommand(sessionId, command);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Create HTTP server
    this.httpServer = createServer(app);

    // Create WebSocket server on /browser-ws path
    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: "/browser-ws",
    });

    // Handle WebSocket connections
    this.wsServer.on("connection", (ws: WebSocket, req) => {
      const userAgent = req.headers["user-agent"];
      const url = req.url;

      this.addConnection(ws, { userAgent, url });
    });

    // Handle WebSocket server errors to prevent unhandled 'error' events
    this.wsServer.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        log.debug(
          "WebSocket server port in use (normal in coordination system):",
          error.message,
        );
      } else {
        log.error("WebSocket server error:", error);
      }
    });

    // Handle HTTP server errors
    this.httpServer.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        log.debug(
          "HTTP server port in use (normal in coordination system):",
          error.message,
        );
      } else {
        log.error("HTTP server error:", error);
      }
    });

    // Start server
    await new Promise<void>((resolve, reject) => {
      this.httpServer.listen(this.port, (error: any) => {
        if (error) {
          reject(error);
        } else {
          log.info(
            `Primary server started on port ${this.port}, PID: ${process.pid}`,
          );
          resolve();
        }
      });
    });

    this.isStarted = true;
  }

  async shutdown(): Promise<void> {
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => resolve());
      });
      this.httpServer = null;
    }

    // Clear all connections
    for (const [id] of this.connections) {
      this.removeConnection(id);
    }

    this.isStarted = false;
  }

  addConnection(ws: WebSocket, _metadata?: any): void {
    // Connection starts without sessionId - it will come in page_info message

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleBrowserMessage(ws, message);
      } catch (error) {
        log.error("Error parsing browser message:", error);
      }
    });

    ws.on("close", () => {
      const sessionId = this.wsToSessionId.get(ws);
      if (sessionId) {
        this.removeConnection(sessionId);
      }
      this.wsToSessionId.delete(ws);
    });

    ws.on("error", (error) => {
      const sessionId = this.wsToSessionId.get(ws);
      log.error(`Browser connection ${sessionId || "unknown"} error:`, error);
      if (sessionId) {
        this.removeConnection(sessionId);
      }
      this.wsToSessionId.delete(ws);
    });
  }

  removeConnection(sessionId: string) {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.connected = false;
      this.connections.delete(sessionId);
      if (connection.ws) {
        this.wsToSessionId.delete(connection.ws);
      }
      log.debug(`Browser disconnected: session ${sessionId}`);
    }
  }

  updateConnectionInfo(
    sessionId: string,
    info: { url?: string; title?: string; userAgent?: string },
  ) {
    const connection = this.connections.get(sessionId);
    if (connection) {
      if (info.url) connection.url = info.url;
      if (info.title) connection.title = info.title;
      if (info.userAgent) connection.userAgent = info.userAgent;
      connection.lastSeen = new Date();
    }
  }

  private handleBrowserMessage(ws: WebSocket, message: BrowserToServerMessage) {
    // Handle page_info updates from browser
    if (message.type === "page_info") {
      const sessionId = message.sessionId;
      // Check if this is a new connection or update
      const existingSessionId = this.wsToSessionId.get(ws);

      if (!existingSessionId) {
        // First time seeing this WebSocket with a sessionId
        const existingConnection = this.connections.get(sessionId);
        if (existingConnection) {
          log.debug(
            `Session ${sessionId} reconnecting, replacing old connection`,
          );
          // Close the old WebSocket if still open
          if (
            existingConnection.ws &&
            existingConnection.ws.readyState === existingConnection.ws.OPEN
          ) {
            console.warn(
              "Closing old WebSocket for session that is still open",
              sessionId,
            );
            existingConnection.ws.close();
          }
          // Clean up old ws mapping
          if (existingConnection.ws) {
            this.wsToSessionId.delete(existingConnection.ws);
          }
        }

        const connection: BrowserConnection = {
          sessionId,
          ws,
          url: message.payload.url,
          title: message.payload.title,
          userAgent: message.payload.userAgent,
          connected: true,
          lastSeen: new Date(),
        };

        this.connections.set(sessionId, connection);
        this.wsToSessionId.set(ws, sessionId);

        log.info(
          `Browser connected: session ${sessionId} from ${connection.url || "unknown"}`,
        );
      } else {
        // Update existing connection info
        this.updateConnectionInfo(sessionId, {
          url: message.payload.url,
          title: message.payload.title,
          userAgent: message.payload.userAgent,
        });
      }
      return;
    }

    // Handle heartbeat messages from browser
    if (message.type === "heartbeat") {
      this.updateConnectionInfo(message.sessionId, {
        url: message.payload?.url,
        title: message.payload?.title,
      });
      return;
    }

    // Handle command responses
    if (message.type === "command_response") {
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
      const connection = this.connections.get(message.sessionId);
      if (connection) {
        connection.lastSeen = new Date();
      }
    }
  }

  async sendCommand(
    sessionId: string,
    command: Omit<BrowserCommand, "id" | "sessionId" | "type">,
    timeoutMs = 10000,
  ): Promise<any> {
    const connection = this.connections.get(sessionId);
    if (!connection || !connection.connected || !connection.ws) {
      throw new Error(`Browser session ${sessionId} not found or disconnected`);
    }

    const fullCommand: BrowserCommand = {
      sessionId,
      type: 'command',
      id: randomUUID(),
      commandType: command.commandType,
      payload: command.payload,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(fullCommand.id);
        reject(
          new Error(
            `Command ${fullCommand.commandType} timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      this.pendingCommands.set(fullCommand.id, { resolve, reject, timeout });

      try {
        connection.ws?.send(JSON.stringify(fullCommand));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingCommands.delete(fullCommand.id);
        reject(error);
      }
    });
  }

  async getConnections(): Promise<BrowserConnection[]> {
    return Array.from(this.connections.values()).filter((c) => c.connected);
  }

  async getConnection(
    sessionId: string,
  ): Promise<BrowserConnection | undefined> {
    return this.connections.get(sessionId);
  }

  getFirstSessionId(): string | undefined {
    const connections = Array.from(this.connections.values()).filter(
      (c) => c.connected,
    );
    return connections.length > 0 ? connections[0].sessionId : undefined;
  }

  cleanup() {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [sessionId, connection] of this.connections.entries()) {
      if (now.getTime() - connection.lastSeen.getTime() > staleThreshold) {
        log.debug(`Cleaning up stale connection: session ${sessionId}`);
        this.removeConnection(sessionId);
      }
    }
  }

  isReady(): boolean {
    return this.isStarted;
  }
}

/**
 * Remote browser connection manager - makes HTTP requests to primary server
 */
export class RemoteBrowserConnectionManager
  implements IBrowserConnectionManager
{
  private cachedConnections: BrowserConnection[] = [];
  private lastCacheUpdate = 0;
  private cacheTimeout = 5000; // 5 seconds
  private leaderElectionInterval: NodeJS.Timeout | null = null;

  constructor(private primaryServerPort: number) {
    // Start background leader election attempts every 5 seconds
    this.startLeaderElection();
  }

  private startLeaderElection(): void {
    this.leaderElectionInterval = setInterval(async () => {
      await this.attemptLeaderElection();
    }, 5000);
  }

  private async attemptLeaderElection(): Promise<void> {
    try {
      // Try to bind the port - if successful, the leader is down
      const newPrimary = new PrimaryBrowserConnectionManager(
        this.primaryServerPort,
      );
      await newPrimary.start();

      log.info(
        `Leader election successful - became new primary server! PID: ${process.pid}`,
      );

      // Stop the leader election attempts
      if (this.leaderElectionInterval) {
        clearInterval(this.leaderElectionInterval);
        this.leaderElectionInterval = null;
      }

      // Replace the global browser connection manager with our new primary instance
      setBrowserConnectionManager(newPrimary);
    } catch (error) {
      // Port is still bound, leader is alive - this is expected
      log.debug("Leader election attempt failed, leader still alive");
    }
  }

  // These methods are not supported for remote manager since WebSocket handling is on primary
  addConnection(_ws: WebSocket, _metadata?: any): void {
    throw new Error(
      "addConnection not supported on remote browser connection manager",
    );
  }

  removeConnection(_sessionId: string): void {
    throw new Error(
      "removeConnection not supported on remote browser connection manager",
    );
  }

  updateConnectionInfo(
    _sessionId: string,
    _info: { url?: string; title?: string; userAgent?: string },
  ): void {
    throw new Error(
      "updateConnectionInfo not supported on remote browser connection manager",
    );
  }

  cleanup(): void {
    // Stop leader election attempts
    if (this.leaderElectionInterval) {
      clearInterval(this.leaderElectionInterval);
      this.leaderElectionInterval = null;
    }
  }

  async sendCommand(
    sessionId: string,
    command: Omit<BrowserCommand, "id" | "sessionId" | "type">,
    timeoutMs = 10000,
  ): Promise<any> {
    const fullCommand: BrowserCommand = {
      sessionId,
      type: 'command',
      id: randomUUID(),
      commandType: command.commandType,
      payload: command.payload,
    };

    try {
      const response = await fetch(
        `http://localhost:${this.primaryServerPort}/api/browser-command`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: fullCommand,
            sessionId,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Command ${fullCommand.commandType} failed: ${error}`);
    }
  }

  async getConnections(): Promise<BrowserConnection[]> {
    const now = Date.now();

    // Return cached connections if they're recent
    if (
      now - this.lastCacheUpdate < this.cacheTimeout &&
      this.cachedConnections.length > 0
    ) {
      return this.cachedConnections;
    }

    try {
      const response = await fetch(
        `http://localhost:${this.primaryServerPort}/api/browser-connections`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch connections: HTTP ${response.status}`);
      }

      const data = await response.json();
      // Convert lastSeen strings back to Date objects
      this.cachedConnections = (data.connections || []).map((conn: any) => ({
        ...conn,
        lastSeen: new Date(conn.lastSeen),
      }));
      this.lastCacheUpdate = now;

      return this.cachedConnections;
    } catch (error) {
      log.error(
        "Failed to fetch browser connections from primary server:",
        error,
      );
      return this.cachedConnections; // Return cached connections on error
    }
  }

  async getConnection(
    sessionId: string,
  ): Promise<BrowserConnection | undefined> {
    const connections = await this.getConnections();
    return connections.find((conn) => conn.sessionId === sessionId);
  }

  getFirstSessionId(): string | undefined {
    // For remote, we need to check cached connections synchronously
    const connections = this.cachedConnections.filter((c) => c.connected);
    return connections.length > 0 ? connections[0].sessionId : undefined;
  }
}

// Export singleton instances - will be set by the coordinator
let browserConnectionManager: IBrowserConnectionManager | null = null;

export function setBrowserConnectionManager(
  manager: IBrowserConnectionManager,
) {
  browserConnectionManager = manager;
}

export function getBrowserConnectionManager(): IBrowserConnectionManager {
  if (!browserConnectionManager) {
    throw new Error(
      "Browser connection manager not initialized. This should not happen - manager should always be set to either primary or remote.",
    );
  }
  return browserConnectionManager;
}
