import { z } from "zod";
import type { ToolHandler } from "./base.js";

export const clickElementDefinition = {
  name: "click_element",
  description: "Click an element using its accessibility snapshot reference",
  inputSchema: {
    browserId: z
      .string()
      .optional()
      .describe("Browser connection ID (uses first available if not specified)"),
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
  }
};

const ClickElementMessageSchema = z.object({
  id: z.string(),
  type: z.literal('click_element'),
  payload: z.object({
    ref: z.string(),
  })
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