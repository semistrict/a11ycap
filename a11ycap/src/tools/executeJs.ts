import { z } from "zod";
import type { ToolHandler } from "./base.js";

// Core tool schema without browserId (which is added by MCP server for routing)
const executeJsSchema = z.object({
  description: z
    .string()
    .describe("Human-readable description of what this code does"),
  code: z
    .string()
    .describe("JavaScript code to execute"),
  returnValue: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to return the execution result")
});

export const executeJsDefinition = {
  name: "execute_js",
  description: "Execute JavaScript code in a connected browser",
  inputSchema: executeJsSchema.shape  // Will have browserId added by MCP server
};

const ExecuteJsMessageSchema = z.object({
  id: z.string(),
  type: z.literal('execute_js'),
  payload: executeJsSchema  // Same schema as the core tool
});

type ExecuteJsMessage = z.infer<typeof ExecuteJsMessageSchema>;

async function executeExecuteJs(message: ExecuteJsMessage): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('executeJs requires browser environment');
  }

  try {
    const result = eval(message.payload.code);
    return message.payload.returnValue ? { result } : { executed: true };
  } catch (error) {
    throw new Error(`JavaScript execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const executeJsTool: ToolHandler<ExecuteJsMessage> = {
  definition: executeJsDefinition,
  messageSchema: ExecuteJsMessageSchema,
  execute: executeExecuteJs
};