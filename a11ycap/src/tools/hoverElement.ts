import { z } from "zod";
import type { ToolHandler } from "./base.js";

export const hoverElementDefinition = {
  name: "hover_element",
  description: "Hover over an element",
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

const HoverElementMessageSchema = z.object({
  id: z.string(),
  type: z.literal('hover_element'),
  payload: z.object({
    ref: z.string(),
  })
});

type HoverElementMessage = z.infer<typeof HoverElementMessageSchema>;

async function executeHoverElement(message: HoverElementMessage): Promise<any> {
  if (typeof window === 'undefined' || !window.A11yCap) {
    throw new Error('A11yCap not available');
  }

  const element = window.A11yCap.findElementByRef(message.payload.ref);
  if (!element) {
    throw new Error(`Element with ref "${message.payload.ref}" not found`);
  }

  // Dispatch hover events
  element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

  return { hovered: true };
}

export const hoverElementTool: ToolHandler<HoverElementMessage> = {
  definition: hoverElementDefinition,
  messageSchema: HoverElementMessageSchema,
  execute: executeHoverElement
};