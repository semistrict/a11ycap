/**
 * Minimal abstraction for bidirectional communication streams
 * Supports WebSocket, Chrome Extension messaging, and other transports
 */

export enum TransportState {
  CONNECTING = 'CONNECTING',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
}

export interface TransportEventHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: any) => void;
  onMessage?: (message: any) => void;
}

/**
 * Minimal transport interface for bidirectional communication
 */
export interface Transport {
  /**
   * Send a message through the transport
   */
  send(message: any): void;

  /**
   * Close the transport connection
   */
  close(): void;

  /**
   * Get current transport state
   */
  getState(): TransportState;

  /**
   * Set event handlers
   */
  setHandlers(handlers: TransportEventHandlers): void;
}

/**
 * Base class for transport implementations
 */
export abstract class BaseTransport implements Transport {
  protected state: TransportState = TransportState.CLOSED;
  protected handlers: TransportEventHandlers = {};

  abstract send(message: any): void;
  abstract close(): void;

  getState(): TransportState {
    return this.state;
  }

  setHandlers(handlers: TransportEventHandlers): void {
    this.handlers = handlers;
  }

  protected emit(event: keyof TransportEventHandlers, ...args: any[]): void {
    const handler = this.handlers[event];
    if (handler && typeof handler === 'function') {
      (handler as Function)(...args);
    }
  }
}