#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  PrimaryBrowserConnectionManager,
  RemoteBrowserConnectionManager,
  getBrowserConnectionManager,
  setBrowserConnectionManager,
} from "./browser-connection-manager.js";
import { CONSOLE_INJECTION_SCRIPT } from "./constants.js";
import { initializeLogging, log } from "./logging.js";
import { setupA11yCapTools } from "./mcp-server.js";

/**
 * a11ycap MCP Server
 *
 * Serves both:
 * 1. MCP protocol via stdio for coding agents
 * 2. WebSocket server for browser connections
 * 3. JavaScript library for browser console injection (/a11ycap.js)
 */

// Create MCP server instance
const server = new McpServer(
  {
    name: "a11ycap",
    version: "1.0.0",
    description: `Accessibility snapshot and browser automation server. To connect a browser, paste this in the browser console:\n\n${CONSOLE_INJECTION_SCRIPT}\n\nThis enables tools like take_snapshot, click_element, type_text, etc. Use list_tabs to see connected browsers.`,
  },
  {
    capabilities: {
      logging: {},
      tools: {
        listChanged: true,
      },
    },
  },
);

// Initialize logging with the MCP server
initializeLogging(server);

// Create stdio transport and connect
const transport = new StdioServerTransport();

async function main() {
  // Initialize browser connection management FIRST
  const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 12456;
  let primaryManager: PrimaryBrowserConnectionManager | null = null;

  // Check if primary server already exists
  let isPrimary = true;
  try {
    const response = await fetch(`http://localhost:${PORT}/health`, {
      method: "GET",
    });
    if (response.ok) {
      isPrimary = false;
    }
  } catch {
    // No existing server, we'll be primary
  }

  // Set up appropriate browser connection manager - always set one
  if (isPrimary) {
    try {
      primaryManager = new PrimaryBrowserConnectionManager(PORT);
      await primaryManager.start();
      setBrowserConnectionManager(primaryManager);
      log.debug("Started as primary WebSocket server");
    } catch (error) {
      log.error(
        "Failed to start primary server, falling back to remote:",
        error,
      );
      // If we can't start as primary, fall back to remote (even though it will fail)
      const fallbackRemoteManager = new RemoteBrowserConnectionManager(PORT);
      setBrowserConnectionManager(fallbackRemoteManager);
      log.debug("Using fallback remote connection manager");
    }
  } else {
    const remoteManager = new RemoteBrowserConnectionManager(PORT);
    setBrowserConnectionManager(remoteManager);
    log.debug("Connected as secondary MCP instance");
  }

  // Set up a11ycap-specific tools now that browser connection manager is available
  setupA11yCapTools(server);

  // Connect MCP server via stdio AFTER tools are set up
  await server.connect(transport);

  process.on("SIGINT", async () => {
    if (primaryManager) {
      await primaryManager.shutdown();
    }
    await transport.close();
    process.exit(0);
  });
}

// Run the server
main().catch((error) => {
  console.error("Failed to start server:", error);
  log.error("Failed to start server:", error);
  process.exit(1);
});
