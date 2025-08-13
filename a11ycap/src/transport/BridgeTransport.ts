/**
 * Bridge Transport - Bridges messages between two different transport implementations
 * Useful for scenarios like WebSocket <-> Chrome Extension messaging
 */

import { BaseTransport, TransportState, type Transport, type TransportEventHandlers } from './Transport.js';

export interface BridgeTransportOptions {
  /**
   * Primary transport (e.g., WebSocket to external server)
   */
  primary: Transport;
  
  /**
   * Secondary transport (e.g., Chrome Extension messaging)
   */
  secondary: Transport;
  
  /**
   * Optional message transformer for primary -> secondary
   */
  transformPrimaryToSecondary?: (message: any) => any;
  
  /**
   * Optional message transformer for secondary -> primary
   */
  transformSecondaryToPrimary?: (message: any) => any;
  
  /**
   * Optional filter for primary -> secondary messages
   * Return true to forward the message
   */
  filterPrimaryToSecondary?: (message: any) => boolean;
  
  /**
   * Optional filter for secondary -> primary messages
   * Return true to forward the message
   */
  filterSecondaryToPrimary?: (message: any) => boolean;
  
  /**
   * Direction of the bridge
   * - 'bidirectional': Messages flow both ways (default)
   * - 'primary-to-secondary': Only forward from primary to secondary
   * - 'secondary-to-primary': Only forward from secondary to primary
   */
  direction?: 'bidirectional' | 'primary-to-secondary' | 'secondary-to-primary';
  
  /**
   * Whether to auto-connect transports when bridge is created
   */
  autoConnect?: boolean;
}

/**
 * Bridge transport that connects two different transport implementations
 */
export class BridgeTransport extends BaseTransport {
  private primary: Transport;
  private secondary: Transport;
  private options: Required<Omit<BridgeTransportOptions, 'primary' | 'secondary'>>;
  private primaryConnected = false;
  private secondaryConnected = false;
  
  constructor(options: BridgeTransportOptions) {
    super();
    
    this.primary = options.primary;
    this.secondary = options.secondary;
    
    this.options = {
      transformPrimaryToSecondary: options.transformPrimaryToSecondary || ((msg) => msg),
      transformSecondaryToPrimary: options.transformSecondaryToPrimary || ((msg) => msg),
      filterPrimaryToSecondary: options.filterPrimaryToSecondary || (() => true),
      filterSecondaryToPrimary: options.filterSecondaryToPrimary || (() => true),
      direction: options.direction || 'bidirectional',
      autoConnect: options.autoConnect ?? true,
    };
    
    this.setupBridge();
    
    if (this.options.autoConnect) {
      this.connect();
    }
  }
  
  private setupBridge(): void {
    // Set up primary transport handlers
    this.primary.setHandlers({
      onOpen: () => {
        this.primaryConnected = true;
        this.updateState();
      },
      
      onClose: () => {
        this.primaryConnected = false;
        this.updateState();
      },
      
      onError: (error) => {
        this.emit('onError', { source: 'primary', error });
      },
      
      onMessage: (message) => {
        // Forward to secondary if configured
        if (this.options.direction === 'bidirectional' || 
            this.options.direction === 'primary-to-secondary') {
          this.forwardPrimaryToSecondary(message);
        }
        
        // Also emit to bridge handlers
        this.emit('onMessage', { source: 'primary', message });
      },
    });
    
    // Set up secondary transport handlers
    this.secondary.setHandlers({
      onOpen: () => {
        this.secondaryConnected = true;
        this.updateState();
      },
      
      onClose: () => {
        this.secondaryConnected = false;
        this.updateState();
      },
      
      onError: (error) => {
        this.emit('onError', { source: 'secondary', error });
      },
      
      onMessage: (message) => {
        // Forward to primary if configured
        if (this.options.direction === 'bidirectional' || 
            this.options.direction === 'secondary-to-primary') {
          this.forwardSecondaryToPrimary(message);
        }
        
        // Also emit to bridge handlers
        this.emit('onMessage', { source: 'secondary', message });
      },
    });
  }
  
  private forwardPrimaryToSecondary(message: any): void {
    if (this.secondary.getState() !== TransportState.OPEN) {
      return;
    }
    
    if (!this.options.filterPrimaryToSecondary(message)) {
      return;
    }
    
    try {
      const transformed = this.options.transformPrimaryToSecondary(message);
      this.secondary.send(transformed);
    } catch (error) {
      this.emit('onError', { 
        source: 'bridge', 
        error, 
        context: 'forwarding primary to secondary' 
      });
    }
  }
  
  private forwardSecondaryToPrimary(message: any): void {
    if (this.primary.getState() !== TransportState.OPEN) {
      return;
    }
    
    if (!this.options.filterSecondaryToPrimary(message)) {
      return;
    }
    
    try {
      const transformed = this.options.transformSecondaryToPrimary(message);
      this.primary.send(transformed);
    } catch (error) {
      this.emit('onError', { 
        source: 'bridge', 
        error, 
        context: 'forwarding secondary to primary' 
      });
    }
  }
  
  private updateState(): void {
    const prevState = this.state;
    
    if (this.primaryConnected && this.secondaryConnected) {
      this.state = TransportState.OPEN;
      if (prevState !== TransportState.OPEN) {
        this.emit('onOpen');
      }
    } else if (this.primaryConnected || this.secondaryConnected) {
      this.state = TransportState.CONNECTING;
    } else {
      this.state = TransportState.CLOSED;
      if (prevState !== TransportState.CLOSED) {
        this.emit('onClose');
      }
    }
  }
  
  private connect(): void {
    // Both WebSocketTransport and ChromeExtensionTransport auto-connect
    // when handlers are set, so we don't need to do anything special here
    // The transports are already set up with handlers in setupBridge()
  }
  
  /**
   * Send message through the bridge
   * By default sends to primary transport, but can be configured
   */
  send(message: any, target: 'primary' | 'secondary' | 'both' = 'primary'): void {
    if (target === 'primary' || target === 'both') {
      if (this.primary.getState() === TransportState.OPEN) {
        this.primary.send(message);
      } else {
        throw new Error('Primary transport is not connected');
      }
    }
    
    if (target === 'secondary' || target === 'both') {
      if (this.secondary.getState() === TransportState.OPEN) {
        this.secondary.send(message);
      } else {
        throw new Error('Secondary transport is not connected');
      }
    }
  }
  
  close(): void {
    this.state = TransportState.CLOSING;
    
    // Close both transports
    this.primary.close();
    this.secondary.close();
    
    this.primaryConnected = false;
    this.secondaryConnected = false;
    this.state = TransportState.CLOSED;
  }
  
  /**
   * Get the primary transport
   */
  getPrimary(): Transport {
    return this.primary;
  }
  
  /**
   * Get the secondary transport
   */
  getSecondary(): Transport {
    return this.secondary;
  }
  
  /**
   * Get bridge statistics
   */
  getStats(): {
    primaryState: TransportState;
    secondaryState: TransportState;
    bridgeState: TransportState;
  } {
    return {
      primaryState: this.primary.getState(),
      secondaryState: this.secondary.getState(),
      bridgeState: this.state,
    };
  }
}