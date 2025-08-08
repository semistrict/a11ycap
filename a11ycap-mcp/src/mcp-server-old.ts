import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { toolDefinitions, type McpToolDefinition } from "a11ycap";
import { browserConnectionManager } from "./browser-connections.js";
import { CONSOLE_INJECTION_SCRIPT } from "./constants.js";

/**
 * Set up MCP tools that command connected browsers
 */
export function setupA11yCapTools(server: McpServer) {
  // Tool: List connected browser tabs
  server.tool(
    "list_tabs",
    "List all connected browser tabs with their URLs and titles",
    {},
    async (): Promise<CallToolResult> => {
      const connections = browserConnectionManager.getConnections();

      if (connections.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No browser tabs connected. Inject the a11ycap script first.",
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

      const addNewSiteSnippet = `\n\nTo add a new site, paste this in the browser console:\n\n\`\`\`javascript\n${CONSOLE_INJECTION_SCRIPT}\n\`\`\``;

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

  // Tool: Take accessibility snapshot
  server.tool(
    "take_snapshot",
    "Take an accessibility snapshot from a connected browser",
    {
      browserId: z
        .string()
        .optional()
        .describe(
          "Browser connection ID (uses first available if not specified)",
        ),
      mode: z
        .enum(["ai", "expect", "codegen", "autoexpect"])
        .optional()
        .default("ai")
        .describe("Snapshot mode"),
      enableReact: z
        .boolean()
        .optional()
        .default(true)
        .describe("Enable React component information"),
      ref: z
        .string()
        .optional()
        .describe(
          'Element reference from snapshot (e.g., "e5") for specific element (default: document.body)',
        ),
      max_bytes: z
        .number()
        .optional()
        .describe(
          "Maximum size in bytes for the snapshot (uses breadth-first expansion)",
        ),
    },
    async ({
      browserId,
      mode,
      enableReact,
      ref,
      max_bytes,
    }): Promise<CallToolResult> => {
      try {
        const connections = browserConnectionManager.getConnections();
        if (connections.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No browsers connected. Please inject the a11ycap script into a webpage first.",
              },
            ],
            isError: true,
          };
        }

        const targetConnection = browserId
          ? browserConnectionManager.getConnection(browserId)
          : connections[0];

        if (!targetConnection) {
          return {
            content: [
              { type: "text", text: `Browser ${browserId} not found.` },
            ],
            isError: true,
          };
        }

        const result = await browserConnectionManager.sendCommand(
          targetConnection.id,
          {
            type: "take_snapshot",
            payload: { mode, enableReact, ref, max_bytes },
          },
        );

        return {
          content: [
            {
              type: "text",
              text: result.snapshot,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error taking snapshot: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Execute JavaScript in browser
  server.tool(
    "execute_js",
    "Execute JavaScript code in a connected browser",
    {
      browserId: z
        .string()
        .optional()
        .describe(
          "Browser connection ID (uses first available if not specified)",
        ),
      description: z
        .string()
        .describe("Human-readable description of what this code does"),
      code: z.string().describe("JavaScript code to execute"),
      returnValue: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to return the execution result"),
    },
    async ({
      browserId,
      description,
      code,
      returnValue,
    }): Promise<CallToolResult> => {
      try {
        const connections = browserConnectionManager.getConnections();
        if (connections.length === 0) {
          return {
            content: [{ type: "text", text: "No browsers connected." }],
            isError: true,
          };
        }

        const targetConnection = browserId
          ? browserConnectionManager.getConnection(browserId)
          : connections[0];

        if (!targetConnection) {
          return {
            content: [
              { type: "text", text: `Browser ${browserId} not found.` },
            ],
            isError: true,
          };
        }

        const result = await browserConnectionManager.sendCommand(
          targetConnection.id,
          {
            type: "execute_js",
            payload: { code, returnValue },
          },
        );

        return {
          content: [
            {
              type: "text",
              text: returnValue
                ? `${description}: ${JSON.stringify(result, null, 2)}`
                : `${description}: executed successfully`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing JavaScript: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Click element by ref
  server.tool(
    "click_element",
    "Click an element using its accessibility snapshot reference",
    {
      browserId: z
        .string()
        .optional()
        .describe(
          "Browser connection ID (uses first available if not specified)",
        ),
      element: z
        .string()
        .describe(
          "Human-readable element description used to obtain permission to interact with the element",
        ),
      ref: z.string().describe('Element reference from snapshot (e.g., "e5")'),
      captureSnapshot: z
        .boolean()
        .optional()
        .default(true)
        .describe("Capture accessibility snapshot after action"),
    },
    async ({
      browserId,
      element,
      ref,
      captureSnapshot,
    }): Promise<CallToolResult> => {
      try {
        const connections = browserConnectionManager.getConnections();
        if (connections.length === 0) {
          return {
            content: [{ type: "text", text: "No browsers connected." }],
            isError: true,
          };
        }

        const targetConnection = browserId
          ? browserConnectionManager.getConnection(browserId)
          : connections[0];

        if (!targetConnection) {
          return {
            content: [
              { type: "text", text: `Browser ${browserId} not found.` },
            ],
            isError: true,
          };
        }

        await browserConnectionManager.sendCommand(targetConnection.id, {
          type: "click_element",
          payload: { ref },
        });

        let resultContent = `Successfully clicked ${element} (${ref})`;

        // Capture snapshot after action if requested
        if (captureSnapshot) {
          const snapshot = await browserConnectionManager.sendCommand(
            targetConnection.id,
            {
              type: "take_snapshot",
              payload: { mode: "ai", enableReact: true },
            },
          );
          resultContent += `\n\nUpdated page snapshot:\n${snapshot.snapshot}`;
        }

        return {
          content: [
            {
              type: "text",
              text: resultContent,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error clicking element: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Type text into element
  server.tool(
    "type",
    "Type text into an editable element",
    {
      browserId: z
        .string()
        .optional()
        .describe(
          "Browser connection ID (uses first available if not specified)",
        ),
      element: z
        .string()
        .describe(
          "Human-readable element description used to obtain permission to interact with the element",
        ),
      ref: z.string().describe('Element reference from snapshot (e.g., "e5")'),
      text: z.string().describe("Text to type into the element"),
      slowly: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.",
        ),
      submit: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to submit entered text (press Enter after)"),
      captureSnapshot: z
        .boolean()
        .optional()
        .default(true)
        .describe("Capture accessibility snapshot after action"),
    },
    async ({
      browserId,
      element,
      ref,
      text,
      slowly,
      submit,
      captureSnapshot,
    }): Promise<CallToolResult> => {
      try {
        const connections = browserConnectionManager.getConnections();
        if (connections.length === 0) {
          return {
            content: [{ type: "text", text: "No browsers connected." }],
            isError: true,
          };
        }

        const targetConnection = browserId
          ? browserConnectionManager.getConnection(browserId)
          : connections[0];

        if (!targetConnection) {
          return {
            content: [
              { type: "text", text: `Browser ${browserId} not found.` },
            ],
            isError: true,
          };
        }

        // First type the text
        await browserConnectionManager.sendCommand(targetConnection.id, {
          type: "type_text",
          payload: { ref, text, slowly },
        });

        // Then submit if requested
        if (submit) {
          await browserConnectionManager.sendCommand(targetConnection.id, {
            type: "press_key",
            payload: { ref, key: "Enter" },
          });
        }

        let resultContent = `Successfully typed "${text}" into ${element} (${ref})`;
        if (submit) {
          resultContent += " and submitted";
        }

        // Capture snapshot after action if requested
        if (captureSnapshot) {
          const snapshot = await browserConnectionManager.sendCommand(
            targetConnection.id,
            {
              type: "take_snapshot",
              payload: { mode: "ai", enableReact: true },
            },
          );
          resultContent += `\n\nUpdated page snapshot:\n${snapshot.snapshot}`;
        }

        return {
          content: [
            {
              type: "text",
              text: resultContent,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error typing text: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Press a key
  server.tool(
    "press_key",
    "Press a key on the keyboard",
    {
      browserId: z
        .string()
        .optional()
        .describe(
          "Browser connection ID (uses first available if not specified)",
        ),
      key: z
        .string()
        .describe(
          "Name of the key to press or a character to generate, such as `ArrowLeft` or `a`",
        ),
      captureSnapshot: z
        .boolean()
        .optional()
        .default(true)
        .describe("Capture accessibility snapshot after action"),
    },
    async ({ browserId, key, captureSnapshot }): Promise<CallToolResult> => {
      try {
        const connections = browserConnectionManager.getConnections();
        if (connections.length === 0) {
          return {
            content: [{ type: "text", text: "No browsers connected." }],
            isError: true,
          };
        }

        const targetConnection = browserId
          ? browserConnectionManager.getConnection(browserId)
          : connections[0];

        if (!targetConnection) {
          return {
            content: [
              { type: "text", text: `Browser ${browserId} not found.` },
            ],
            isError: true,
          };
        }

        // Press the key globally on the page
        await browserConnectionManager.sendCommand(targetConnection.id, {
          type: "press_key_global",
          payload: { key },
        });

        let resultContent = `Successfully pressed key "${key}"`;

        // Capture snapshot after action if requested
        if (captureSnapshot) {
          const snapshot = await browserConnectionManager.sendCommand(
            targetConnection.id,
            {
              type: "take_snapshot",
              payload: { mode: "ai", enableReact: true },
            },
          );
          resultContent += `\n\nUpdated page snapshot:\n${snapshot.snapshot}`;
        }

        return {
          content: [
            {
              type: "text",
              text: resultContent,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error pressing key: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Hover over element
  server.tool(
    "hover",
    "Hover over an element",
    {
      browserId: z
        .string()
        .optional()
        .describe(
          "Browser connection ID (uses first available if not specified)",
        ),
      element: z
        .string()
        .describe(
          "Human-readable element description used to obtain permission to interact with the element",
        ),
      ref: z.string().describe('Element reference from snapshot (e.g., "e5")'),
      captureSnapshot: z
        .boolean()
        .optional()
        .default(true)
        .describe("Capture accessibility snapshot after action"),
    },
    async ({
      browserId,
      element,
      ref,
      captureSnapshot,
    }): Promise<CallToolResult> => {
      try {
        const connections = browserConnectionManager.getConnections();
        if (connections.length === 0) {
          return {
            content: [{ type: "text", text: "No browsers connected." }],
            isError: true,
          };
        }

        const targetConnection = browserId
          ? browserConnectionManager.getConnection(browserId)
          : connections[0];

        if (!targetConnection) {
          return {
            content: [
              { type: "text", text: `Browser ${browserId} not found.` },
            ],
            isError: true,
          };
        }

        // Hover over the element
        await browserConnectionManager.sendCommand(targetConnection.id, {
          type: "hover_element",
          payload: { ref },
        });

        let resultContent = `Successfully hovered over ${element} (${ref})`;

        // Capture snapshot after action if requested
        if (captureSnapshot) {
          const snapshot = await browserConnectionManager.sendCommand(
            targetConnection.id,
            {
              type: "take_snapshot",
              payload: { mode: "ai", enableReact: true },
            },
          );
          resultContent += `\n\nUpdated page snapshot:\n${snapshot.snapshot}`;
        }

        return {
          content: [
            {
              type: "text",
              text: resultContent,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error hovering over element: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Select option in dropdown
  server.tool(
    "select_option",
    "Select an option in a dropdown",
    {
      browserId: z
        .string()
        .optional()
        .describe(
          "Browser connection ID (uses first available if not specified)",
        ),
      element: z
        .string()
        .describe(
          "Human-readable element description used to obtain permission to interact with the element",
        ),
      ref: z.string().describe('Element reference from snapshot (e.g., "e5")'),
      values: z
        .array(z.string())
        .describe(
          "Array of values to select in the dropdown. This can be a single value or multiple values.",
        ),
      captureSnapshot: z
        .boolean()
        .optional()
        .default(true)
        .describe("Capture accessibility snapshot after action"),
    },
    async ({
      browserId,
      element,
      ref,
      values,
      captureSnapshot,
    }): Promise<CallToolResult> => {
      try {
        const connections = browserConnectionManager.getConnections();
        if (connections.length === 0) {
          return {
            content: [{ type: "text", text: "No browsers connected." }],
            isError: true,
          };
        }

        const targetConnection = browserId
          ? browserConnectionManager.getConnection(browserId)
          : connections[0];

        if (!targetConnection) {
          return {
            content: [
              { type: "text", text: `Browser ${browserId} not found.` },
            ],
            isError: true,
          };
        }

        // Select the option(s)
        await browserConnectionManager.sendCommand(targetConnection.id, {
          type: "select_option",
          payload: { ref, values },
        });

        let resultContent = `Successfully selected "${values.join(", ")}" in ${element} (${ref})`;

        // Capture snapshot after action if requested
        if (captureSnapshot) {
          const snapshot = await browserConnectionManager.sendCommand(
            targetConnection.id,
            {
              type: "take_snapshot",
              payload: { mode: "ai", enableReact: true },
            },
          );
          resultContent += `\n\nUpdated page snapshot:\n${snapshot.snapshot}`;
        }

        return {
          content: [
            {
              type: "text",
              text: resultContent,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error selecting option: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: Wait for condition
  server.tool(
    "wait_for",
    "Wait for text to appear or disappear or a specified time to pass",
    {
      browserId: z
        .string()
        .optional()
        .describe(
          "Browser connection ID (uses first available if not specified)",
        ),
      text: z.string().optional().describe("The text to wait for"),
      textGone: z
        .string()
        .optional()
        .describe("The text to wait for to disappear"),
      time: z.number().optional().describe("The time to wait in seconds"),
      captureSnapshot: z
        .boolean()
        .optional()
        .default(true)
        .describe("Capture accessibility snapshot after action"),
    },
    async ({
      browserId,
      text,
      textGone,
      time,
      captureSnapshot,
    }): Promise<CallToolResult> => {
      try {
        const connections = browserConnectionManager.getConnections();
        if (connections.length === 0) {
          return {
            content: [{ type: "text", text: "No browsers connected." }],
            isError: true,
          };
        }

        const targetConnection = browserId
          ? browserConnectionManager.getConnection(browserId)
          : connections[0];

        if (!targetConnection) {
          return {
            content: [
              { type: "text", text: `Browser ${browserId} not found.` },
            ],
            isError: true,
          };
        }

        // Wait for the condition
        await browserConnectionManager.sendCommand(targetConnection.id, {
          type: "wait_for",
          payload: { text, textGone, time },
        });

        let resultContent = "";
        if (text) {
          resultContent = `Successfully waited for text "${text}" to appear`;
        } else if (textGone) {
          resultContent = `Successfully waited for text "${textGone}" to disappear`;
        } else if (time) {
          resultContent = `Successfully waited for ${time} seconds`;
        }

        // Capture snapshot after action if requested
        if (captureSnapshot) {
          const snapshot = await browserConnectionManager.sendCommand(
            targetConnection.id,
            {
              type: "take_snapshot",
              payload: { mode: "ai", enableReact: true },
            },
          );
          resultContent += `\n\nUpdated page snapshot:\n${snapshot.snapshot}`;
        }

        return {
          content: [
            {
              type: "text",
              text: resultContent,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error waiting: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
