import { z } from "zod";
import type { ToolHandler } from "./base.js";

// Core tool schema without browserId (which is added by MCP server for routing)
const clickElementSchema = z.object({
  element: z
    .string()
    .describe("Human-readable element description used to obtain permission to interact with the element"),
  ref: z
    .string()
    .describe('Element reference from snapshot (e.g., "e5")'),
  captureSnapshot: z
    .boolean()
    .optional()
    .default(true)
    .describe("Capture accessibility snapshot after action")
});

export const clickElementDefinition = {
  name: "click_element",
  description: "Click an element using its accessibility snapshot reference",
  inputSchema: clickElementSchema.shape  // Will have browserId added by MCP server
};

const ClickElementMessageSchema = z.object({
  id: z.string(),
  type: z.literal('click_element'),
  payload: clickElementSchema  // Same schema as the core tool
});

type ClickElementMessage = z.infer<typeof ClickElementMessageSchema>;

async function executeClickElement(message: ClickElementMessage): Promise<any> {
  if (typeof window === 'undefined' || !window.A11yCap) {
    throw new Error('A11yCap not available');
  }

  const success = window.A11yCap.clickRef(message.payload.ref);
  if (!success) {
    throw new Error(`Failed to click element with ref "${message.payload.ref}"`);
  }
  
  return { clicked: true };
}

export const clickElementTool: ToolHandler<ClickElementMessage> = {
  definition: clickElementDefinition,
  messageSchema: ClickElementMessageSchema,
  execute: executeClickElement
};