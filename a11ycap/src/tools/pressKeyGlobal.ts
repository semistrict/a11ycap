import { z } from 'zod';
import type { ToolHandler } from './base.js';

// Core tool schema without browserId (which is added by MCP server for routing)
const pressKeyGlobalSchema = z.object({
  key: z
    .string()
    .describe(
      'Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'
    ),
  captureSnapshot: z
    .boolean()
    .optional()
    .default(true)
    .describe('Capture accessibility snapshot after action'),
});

export const pressKeyGlobalDefinition = {
  name: 'press_key_global',
  description:
    'Press a key globally on the document (not targeting a specific element)',
  inputSchema: pressKeyGlobalSchema.shape, // Will have browserId added by MCP server
};

const PressKeyGlobalMessageSchema = z.object({
  id: z.string(),
  type: z.literal('press_key_global'),
  payload: pressKeyGlobalSchema, // Same schema as the core tool
});

type PressKeyGlobalMessage = z.infer<typeof PressKeyGlobalMessageSchema>;

async function executePressKeyGlobal(
  message: PressKeyGlobalMessage
): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('pressKeyGlobal requires browser environment');
  }

  const key = message.payload.key;
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keypress', { key, bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));

  return { pressed: true };
}

export const pressKeyGlobalTool: ToolHandler<PressKeyGlobalMessage> = {
  definition: pressKeyGlobalDefinition,
  messageSchema: PressKeyGlobalMessageSchema,
  execute: executePressKeyGlobal,
};
