import { z } from 'zod';
import type { ToolHandler } from './base.js';
import { baseToolSchema, ensureA11yCap } from './common.js';

// Core tool schema without browserId (which is added by MCP server for routing)
const clickElementSchema = baseToolSchema;

export const clickElementDefinition = {
  name: 'click_element',
  description: 'Click an element using its accessibility snapshot reference',
  inputSchema: clickElementSchema.shape, // Will have browserId added by MCP server
};

const ClickElementMessageSchema = z.object({
  id: z.string(),
  type: z.literal('click_element'),
  payload: clickElementSchema, // Same schema as the core tool
});

type ClickElementMessage = z.infer<typeof ClickElementMessageSchema>;

async function executeClickElement(message: ClickElementMessage): Promise<any> {
  const a11y = ensureA11yCap();
  const success = a11y.clickRef(message.payload.ref);
  if (!success) {
    throw new Error(
      `Failed to click element with ref "${message.payload.ref}"`
    );
  }

  return { clicked: true };
}

export const clickElementTool: ToolHandler<ClickElementMessage> = {
  definition: clickElementDefinition,
  messageSchema: ClickElementMessageSchema,
  execute: executeClickElement,
};
