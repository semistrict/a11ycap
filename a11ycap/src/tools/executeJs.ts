import { z } from 'zod';
import type { ToolHandler } from './base.js';

// Core tool schema without sessionId (which is added by MCP server for routing)
const executeJsSchema = z.object({
  description: z
    .string()
    .describe('Human-readable description of what this code does'),
  code: z
    .string()
    .describe(
      'JavaScript code to execute. MUST be an IIFE (Immediately Invoked Function Expression) like: (() => { /* code */ })() or (async () => { /* code */ })()'
    ),
  returnValue: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to return the execution result'),
});

export const executeJsDefinition = {
  name: 'execute_js',
  description:
    'Execute JavaScript code in a connected browser. Code MUST be wrapped in an IIFE.',
  inputSchema: executeJsSchema.shape, // Will have sessionId added by MCP server
};

const ExecuteJsMessageSchema = z.object({
  id: z.string(),
  type: z.literal('execute_js'),
  payload: executeJsSchema, // Same schema as the core tool
});

type ExecuteJsMessage = z.infer<typeof ExecuteJsMessageSchema>;

async function executeExecuteJs(message: ExecuteJsMessage): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('executeJs requires browser environment');
  }

  const code = message.payload.code.trim();

  // Validate that code is an IIFE (regular or async)
  const iifePattern =
    /^(\(async\s*)?(\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*[\s\S]*\)\s*\(\s*\)$/;
  const functionIifePattern =
    /^(\(async\s+)?function\s*\([^)]*\)\s*\{[\s\S]*\}\s*\)\s*\(\s*\)$/;
  const arrowIifePattern =
    /^\(\s*(async\s+)?\([^)]*\)\s*=>\s*[\s\S]*\)\s*\(\s*\)$/;

  if (
    !iifePattern.test(code) &&
    !functionIifePattern.test(code) &&
    !arrowIifePattern.test(code)
  ) {
    throw new Error(
      'Code must be an IIFE (Immediately Invoked Function Expression). ' +
        'Examples: (() => { /* code */ })() or (async () => { /* code */ })()'
    );
  }

  try {
    // biome-ignore lint/security/noGlobalEval: Required for MCP tool functionality
    const result = eval(message.payload.code);

    // Handle async results
    if (result instanceof Promise) {
      const asyncResult = await result;
      return message.payload.returnValue
        ? `JavaScript executed successfully. Result: ${JSON.stringify(asyncResult, null, 2)}`
        : 'JavaScript executed successfully';
    }

    return message.payload.returnValue
      ? `JavaScript executed successfully. Result: ${JSON.stringify(result, null, 2)}`
      : 'JavaScript executed successfully';
  } catch (error) {
    throw new Error(
      `JavaScript execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export const executeJsTool: ToolHandler<ExecuteJsMessage> = {
  definition: executeJsDefinition,
  messageSchema: ExecuteJsMessageSchema,
  execute: executeExecuteJs,
};
