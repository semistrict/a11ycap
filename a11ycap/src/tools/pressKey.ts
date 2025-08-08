import { z } from "zod";
import type { ToolHandler } from "./base.js";

export const pressKeyDefinition = {
  name: "press_key",
  description: "Press a key on the keyboard",
  inputSchema: {
    browserId: z
      .string()
      .optional()
      .describe("Browser connection ID (uses first available if not specified)"),
    key: z
      .string()
      .describe("Name of the key to press or a character to generate, such as `ArrowLeft` or `a`"),
    captureSnapshot: z
      .boolean()
      .optional()
      .default(true)
      .describe("Capture accessibility snapshot after action")
  }
};

const PressKeyMessageSchema = z.object({
  id: z.string(),
  type: z.literal('press_key'),
  payload: z.object({
    key: z.string(),
  })
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

  return { pressed: true, key: key };
}

export const pressKeyTool: ToolHandler<PressKeyMessage> = {
  definition: pressKeyDefinition,
  messageSchema: PressKeyMessageSchema,
  execute: executePressKey
};