/**
 * Multi-instance MCP server coordination test
 *
 * Tests that multiple MCP server instances can coordinate properly:
 * 1. First instance becomes primary (starts WebSocket server)
 * 2. Subsequent instances become secondary (connect via HTTP)
 * 3. Browser connections work through both primary and secondary
 * 4. Tool calls from secondary instances are properly routed
 */

import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import WebSocket from "ws";

interface ServerInstance {
  client: Client;
  transport: StdioClientTransport;
  id: string;
}

class MultiInstanceTest {
  private servers: ServerInstance[] = [];
  private browserWs: WebSocket | null = null;
  public readonly port = 12457; // Use port one larger than default (12456)

  async startServer(): Promise<ServerInstance> {
    const id = randomUUID().substring(0, 8);

    // Get path to MCP server using import.meta.url
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = dirname(currentFile);
    const serverPath = join(currentDir, "..", "dist", "index.js");

    // Create MCP client transport with server parameters
    const transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env: {
        ...process.env,
        PORT: this.port.toString(),
        NODE_ENV: "test",
      },
      stderr: "pipe",
    });

    // Create MCP client
    const client = new Client(
      {
        name: `test-client-${id}`,
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    // Connect client (this starts the server process internally)
    await client.connect(transport);

    const instance: ServerInstance = {
      client,
      transport,
      id,
    };

    this.servers.push(instance);
    return instance;
  }

  async connectBrowser(): Promise<void> {
    // Wait a bit for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Connect WebSocket to primary server
    this.browserWs = new WebSocket(`ws://localhost:${this.port}/browser-ws`);

    await new Promise((resolve, reject) => {
      if (!this.browserWs) return reject(new Error("WebSocket not created"));

      this.browserWs.on("open", resolve);
      this.browserWs.on("error", reject);

      setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
    });

    // Send browser page info (matching browser library format)
    this.browserWs.send(
      JSON.stringify({
        sessionId: "test-session-123",
        type: "page_info",
        payload: {
          url: "http://localhost:3000/test",
          title: "Test Page",
          userAgent: "Test Browser",
        },
      }),
    );

    // Set up message handler for tool commands
    this.browserWs.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.id && message.type === 'command') {
          // Simulate successful tool execution
          const response = {
            sessionId: message.sessionId || "test-session-123",
            type: "command_response",
            commandId: message.id,
            success: true,
            data: {
              snapshot: `Mock snapshot for ${message.commandType}`,
              result: "Tool executed successfully",
            },
          };
          this.browserWs?.send(JSON.stringify(response));
        }
      } catch (error) {
        console.error("Error handling browser message:", error);
      }
    });
  }

  async callTool(
    serverInstance: ServerInstance,
    toolName: string,
    args: any = {},
  ): Promise<any> {
    const result = await serverInstance.client.callTool({
      name: toolName,
      arguments: args,
    });
    return result;
  }

  async listTabs(serverInstance: ServerInstance): Promise<any> {
    return this.callTool(serverInstance, "list_tabs");
  }

  async cleanup(): Promise<void> {
    // Close browser WebSocket
    if (this.browserWs) {
      this.browserWs.close();
      this.browserWs = null;
    }

    // Close all MCP clients and transports
    for (const server of this.servers) {
      try {
        await server.transport.close();
      } catch (error) {
        console.error(`Error cleaning up server ${server.id}:`, error);
      }
    }

    this.servers = [];

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

describe("Multi-instance MCP Server Coordination", () => {
  let testHarness: MultiInstanceTest;

  beforeEach(() => {
    testHarness = new MultiInstanceTest();
  });

  afterEach(async () => {
    await testHarness.cleanup();
  });

  test("should start primary server and accept browser connections", async () => {
    // Start first server (should become primary)
    const primary = await testHarness.startServer();

    // Connect browser
    await testHarness.connectBrowser();

    // List tabs should show the connected browser
    const result = await testHarness.listTabs(primary);
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("Connected tabs:");
    expect(result.content[0].text).toContain("Test Page");
  });

  test("should coordinate multiple server instances", async () => {
    // Start primary server
    const primary = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start secondary server
    const secondary = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Connect browser (should connect to primary)
    await testHarness.connectBrowser();

    // Both primary and secondary should see the browser
    const primaryTabs = await testHarness.listTabs(primary);
    expect(primaryTabs.content[0].text).toContain("Test Page");

    const secondaryTabs = await testHarness.listTabs(secondary);
    expect(secondaryTabs.content[0].text).toContain("Test Page");
  });

  test("should route tool calls through coordination system", async () => {
    // Start both servers
    const primary = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const secondary = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Connect browser
    await testHarness.connectBrowser();

    // Call take_snapshot from secondary server (should route to primary -> browser)
    const result = await testHarness.callTool(secondary, "take_snapshot", {
      sessionId: "test-session-123",
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("Mock snapshot");
  });

  test("should handle multiple secondary instances", async () => {
    // Start primary
    const primary = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start multiple secondaries
    const secondary1 = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const secondary2 = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const secondary3 = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Connect browser
    await testHarness.connectBrowser();

    // All instances should see the browser
    const instances = [primary, secondary1, secondary2, secondary3];
    for (const instance of instances) {
      const tabs = await testHarness.listTabs(instance);
      expect(tabs.content[0].text).toContain("Test Page");
    }

    // All instances should be able to call tools
    for (const instance of instances) {
      const result = await testHarness.callTool(instance, "take_snapshot", {
        sessionId: "test-session-123",
      });
      expect(result.content[0].text).toContain("Mock snapshot");
    }
  });

  test("should handle primary server restart", async () => {
    console.log("Starting primary server...");
    // Start primary and secondary
    const primary = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("Starting secondary server...");
    const secondary = await testHarness.startServer();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("Connecting browser...");
    // Connect browser
    await testHarness.connectBrowser();

    console.log("Verifying both servers work...");
    // Verify both work
    let tabs = await testHarness.listTabs(secondary);
    expect(tabs.content[0].text).toContain("Test Page");

    console.log("Closing primary server transport...");
    // Kill primary server by closing transport
    await primary.transport.close();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Wait for secondary to detect leader failure and elect itself as new leader
    console.log("Waiting for secondary to become new leader...");
    await new Promise((resolve) => setTimeout(resolve, 6000)); // Wait longer than election interval

    // Secondary should now be able to handle requests as the new primary
    console.log("Testing if secondary became new leader...");
    try {
      tabs = await testHarness.listTabs(secondary);
      // Should work now since secondary became the new primary
      expect(tabs.content).toBeDefined();
      console.log("Secondary successfully became new leader!");
    } catch (error) {
      console.log("Secondary failed to become leader:", error.message);
      throw error;
    }

    // Reconnect browser to the new leader (secondary-turned-primary)
    console.log("Reconnecting browser to new leader...");
    await testHarness.connectBrowser();

    // Poll until the new leader sees the browser connection
    const pollTimeout = 5000;
    const pollInterval = 200;
    const startTime = Date.now();
    let connected = false;

    while (Date.now() - startTime < pollTimeout) {
      tabs = await testHarness.listTabs(secondary);
      if (tabs.content[0].text.includes("Test Page")) {
        connected = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    expect(connected).toBe(true);
    expect(tabs.content[0].text).toContain("Test Page");
    console.log("New leader successfully handling browser connections!");
  }, 15000);
});
