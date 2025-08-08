import { toolDefinitions } from "a11ycap";
import { browserConnectionManager } from "./browser-connections.js";
import { CONSOLE_INJECTION_SCRIPT } from "./constants.js";
/**
 * Set up MCP tools that command connected browsers using tool definitions from a11ycap library
 */
export function setupA11yCapTools(server) {
    // Register all tools from the a11ycap library
    for (const toolDef of toolDefinitions) {
        if (toolDef.name === "list_tabs") {
            // Special case: list_tabs doesn't need WebSocket communication
            server.tool(toolDef.name, toolDef.description, toolDef.inputSchema, async () => {
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
                    .map((tab) => `- ${tab.id}: "${tab.title}" - ${tab.url} (${tab.lastSeen})`)
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
            });
        }
        else {
            // Generic tool handler for all other tools
            server.tool(toolDef.name, toolDef.description, toolDef.inputSchema, async (params) => {
                return await handleGenericTool(toolDef.name, params);
            });
        }
    }
}
/**
 * Generic tool handler that sends commands to browser via WebSocket
 */
async function handleGenericTool(toolName, params) {
    const browserId = params.browserId;
    const connection = browserId
        ? browserConnectionManager.getConnection(browserId)
        : browserConnectionManager.getConnections()[0];
    if (!connection) {
        return {
            content: [
                {
                    type: "text",
                    text: browserId
                        ? `Browser connection "${browserId}" not found. Use list_tabs to see available connections.`
                        : "No browser connections available. Use list_tabs to see available connections.",
                },
            ],
        };
    }
    if (!connection.ws || connection.ws.readyState !== 1) {
        return {
            content: [
                {
                    type: "text",
                    text: `Browser connection "${connection.id}" is not ready (WebSocket state: ${connection.ws?.readyState || "undefined"}).`,
                },
            ],
        };
    }
    try {
        // Send tool command to browser
        const commandId = generateCommandId();
        const message = {
            id: commandId,
            type: toolName,
            payload: params,
        };
        const result = await sendCommandAndWait(connection.ws, message, 30000);
        if (!result.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Tool "${toolName}" failed: ${result.error || "Unknown error"}`,
                    },
                ],
            };
        }
        // Format the response based on tool type
        let responseText = `Tool "${toolName}" executed successfully`;
        if (result.data?.snapshot) {
            responseText = result.data.snapshot;
        }
        else if (result.data && typeof result.data === "object") {
            responseText += `\n\nResult: ${JSON.stringify(result.data, null, 2)}`;
        }
        else if (result.data !== undefined) {
            responseText += `\n\nResult: ${result.data}`;
        }
        return {
            content: [
                {
                    type: "text",
                    text: responseText,
                },
            ],
        };
    }
    catch (error) {
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
/**
 * Send a command to browser and wait for response
 */
function sendCommandAndWait(ws, message, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const commandId = message.id;
        let timeoutHandle;
        const cleanup = () => {
            if (timeoutHandle)
                clearTimeout(timeoutHandle);
            ws.removeListener("message", handleMessage);
        };
        const handleMessage = (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.commandId === commandId) {
                    cleanup();
                    resolve(response);
                }
            }
            catch (error) {
                // Ignore parsing errors for messages not meant for us
            }
        };
        timeoutHandle = setTimeout(() => {
            cleanup();
            reject(new Error(`Tool command timed out after ${timeout}ms`));
        }, timeout);
        ws.on("message", handleMessage);
        ws.send(JSON.stringify(message));
    });
}
/**
 * Generate a unique command ID
 */
function generateCommandId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
