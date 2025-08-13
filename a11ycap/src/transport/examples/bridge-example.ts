/**
 * Example usage of BridgeTransport
 * This demonstrates various bridging scenarios
 */

import { BridgeTransport } from '../BridgeTransport.js';
import { WebSocketTransport } from '../WebSocketTransport.js';
import { ChromeExtensionTransport } from '../ChromeExtensionTransport.js';
import { TransportState } from '../Transport.js';

// Example 1: Simple WebSocket to Chrome Extension bridge
export function createSimpleBridge() {
  const wsBridge = new BridgeTransport({
    primary: new WebSocketTransport({ 
      url: 'ws://localhost:12456/browser-ws' 
    }),
    secondary: new ChromeExtensionTransport(),
    direction: 'bidirectional',
  });

  return wsBridge;
}

// Example 2: Bridge with message filtering
export function createFilteredBridge() {
  const bridge = new BridgeTransport({
    primary: new WebSocketTransport({ 
      url: 'ws://localhost:12456/browser-ws' 
    }),
    secondary: new ChromeExtensionTransport(),
    
    // Only forward certain message types from WebSocket to Extension
    filterPrimaryToSecondary: (message) => {
      return message.type !== 'heartbeat' && message.type !== 'debug';
    },
    
    // Only forward user actions from Extension to WebSocket
    filterSecondaryToPrimary: (message) => {
      return message.type === 'user_action' || message.type === 'command';
    },
  });

  return bridge;
}

// Example 3: Bridge with message transformation
export function createTransformingBridge() {
  const bridge = new BridgeTransport({
    primary: new WebSocketTransport({ 
      url: 'ws://localhost:12456/browser-ws' 
    }),
    secondary: new ChromeExtensionTransport(),
    
    // Transform WebSocket messages for Chrome Extension
    transformPrimaryToSecondary: (message) => {
      return {
        ...message,
        source: 'websocket',
        timestamp: Date.now(),
        // Add Chrome extension specific fields
        chromeTabId: (window as any).chrome?.tabs?.currentTab?.id,
      };
    },
    
    // Transform Chrome Extension messages for WebSocket
    transformSecondaryToPrimary: (message) => {
      return {
        ...message,
        source: 'chrome_extension',
        extensionId: (window as any).chrome?.runtime?.id,
        // Remove Chrome-specific fields
        chromeTabId: undefined,
      };
    },
  });

  return bridge;
}

// Example 4: Unidirectional bridge (Chrome Extension -> WebSocket only)
export function createUnidirectionalBridge() {
  const bridge = new BridgeTransport({
    primary: new WebSocketTransport({ 
      url: 'ws://localhost:12456/browser-ws' 
    }),
    secondary: new ChromeExtensionTransport(),
    direction: 'secondary-to-primary', // Only Extension to WebSocket
  });

  return bridge;
}

// Example 5: Bridge with custom handlers
export function createCustomHandlerBridge() {
  const bridge = new BridgeTransport({
    primary: new WebSocketTransport({ 
      url: 'ws://localhost:12456/browser-ws' 
    }),
    secondary: new ChromeExtensionTransport(),
  });

  // Set custom handlers on the bridge itself
  bridge.setHandlers({
    onMessage: ({ source, message }) => {
      console.log(`Bridge received from ${source}:`, message);
      
      // Custom logic based on source
      if (source === 'primary' && message.type === 'command') {
        // Handle commands from WebSocket
        console.log('Processing command from WebSocket:', message);
      } else if (source === 'secondary' && message.type === 'user_action') {
        // Handle user actions from Chrome Extension
        console.log('Processing user action from Extension:', message);
      }
    },
    
    onError: ({ source, error, context }) => {
      console.error(`Bridge error from ${source}:`, error);
      if (context) {
        console.error('Context:', context);
      }
    },
    
    onOpen: () => {
      console.log('Bridge fully connected!');
      const stats = bridge.getStats();
      console.log('Bridge stats:', stats);
    },
    
    onClose: () => {
      console.log('Bridge disconnected');
    },
  });

  return bridge;
}

// Example 6: Chain multiple bridges (WebSocket -> Bridge -> Chrome Extension -> Bridge -> Another WebSocket)
export function createChainedBridges() {
  // First bridge: External WebSocket to Chrome Extension
  const externalBridge = new BridgeTransport({
    primary: new WebSocketTransport({ 
      url: 'ws://external-server.com/ws' 
    }),
    secondary: new ChromeExtensionTransport(),
    transformPrimaryToSecondary: (msg) => ({
      ...msg,
      bridge: 'external',
    }),
  });

  // Second bridge: Chrome Extension to Internal WebSocket
  const internalBridge = new BridgeTransport({
    primary: new ChromeExtensionTransport(),
    secondary: new WebSocketTransport({ 
      url: 'ws://localhost:8080/internal' 
    }),
    transformPrimaryToSecondary: (msg) => ({
      ...msg,
      bridge: 'internal',
    }),
  });

  return { externalBridge, internalBridge };
}

// Example 7: Dynamic bridge with runtime configuration
export class DynamicBridge {
  private bridge: BridgeTransport;
  private filterRules: Set<string> = new Set();
  
  constructor() {
    this.bridge = new BridgeTransport({
      primary: new WebSocketTransport({ 
        url: 'ws://localhost:12456/browser-ws' 
      }),
      secondary: new ChromeExtensionTransport(),
      
      filterPrimaryToSecondary: (message) => {
        // Dynamic filtering based on runtime rules
        if (this.filterRules.has(message.type)) {
          return false; // Block this message type
        }
        return true;
      },
      
      autoConnect: false, // Manual connection control
    });
  }
  
  // Add runtime filter rule
  addFilter(messageType: string): void {
    this.filterRules.add(messageType);
  }
  
  // Remove runtime filter rule
  removeFilter(messageType: string): void {
    this.filterRules.delete(messageType);
  }
  
  // Connect the bridge
  connect(): void {
    if (this.bridge.getState() === TransportState.CLOSED) {
      // Re-setup handlers to trigger connection
      // This will cause the transports to auto-connect
      this.bridge.setHandlers({
        onOpen: () => console.log('Dynamic bridge connected'),
        onClose: () => console.log('Dynamic bridge disconnected'),
        onMessage: (data) => console.log('Dynamic bridge message:', data),
        onError: (error) => console.error('Dynamic bridge error:', error),
      });
    }
  }
  
  // Send to specific transport
  sendToPrimary(message: any): void {
    this.bridge.send(message, 'primary');
  }
  
  sendToSecondary(message: any): void {
    this.bridge.send(message, 'secondary');
  }
  
  // Broadcast to both transports
  broadcast(message: any): void {
    this.bridge.send(message, 'both');
  }
  
  // Get bridge statistics
  getStats() {
    return {
      ...this.bridge.getStats(),
      activeFilters: Array.from(this.filterRules),
    };
  }
}

// Example 8: Bridge for protocol translation
export function createProtocolTranslatorBridge() {
  interface WSMessage {
    id: string;
    method: string;
    params: any;
  }
  
  interface ExtMessage {
    action: string;
    data: any;
    tabId?: number;
  }
  
  const bridge = new BridgeTransport({
    primary: new WebSocketTransport({ 
      url: 'ws://localhost:12456/browser-ws' 
    }),
    secondary: new ChromeExtensionTransport(),
    
    // Translate WebSocket RPC to Chrome Extension format
    transformPrimaryToSecondary: (wsMsg: WSMessage): ExtMessage => {
      return {
        action: wsMsg.method,
        data: wsMsg.params,
        tabId: (window as any).chrome?.tabs?.currentTab?.id,
      };
    },
    
    // Translate Chrome Extension to WebSocket RPC format
    transformSecondaryToPrimary: (extMsg: ExtMessage): WSMessage => {
      return {
        id: Math.random().toString(36).substr(2, 9),
        method: extMsg.action,
        params: extMsg.data,
      };
    },
  });
  
  return bridge;
}