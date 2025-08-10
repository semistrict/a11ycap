import { randomUUID } from "node:crypto";
import { log } from "./logging.js";
class BrowserConnectionManager {
    connections = new Map();
    pendingCommands = new Map();
    addConnection(ws, metadata) {
        const id = randomUUID();
        const connection = {
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
            }
            catch (error) {
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
        log.debug(`Browser connected: ${id} from ${connection.url || "unknown"}`);
        return id;
    }
    removeConnection(id) {
        const connection = this.connections.get(id);
        if (connection) {
            connection.connected = false;
            this.connections.delete(id);
            log.debug(`Browser disconnected: ${id}`);
        }
    }
    updateConnectionInfo(id, info) {
        const connection = this.connections.get(id);
        if (connection) {
            if (info.url)
                connection.url = info.url;
            if (info.title)
                connection.title = info.title;
            if (info.userAgent)
                connection.userAgent = info.userAgent;
            connection.lastSeen = new Date();
        }
    }
    handleBrowserMessage(connectionId, message) {
        const pending = this.pendingCommands.get(message.commandId);
        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingCommands.delete(message.commandId);
            if (message.success) {
                pending.resolve(message.data);
            }
            else {
                pending.reject(new Error(message.error || "Command failed"));
            }
        }
        // Update last seen
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.lastSeen = new Date();
        }
    }
    async sendCommand(connectionId, command, timeoutMs = 10000) {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.connected) {
            throw new Error(`Browser connection ${connectionId} not found or disconnected`);
        }
        const fullCommand = {
            ...command,
            id: randomUUID(),
        };
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingCommands.delete(fullCommand.id);
                reject(new Error(`Command ${fullCommand.type} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pendingCommands.set(fullCommand.id, { resolve, reject, timeout });
            try {
                connection.ws.send(JSON.stringify(fullCommand));
            }
            catch (error) {
                clearTimeout(timeout);
                this.pendingCommands.delete(fullCommand.id);
                reject(error);
            }
        });
    }
    getConnections() {
        return Array.from(this.connections.values()).filter((c) => c.connected);
    }
    getConnection(id) {
        return this.connections.get(id);
    }
    // Clean up stale connections
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
