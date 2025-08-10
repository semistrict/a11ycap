import { z } from "zod";
import type { ToolHandler } from "./base.js";
import { baseToolSchema, getElementByRefOrThrow } from "./common.js";

// Core tool schema without browserId (which is added by MCP server for routing)
const hoverElementSchema = baseToolSchema;

export const hoverElementDefinition = {
  name: "hover_element",
  description: "Hover over an element",
  inputSchema: hoverElementSchema.shape  // Will have browserId added by MCP server
};

const HoverElementMessageSchema = z.object({
  id: z.string(),
  type: z.literal('hover_element'),
  payload: hoverElementSchema  // Same schema as the core tool
});

type HoverElementMessage = z.infer<typeof HoverElementMessageSchema>;

async function executeHoverElement(message: HoverElementMessage): Promise<any> {
  const element = getElementByRefOrThrow(message.payload.ref);

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
