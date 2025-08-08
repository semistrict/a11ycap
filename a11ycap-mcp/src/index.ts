#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { WebSocketServer } from "ws";
import { browserConnectionManager } from "./browser-connections.js";
import { CONSOLE_INJECTION_SCRIPT } from "./constants.js";
import { setupA11yCapTools } from "./mcp-server.js";
import { setupLibraryRoutes } from "./routes/library.js";

/**
 * a11ycap MCP Server
 *
 * Serves both:
 * 1. MCP protocol endpoints for coding agents (/mcp, /sse, /messages)
 * 2. JavaScript library for browser console injection (/a11ycap.js)
 */

const getServer = () => {
  const server = new McpServer(
    {
      name: "a11ycap",
      version: "1.0.0",
    },
    { capabilities: { logging: {} } },
  );

  // Set up a11ycap-specific tools
  setupA11yCapTools(server);

  return server;
};

// Create Express application
const app = express();
app.use(express.json());

// Configure CORS to allow cross-origin usage from any website
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id"],
    exposedHeaders: ["Mcp-Session-Id"],
    credentials: false, // Important: must be false when origin is '*'
  }),
);

// Store transports by session ID
const transports: Record<
  string,
  StreamableHTTPServerTransport | SSEServerTransport
> = {};

//=============================================================================
// LIBRARY SERVING ROUTES
//=============================================================================

setupLibraryRoutes(app);

//=============================================================================
// STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
//=============================================================================

app.all("/mcp", async (req: Request, res: Response) => {
  console.log(`Received ${req.method} request to /mcp`);

  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      const existingTransport = transports[sessionId];
      if (existingTransport instanceof StreamableHTTPServerTransport) {
        transport = existingTransport;
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "Bad Request: Session exists but uses a different transport protocol",
          },
          id: null,
        });
        return;
      }
    } else if (
      !sessionId &&
      req.method === "POST" &&
      isInitializeRequest(req.body)
    ) {
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (sessionId) => {
          console.log(`a11ycap MCP session initialized: ${sessionId}`);
          transports[sessionId] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}`);
          delete transports[sid];
        }
      };

      const server = getServer();
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

//=============================================================================
// DEPRECATED HTTP+SSE TRANSPORT (PROTOCOL VERSION 2024-11-05)
//=============================================================================

app.get("/sse", async (req: Request, res: Response) => {
  console.log("Received GET request to /sse (deprecated SSE transport)");
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  const server = getServer();
  await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  let transport: SSEServerTransport;
  const existingTransport = transports[sessionId];
  if (existingTransport instanceof SSEServerTransport) {
    transport = existingTransport;
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "Bad Request: Session exists but uses a different transport protocol",
      },
      id: null,
    });
    return;
  }
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "a11ycap-mcp",
    timestamp: new Date().toISOString(),
  });
});

// Start the server with WebSocket support
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 12456;
const server = createServer(app);

// Set up WebSocket server for browser connections
const wss = new WebSocketServer({ server, path: "/browser-ws" });

wss.on("connection", (ws, request) => {
  const url = request.url;
  const userAgent = request.headers["user-agent"];

  const connectionId = browserConnectionManager.addConnection(ws, {
    url: request.headers.referer || url,
    userAgent,
  });

  ws.send(
    JSON.stringify({
      type: "connection_established",
      connectionId,
      message: "Connected to a11ycap MCP server",
    }),
  );

  // Handle page info updates from browser
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === "page_info") {
        // Update connection info with page details
        browserConnectionManager.updateConnectionInfo(connectionId, {
          url: message.payload.url,
          title: message.payload.title,
          userAgent: message.payload.userAgent,
        });
        console.log(
          `📄 Page info updated for ${connectionId}: "${message.payload.title}" - ${message.payload.url}`,
        );
      } else if (message.type === "heartbeat") {
        // Update connection with latest page info and timestamp
        browserConnectionManager.updateConnectionInfo(connectionId, {
          url: message.payload.url,
          title: message.payload.title,
        });
      }
    } catch (error) {
      console.error("Error parsing browser message:", error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🐱 a11ycap MCP server listening on port ${PORT}`);
  console.log(`
==============================================
A11YCAP MCP SERVER

Point your MCP client to:
http://localhost:${PORT}/mcp

Endpoints:
- /mcp (Streamable HTTP - newest protocol)
- /sse, /messages (legacy SSE transport)
- /browser-ws (WebSocket for browser connections)
- /a11ycap.js (injectable library with WebSocket connection)
- /a11ycap.min.js (alias)
- /demo (test page)
- /health (health check)

Usage:
1. Coding agents: Point your MCP client to http://localhost:${PORT}/mcp
2. Browser: Paste this in console:
   ${CONSOLE_INJECTION_SCRIPT}
==============================================
`);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down a11ycap MCP server...");

  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  console.log("Server shutdown complete");
  process.exit(0);
});
