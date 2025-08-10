import { z } from "zod";
import type { ToolHandler } from "./base.js";
import { baseToolSchema, ensureInstanceOf, getElementByRefOrThrow } from "./common.js";

// Core tool schema without browserId (which is added by MCP server for routing)
const typeTextSchema = baseToolSchema.extend({
  text: z
    .string()
    .describe("Text to type into the element"),
  slowly: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once."),
  submit: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to submit entered text (press Enter after)"),
});

export const typeTextDefinition = {
  name: "type_text",
  description: "Type text into an editable element",
  inputSchema: typeTextSchema.shape  // Will have browserId added by MCP server
};

const TypeTextMessageSchema = z.object({
  id: z.string(),
  type: z.literal('type_text'),
  payload: typeTextSchema  // Same schema as the core tool
});

type TypeTextMessage = z.infer<typeof TypeTextMessageSchema>;

async function executeTypeText(message: TypeTextMessage): Promise<any> {
  const rawElement = getElementByRefOrThrow(message.payload.ref);
  const element = ensureInstanceOf<HTMLInputElement | HTMLTextAreaElement>(
    rawElement,
    [HTMLInputElement, HTMLTextAreaElement],
    `Element with ref "${message.payload.ref}" is not a text input element`
  );

  const text = message.payload.text;
  const slowly = message.payload.slowly;

  if (slowly) {
    // Type character by character
    element.value = ''; // Clear first
    element.focus();
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      
      // Small delay between characters
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } else {
    // Type all at once
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));

  // Handle submit if requested
  if (message.payload.submit) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    
    // Try to submit the form if element is in one
    const form = element.closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    }
  }

  return { typed: true, text: text };
}

export const typeTextTool: ToolHandler<TypeTextMessage> = {
  definition: typeTextDefinition,
  messageSchema: TypeTextMessageSchema,
  execute: executeTypeText
};
