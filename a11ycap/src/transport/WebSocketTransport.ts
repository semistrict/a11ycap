/**
 * WebSocket implementation of Transport interface
 */

import { BaseTransport, TransportState, type TransportEventHandlers } from './Transport.js';

export interface WebSocketTransportOptions {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketTransport extends BaseTransport {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketTransportOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer?: number;

  constructor(options: WebSocketTransportOptions) {
    super();
    this.options = {
      url: options.url,
      reconnect: options.reconnect ?? true,
      reconnectInterval: options.reconnectInterval ?? 2000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? Number.POSITIVE_INFINITY,
    };
  }

  connect(): void {
    if (this.state === TransportState.CONNECTING || this.state === TransportState.OPEN) {
      return;
    }

    this.state = TransportState.CONNECTING;

    try {
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = () => {
        this.state = TransportState.OPEN;
        this.reconnectAttempts = 0;
        this.emit('onOpen');
      };

      this.ws.onclose = () => {
        this.state = TransportState.CLOSED;
        this.ws = null;
        this.emit('onClose');

        if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this.emit('onError', error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit('onMessage', message);
        } catch (error) {
          this.emit('onError', error);
        }
      };
    } catch (error) {
      this.state = TransportState.CLOSED;
      this.emit('onError', error);
      
      if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, this.options.reconnectInterval);
  }

  send(message: any): void {
    if (this.state !== TransportState.OPEN || !this.ws) {
      throw new Error('WebSocket is not connected');
    }

    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(data);
  }

  close(): void {
    this.state = TransportState.CLOSING;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = TransportState.CLOSED;
  }

  /**
   * Override setHandlers to auto-connect when handlers are set
   */
  setHandlers(handlers: TransportEventHandlers): void {
    super.setHandlers(handlers);
    if (this.state === TransportState.CLOSED) {
      this.connect();
    }
  }
}