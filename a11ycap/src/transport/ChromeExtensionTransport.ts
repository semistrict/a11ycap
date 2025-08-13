/**
 * Chrome Extension messaging implementation of Transport interface
 */

import { BaseTransport, TransportState } from './Transport.js';

export interface ChromeExtensionTransportOptions {
  extensionId?: string;
}

export class ChromeExtensionTransport extends BaseTransport {
  private messageListener: ((message: any, sender: any, sendResponse: (response?: any) => void) => boolean | void) | null = null;
  private extensionId?: string;
  private connectionCheckInterval?: number;

  constructor(options: ChromeExtensionTransportOptions = {}) {
    super();
    this.extensionId = options.extensionId;
  }

  connect(): void {
    if (this.state === TransportState.CONNECTING || this.state === TransportState.OPEN) {
      return;
    }

    if (!this.isExtensionEnvironment()) {
      this.state = TransportState.CLOSED;
      this.emit('onError', new Error('Chrome extension runtime not available'));
      return;
    }

    this.state = TransportState.CONNECTING;

    // Set up message listener
    this.messageListener = (message, sender, sendResponse) => {
      // Only handle messages from our extension or background script
      if (sender.id && sender.id !== (window as any).chrome?.runtime?.id) {
        return false;
      }

      // Handle messages directed to this transport
      if (message && message.type === 'a11ycap_transport') {
        this.emit('onMessage', message.payload);
        sendResponse({ received: true });
        return true; // Keep channel open for async response
      }

      return false;
    };

    (window as any).chrome.runtime.onMessage.addListener(this.messageListener);

    // Send initial connection message to background script
    this.sendToBackground({
      type: 'a11ycap_connect',
      timestamp: Date.now(),
    }, (response) => {
      if (response && response.connected) {
        this.state = TransportState.OPEN;
        this.emit('onOpen');
        this.startConnectionMonitor();
      } else {
        this.state = TransportState.CLOSED;
        this.emit('onError', new Error('Failed to connect to background script'));
      }
    });
  }

  private isExtensionEnvironment(): boolean {
    return !!((window as any).chrome?.runtime?.sendMessage && (window as any).chrome?.runtime?.onMessage);
  }

  private startConnectionMonitor(): void {
    // Monitor connection status periodically
    this.connectionCheckInterval = window.setInterval(() => {
      if (!this.isExtensionEnvironment()) {
        this.handleDisconnect();
        return;
      }

      // Ping background script to check connection
      this.sendToBackground({
        type: 'a11ycap_ping',
        timestamp: Date.now(),
      }, (response) => {
        if (!response || !response.pong) {
          this.handleDisconnect();
        }
      });
    }, 5000);
  }

  private handleDisconnect(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = undefined;
    }

    this.state = TransportState.CLOSED;
    this.emit('onClose');
  }

  private sendToBackground(message: any, callback?: (response: any) => void): void {
    try {
      if (this.extensionId) {
        // Send to specific extension
        if (callback) {
          (window as any).chrome.runtime.sendMessage(this.extensionId, message, callback);
        } else {
          (window as any).chrome.runtime.sendMessage(this.extensionId, message);
        }
      } else {
        // Send to own extension
        if (callback) {
          (window as any).chrome.runtime.sendMessage(message, callback);
        } else {
          (window as any).chrome.runtime.sendMessage(message);
        }
      }
    } catch (error) {
      this.emit('onError', error);
      if (callback) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }

  send(message: any): void {
    if (this.state !== TransportState.OPEN) {
      throw new Error('Chrome extension transport is not connected');
    }

    this.sendToBackground({
      type: 'a11ycap_message',
      payload: message,
      timestamp: Date.now(),
    }, (response) => {
      if (response && response.error) {
        this.emit('onError', new Error(response.error));
      }
    });
  }

  close(): void {
    this.state = TransportState.CLOSING;

    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = undefined;
    }

    if (this.messageListener && (window as any).chrome?.runtime?.onMessage) {
      (window as any).chrome.runtime.onMessage.removeListener(this.messageListener);
      this.messageListener = null;
    }

    // Send disconnect message to background
    this.sendToBackground({
      type: 'a11ycap_disconnect',
      timestamp: Date.now(),
    });

    this.state = TransportState.CLOSED;
    this.emit('onClose');
  }

  /**
   * Override setHandlers to auto-connect when handlers are set
   */
  setHandlers(handlers: any): void {
    super.setHandlers(handlers);
    if (this.state === TransportState.CLOSED) {
      this.connect();
    }
  }
}