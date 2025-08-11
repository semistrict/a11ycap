import { z } from 'zod';
import type { ToolHandler } from './base.js';

// Core tool schema without sessionId (which is added by MCP server for routing)
const pressKeySchema = z.object({
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

export const pressKeyDefinition = {
  name: 'press_key',
  description: 'Press a key on the keyboard',
  inputSchema: pressKeySchema.shape, // Will have sessionId added by MCP server
};

const PressKeyMessageSchema = z.object({
  id: z.string(),
  type: z.literal('press_key'),
  payload: pressKeySchema, // Same schema as the core tool
});

type PressKeyMessage = z.infer<typeof PressKeyMessageSchema>;

async function executePressKey(message: PressKeyMessage): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('pressKey requires browser environment');
  }

  const key = message.payload.key;
  const target = document.activeElement || document.body;

  // Dispatch keyboard events
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  target.dispatchEvent(new KeyboardEvent('keypress', { key, bubbles: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));

  return `Successfully pressed key "${key}"`;
}

export const pressKeyTool: ToolHandler<PressKeyMessage> = {
  definition: pressKeyDefinition,
  messageSchema: PressKeyMessageSchema,
  execute: executePressKey,
};
