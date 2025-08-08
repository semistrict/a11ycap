import { z } from "zod";
import type { ToolHandler } from "./base.js";

export const typeTextDefinition = {
  name: "type_text",
  description: "Type text into an editable element",
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
    captureSnapshot: z
      .boolean()
      .optional()
      .default(true)
      .describe("Capture accessibility snapshot after action")
  }
};

const TypeTextMessageSchema = z.object({
  id: z.string(),
  type: z.literal('type_text'),
  payload: z.object({
    ref: z.string(),
    text: z.string(),
    slowly: z.boolean().optional().default(false),
    submit: z.boolean().optional().default(false),
  })
});

type TypeTextMessage = z.infer<typeof TypeTextMessageSchema>;

async function executeTypeText(message: TypeTextMessage): Promise<any> {
  if (typeof window === 'undefined' || !window.A11yCap) {
    throw new Error('A11yCap not available');
  }

  const element = window.A11yCap.findElementByRef(message.payload.ref);
  if (!element) {
    throw new Error(`Element with ref "${message.payload.ref}" not found`);
  }

  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
    throw new Error(`Element with ref "${message.payload.ref}" is not a text input element`);
  }

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