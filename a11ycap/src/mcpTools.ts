import { toolDefinitions as modularToolDefinitions } from "./tools/index.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * All tool definitions now use the modular system
 */
export const toolDefinitions: McpToolDefinition[] = modularToolDefinitions;