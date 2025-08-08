import { z } from "zod";
import type { ToolHandler } from "./base.js";

export const executeJsDefinition = {
  name: "execute_js",
  description: "Execute JavaScript code in a connected browser",
  inputSchema: {
    browserId: z
      .string()
      .optional()
      .describe("Browser connection ID (uses first available if not specified)"),
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
  }
};

const ExecuteJsMessageSchema = z.object({
  id: z.string(),
  type: z.literal('execute_js'),
  payload: z.object({
    description: z.string(),
    code: z.string(),
    returnValue: z.boolean().optional().default(true),
  })
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