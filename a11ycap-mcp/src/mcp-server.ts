import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitions } from "a11ycap";
import { type ZodObject, type ZodRawShape, z } from "zod";
import { getBrowserConnectionManager } from "./browser-connection-manager.js";
import { CONSOLE_INJECTION_SCRIPT } from "./constants.js";
import { setLogLevel } from "./logging.js";

/**
 * Helper function to add sessionId parameter to tool schemas for MCP registration.
 * The sessionId is used for server-side routing but is not part of the logical tool schema.
 */
function addSessionId(schema: ZodObject<any>) {
  return schema.extend({
    sessionId: z.string().describe("Browser session ID"),
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
      level === "emergency" || level === "alert" || level === "critical"
        ? "error"
        : level === "notice"
          ? "info"
          : (level as "debug" | "info" | "warning" | "error");
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
          const connections =
            await getBrowserConnectionManager().getConnections();

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
          // Filter out connections without proper sessionIds
          const tabInfo = connections
            .filter((conn) => conn.sessionId && conn.sessionId !== "unknown")
            .map((conn) => ({
              sessionId: conn.sessionId,
              url: conn.url || "unknown",
              title: conn.title || "No title available",
              lastSeen: conn.lastSeen.toISOString(),
            }));

          const tabList = tabInfo
            .map(
              (tab) =>
                `- ${tab.sessionId}: "${tab.title}" - ${tab.url} (${tab.lastSeen})`,
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
      // Add sessionId to the schema for MCP registration
      const schemaWithSessionId = addSessionId(z.object(toolDef.inputSchema));
      server.tool(
        toolDef.name,
        toolDef.description,
        schemaWithSessionId.shape,
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
async function handleGenericTool(
  toolName: string,
  params: any,
): Promise<CallToolResult> {
  const sessionId = params.sessionId;
  const manager = getBrowserConnectionManager();
  const connection = await manager.getConnection(sessionId);

  if (!connection) {
    return {
      content: [
        {
          type: "text",
          text: `Browser session "${sessionId}" not found. Use list_tabs to see available connections.`,
        },
      ],
    };
  }

  try {
    // Use browser connection manager's sendCommand which handles both local and remote
    const result = await manager.sendCommand(
      sessionId,
      {
        commandType: toolName,
        payload: params,
      },
      30000,
    );

    // Handle special case for capture_element_image tool
    if (toolName === "capture_element_image" && result?.base64Data) {
      try {
        // Create a temporary file for the image
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        const filename = `a11ycap-capture-${timestamp}.png`;
        const filepath = path.join(tempDir, filename);

        // Convert base64 to buffer and save to file
        const buffer = Buffer.from(result.base64Data, "base64");
        await fs.writeFile(filepath, buffer);

        return {
          content: [
            {
              type: "text",
              text: `Image captured successfully for element "${result.element}" (ref: ${result.ref})\nSaved to: ${filepath}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Image captured but failed to save to file: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    }

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
