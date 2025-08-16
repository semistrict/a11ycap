/**
 * Server-side transport abstraction for bidirectional communication
 */

import type WebSocket from "ws";

export enum ServerTransportState {
  CONNECTING = 'CONNECTING',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
}

export interface ServerTransportEventHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: any) => void;
  onMessage?: (message: any) => void;
}

/**
 * Server-side transport interface
 */
export interface ServerTransport {
  send(message: any): void;
  close(): void;
  getState(): ServerTransportState;
  setHandlers(handlers: ServerTransportEventHandlers): void;
}

/**
 * WebSocket implementation of server-side transport
 */
export class WebSocketServerTransport implements ServerTransport {
  private state: ServerTransportState = ServerTransportState.OPEN;
  private handlers: ServerTransportEventHandlers = {};

  constructor(private ws: WebSocket) {
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    // WebSocket is already open when passed to constructor
    this.state = ServerTransportState.OPEN;

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('onMessage', message);
      } catch (error) {
        this.emit('onError', error);
      }
    });

    this.ws.on('close', () => {
      this.state = ServerTransportState.CLOSED;
      this.emit('onClose');
    });

    this.ws.on('error', (error) => {
      this.emit('onError', error);
    });
  }

  send(message: any): void {
    if (this.state !== ServerTransportState.OPEN || this.ws.readyState !== this.ws.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(data);
  }

  close(): void {
    if (this.state === ServerTransportState.CLOSED || this.state === ServerTransportState.CLOSING) {
      return;
    }

    this.state = ServerTransportState.CLOSING;
    this.ws.close();
  }

  getState(): ServerTransportState {
    return this.state;
  }

  setHandlers(handlers: ServerTransportEventHandlers): void {
    this.handlers = handlers;
    // Emit open immediately since WebSocket is already connected
    this.emit('onOpen');
  }

  private emit(event: keyof ServerTransportEventHandlers, ...args: any[]): void {
    const handler = this.handlers[event];
    if (handler && typeof handler === 'function') {
      (handler as Function)(...args);
    }
  }

  getWebSocket(): WebSocket {
    return this.ws;
  }
}