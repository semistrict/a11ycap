import { z } from 'zod';
import type { ToolHandler } from './base.js';

// Core tool schema without sessionId (which is added by MCP server for routing)
const waitForSchema = z.object({
  text: z.string().optional().describe('The text to wait for'),
  textGone: z.string().optional().describe('The text to wait for to disappear'),
  selector: z
    .string()
    .optional()
    .describe('CSS selector to wait for (element to appear)'),
  selectorGone: z
    .string()
    .optional()
    .describe('CSS selector to wait for to disappear'),
  captureSnapshot: z
    .boolean()
    .optional()
    .default(true)
    .describe('Capture accessibility snapshot after action'),
});

export const waitForDefinition = {
  name: 'wait_for',
  description:
    'Wait for text to appear/disappear or CSS selectors to match/not match on the page',
  inputSchema: waitForSchema.shape, // Will have sessionId added by MCP server
};

const WaitForMessageSchema = z.object({
  id: z.string(),
  type: z.literal('wait_for'),
  payload: waitForSchema, // Same schema as the core tool
});

type WaitForMessage = z.infer<typeof WaitForMessageSchema>;

async function executeWaitFor(message: WaitForMessage): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('waitFor requires browser environment');
  }

  const { text, textGone, selector, selectorGone } = message.payload;

  if (text) {
    // Wait for text to appear
    const startTime = Date.now();
    const timeout = 30000; // 30 second timeout

    while (Date.now() - startTime < timeout) {
      if (document.body.textContent?.includes(text)) {
        return `Text "${text}" appeared on page`;
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100ms
    }

    throw new Error(`Timeout waiting for text "${text}" to appear`);
  }

  if (textGone) {
    // Wait for text to disappear
    const startTime = Date.now();
    const timeout = 30000; // 30 second timeout

    while (Date.now() - startTime < timeout) {
      if (!document.body.textContent?.includes(textGone)) {
        return `Text "${textGone}" disappeared from page`;
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100ms
    }

    throw new Error(`Timeout waiting for text "${textGone}" to disappear`);
  }

  if (selector) {
    // Wait for CSS selector to match (element to appear)
    const startTime = Date.now();
    const timeout = 30000; // 30 second timeout

    while (Date.now() - startTime < timeout) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          return `Element matching selector "${selector}" appeared on page`;
        }
      } catch (error) {
        throw new Error(
          `Invalid CSS selector "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100ms
    }

    throw new Error(`Timeout waiting for selector "${selector}" to appear`);
  }

  if (selectorGone) {
    // Wait for CSS selector to not match (element to disappear)
    const startTime = Date.now();
    const timeout = 30000; // 30 second timeout

    while (Date.now() - startTime < timeout) {
      try {
        const element = document.querySelector(selectorGone);
        if (!element) {
          return `Element matching selector "${selectorGone}" disappeared from page`;
        }
      } catch (error) {
        throw new Error(
          `Invalid CSS selector "${selectorGone}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100ms
    }

    throw new Error(
      `Timeout waiting for selector "${selectorGone}" to disappear`
    );
  }

  throw new Error(
    'Must specify either text, textGone, selector, or selectorGone parameter'
  );
}

export const waitForTool: ToolHandler<WaitForMessage> = {
  definition: waitForDefinition,
  messageSchema: WaitForMessageSchema,
  execute: executeWaitFor,
};
