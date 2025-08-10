import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitions } from "a11ycap";
import { CONSOLE_INJECTION_SCRIPT } from "./constants.js";
import { getBrowserConnectionManager } from "./browser-connection-manager.js";
import { setLogLevel } from "./logging.js";
import { z, type ZodRawShape, type ZodObject } from "zod";

/**
 * Helper function to add browserId parameter to tool schemas for MCP registration.
 * The browserId is used for server-side routing but is not part of the logical tool schema.
 */
function addBrowserId(schema: ZodObject<any>) {
  return schema.extend({
    browserId: z
      .string()
      .optional()
      .describe("Browser connection ID (uses first available if not specified)")
  });
}

/**
 * Set up MCP tools that command connected browsers using tool definitions from a11ycap library
 */
export function setupA11yCapTools(server: McpServer) {
  // Handle logging/setLevel request
  server.server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const { level } = request.params;
    // Map MCP log levels to our simplified levels
    const mappedLevel = 
      level === "emergency" || level === "alert" || level === "critical" ? "error" :
      level === "notice" ? "info" :
      level as "debug" | "info" | "warning" | "error";
    setLogLevel(mappedLevel);
    return {};
  });
  // Register all tools from the a11ycap library
  for (const toolDef of toolDefinitions) {
    if (toolDef.name === "list_tabs") {
      // Special case: list_tabs doesn't need WebSocket communication
      server.tool(
        toolDef.name,
        toolDef.description,
        toolDef.inputSchema,
        async (): Promise<CallToolResult> => {
          const connections = await getBrowserConnectionManager().getConnections();

          if (connections.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No browser tabs connected. You MUST provide the user with one of these options to connect a browser:

**Option 1: Paste in browser console (for any website):**
\`\`\`javascript
${CONSOLE_INJECTION_SCRIPT}
\`\`\`

**Option 2: Add to HTML (if you're the developer):**
\`\`\`html
<script src="http://localhost:12456/a11ycap.js"></script>
\`\`\`

Tell the user to either:
- Paste the JavaScript snippet in their browser's developer console on any webpage
- OR add the script tag to their HTML if they control the webpage

This will enable browser automation tools like taking accessibility snapshots, clicking elements, and typing text.`,
                },
              ],
            };
          }

          // Get tab info from stored connection data (sent by browser on connect)
          const tabInfo = connections.map((conn) => ({
            id: conn.id,
            url: conn.url || "unknown",
            title: conn.title || "No title available",
            lastSeen: conn.lastSeen.toISOString(),
          }));

          const tabList = tabInfo
            .map(
              (tab) =>
                `- ${tab.id}: "${tab.title}" - ${tab.url} (${tab.lastSeen})`,
            )
            .join("\n");

          const addNewSiteSnippet = `\n\nTo add a new site:

**Option 1: Console (any website):**
\`\`\`javascript
${CONSOLE_INJECTION_SCRIPT}
\`\`\`

**Option 2: HTML (if you're the developer):**
\`\`\`html
<script src="http://localhost:12456/a11ycap.js"></script>
\`\`\``;

          return {
            content: [
              {
                type: "text",
                text: `Connected tabs:\n${tabList}${addNewSiteSnippet}`,
              },
            ],
          };
        },
      );
    } else {
      // Generic tool handler for all other tools
      // Add browserId to the schema for MCP registration
      const schemaWithBrowserId = addBrowserId(z.object(toolDef.inputSchema));
      server.tool(
        toolDef.name,
        toolDef.description,
        schemaWithBrowserId.shape,
        async (params: any): Promise<CallToolResult> => {
          return await handleGenericTool(toolDef.name, params);
        },
      );
    }
  }
}

/**
 * Generic tool handler that sends commands to browser via WebSocket
 */
async function handleGenericTool(toolName: string, params: any): Promise<CallToolResult> {
  const browserId = params.browserId;
  const manager = getBrowserConnectionManager();
  const connections = await manager.getConnections();
  const connection = browserId
    ? await manager.getConnection(browserId)
    : connections[0];

  if (!connection) {
    return {
      content: [
        {
          type: "text",
          text: browserId
            ? `Browser connection "${browserId}" not found. Use list_tabs to see available connections.`
            : `No browser connections available. To connect a browser, paste this in the browser console:\n\n\`\`\`javascript\n${CONSOLE_INJECTION_SCRIPT}\n\`\`\``,
        },
      ],
    };
  }

  try {
    // Use browser connection manager's sendCommand which handles both local and remote
    const result = await manager.sendCommand(connection.id, {
      type: toolName,
      payload: params,
    }, 30000);

    // Format the response based on tool type
    let responseText = `Tool "${toolName}" executed successfully`;
    
    if (result?.snapshot) {
      responseText = result.snapshot;
    } else if (result && typeof result === "object") {
      responseText += `\n\nResult: ${JSON.stringify(result, null, 2)}`;
    } else if (result !== undefined) {
      responseText += `\n\nResult: ${result}`;
    }

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Tool "${toolName}" error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
  }
}

