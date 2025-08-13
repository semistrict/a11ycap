/**
 * Chrome Extension Background Service Worker
 * Bridges communication between content scripts and MCP server
 */

interface Connection {
  port: chrome.runtime.Port;
  sessionId: string;
  tabId?: number;
}

// Store active connections from content scripts
const connections = new Map<string, Connection>();

// WebSocket connection to MCP server
let mcpWebSocket: WebSocket | null = null;
let reconnectTimer: number | undefined;
const MCP_WS_URL = 'ws://localhost:12456/browser-ws';

/**
 * Connect to MCP server via WebSocket
 */
function connectToMCPServer() {
  if (mcpWebSocket?.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    mcpWebSocket = new WebSocket(MCP_WS_URL);

    mcpWebSocket.onopen = () => {
      console.log('Connected to MCP server');
      // Notify all content scripts
      connections.forEach((connection) => {
        connection.port.postMessage({
          type: 'a11ycap_transport',
          payload: { type: 'mcp_connected' },
        });
      });
    };

    mcpWebSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        // Forward message to appropriate content script based on sessionId
        if (message.sessionId) {
          const connection = connections.get(message.sessionId);
          if (connection) {
            connection.port.postMessage({
              type: 'a11ycap_transport',
              payload: message,
            });
          }
        } else {
          // Broadcast to all connections if no specific sessionId
          connections.forEach((connection) => {
            connection.port.postMessage({
              type: 'a11ycap_transport',
              payload: message,
            });
          });
        }
      } catch (error) {
        console.error('Error processing MCP message:', error);
      }
    };

    mcpWebSocket.onclose = () => {
      console.log('Disconnected from MCP server');
      mcpWebSocket = null;
      // Attempt reconnection after 2 seconds
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => connectToMCPServer(), 2000) as unknown as number;

      // Notify all content scripts
      connections.forEach((connection) => {
        connection.port.postMessage({
          type: 'a11ycap_transport',
          payload: { type: 'mcp_disconnected' },
        });
      });
    };

    mcpWebSocket.onerror = (error) => {
      console.error('MCP WebSocket error:', error);
    };
  } catch (error) {
    console.error('Failed to connect to MCP server:', error);
    // Retry after 2 seconds
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connectToMCPServer(), 2000) as unknown as number;
  }
}

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle connection requests
  if (message.type === 'a11ycap_connect') {
    sendResponse({ connected: true });
    return true;
  }

  // Handle ping requests
  if (message.type === 'a11ycap_ping') {
    sendResponse({ pong: true });
    return true;
  }

  // Handle disconnect requests
  if (message.type === 'a11ycap_disconnect') {
    // Clean up if needed
    sendResponse({ disconnected: true });
    return true;
  }

  // Forward messages to MCP server
  if (message.type === 'a11ycap_message' && mcpWebSocket?.readyState === WebSocket.OPEN) {
    mcpWebSocket.send(JSON.stringify(message.payload));
    sendResponse({ sent: true });
    return true;
  }

  sendResponse({ error: 'Unknown message type or WebSocket not connected' });
  return true;
});

/**
 * Handle long-lived connections from content scripts
 */
chrome.runtime.onConnect.addListener((port) => {
  if (!port.name?.startsWith('a11ycap_')) {
    return;
  }

  const sessionId = port.name.replace('a11ycap_', '');
  const tabId = port.sender?.tab?.id;

  connections.set(sessionId, {
    port,
    sessionId,
    tabId,
  });

  // Set up message listener for this port
  port.onMessage.addListener((message) => {
    if (mcpWebSocket?.readyState === WebSocket.OPEN) {
      // Add sessionId to message if not present
      if (!message.sessionId) {
        message.sessionId = sessionId;
      }
      mcpWebSocket.send(JSON.stringify(message));
    }
  });

  // Clean up on disconnect
  port.onDisconnect.addListener(() => {
    connections.delete(sessionId);
  });

  // Send initial connection status
  port.postMessage({
    type: 'a11ycap_transport',
    payload: {
      type: 'connection_established',
      mcpConnected: mcpWebSocket?.readyState === WebSocket.OPEN,
    },
  });
});

// Initialize MCP connection when service worker starts
connectToMCPServer();

// Reconnect on network changes
if ('connection' in navigator) {
  (navigator as any).connection.addEventListener('change', () => {
    if (mcpWebSocket?.readyState !== WebSocket.OPEN) {
      connectToMCPServer();
    }
  });
}

// Export for testing
export { connectToMCPServer, connections };