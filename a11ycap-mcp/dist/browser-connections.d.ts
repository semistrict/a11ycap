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
    type: "take_snapshot" | "execute_js" | "click_element" | "find_element" | "type_text" | "press_key" | "press_key_global" | "hover_element" | "select_option" | "wait_for";
    payload: any;
}
export interface BrowserResponse {
    commandId: string;
    success: boolean;
    data?: any;
    error?: string;
}
declare class BrowserConnectionManager {
    private connections;
    private pendingCommands;
    addConnection(ws: WebSocket, metadata?: any): string;
    removeConnection(id: string): void;
    updateConnectionInfo(id: string, info: {
        url?: string;
        title?: string;
        userAgent?: string;
    }): void;
    private handleBrowserMessage;
    sendCommand(connectionId: string, command: Omit<BrowserCommand, "id">, timeoutMs?: number): Promise<any>;
    getConnections(): BrowserConnection[];
    getConnection(id: string): BrowserConnection | undefined;
    cleanup(): void;
}
export declare const browserConnectionManager: BrowserConnectionManager;
export {};
