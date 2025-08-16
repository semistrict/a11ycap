/**
 * Factory for creating appropriate transport based on environment
 */

import type { Transport } from './Transport.js';
import { WebSocketTransport } from './WebSocketTransport.js';
import { ChromeExtensionTransport } from './ChromeExtensionTransport.js';

export enum TransportType {
  WEBSOCKET = 'websocket',
  CHROME_EXTENSION = 'chrome_extension',
  AUTO = 'auto',
}

export interface TransportConfig {
  type?: TransportType;
  wsUrl?: string;
  extensionId?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class TransportFactory {
  /**
   * Create a transport based on configuration or auto-detect
   */
  static create(config: TransportConfig = {}): Transport {
    const type = config.type || TransportType.AUTO;

    if (type === TransportType.WEBSOCKET) {
      if (!config.wsUrl) {
        throw new Error('WebSocket URL is required for WebSocket transport');
      }
      return new WebSocketTransport({
        url: config.wsUrl,
        reconnect: config.reconnect,
        reconnectInterval: config.reconnectInterval,
        maxReconnectAttempts: config.maxReconnectAttempts,
      });
    }

    if (type === TransportType.CHROME_EXTENSION) {
      return new ChromeExtensionTransport({
        extensionId: config.extensionId,
      });
    }

    // Auto-detect transport
    return TransportFactory.autoDetect(config);
  }

  /**
   * Auto-detect the best transport for the current environment
   */
  private static autoDetect(config: TransportConfig): Transport {
    // Check if we're in a Chrome extension content script
    if (TransportFactory.isChromeExtensionEnvironment()) {
      return new ChromeExtensionTransport({
        extensionId: config.extensionId,
      });
    }

    // Check if WebSocket URL is provided
    if (config.wsUrl) {
      return new WebSocketTransport({
        url: config.wsUrl,
        reconnect: config.reconnect,
        reconnectInterval: config.reconnectInterval,
        maxReconnectAttempts: config.maxReconnectAttempts,
      });
    }

    // Default to WebSocket with standard URL
    const defaultWsUrl = TransportFactory.getDefaultWebSocketUrl();
    return new WebSocketTransport({
      url: defaultWsUrl,
      reconnect: config.reconnect,
      reconnectInterval: config.reconnectInterval,
      maxReconnectAttempts: config.maxReconnectAttempts,
    });
  }

  /**
   * Check if we're running in a Chrome extension environment
   */
  private static isChromeExtensionEnvironment(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    // Check for Chrome extension runtime
    const hasRuntime = !!((window as any).chrome?.runtime?.id);
    
    // Check if we're in a content script (has access to both chrome API and DOM)
    const hasMessaging = !!((window as any).chrome?.runtime?.sendMessage);
    
    // Check if we're injected by extension (look for extension protocol in scripts)
    const scripts = document.getElementsByTagName('script');
    const hasExtensionScript = Array.from(scripts).some(
      script => script.src.startsWith('chrome-extension://')
    );

    return hasRuntime && hasMessaging && !hasExtensionScript;
  }

  /**
   * Get default WebSocket URL based on environment
   */
  private static getDefaultWebSocketUrl(): string {
    if (typeof window === 'undefined') {
      return 'ws://localhost:12456/browser-ws';
    }

    // Use current host for WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = 12456;

    return `${protocol}//${host}:${port}/browser-ws`;
  }

  /**
   * Detect available transport types in current environment
   */
  static getAvailableTransports(): TransportType[] {
    const available: TransportType[] = [];

    if (TransportFactory.isChromeExtensionEnvironment()) {
      available.push(TransportType.CHROME_EXTENSION);
    }

    // WebSocket is always available in browser
    if (typeof window !== 'undefined' && 'WebSocket' in window) {
      available.push(TransportType.WEBSOCKET);
    }

    return available;
  }
}