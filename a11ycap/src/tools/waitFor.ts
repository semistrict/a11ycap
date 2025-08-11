import { z } from 'zod';
import type { ToolHandler } from './base.js';

// Core tool schema without sessionId (which is added by MCP server for routing)
const waitForSchema = z.object({
  text: z.string().optional().describe('The text to wait for'),
  textGone: z.string().optional().describe('The text to wait for to disappear'),
  time: z.number().optional().describe('The time to wait in seconds'),
  captureSnapshot: z
    .boolean()
    .optional()
    .default(true)
    .describe('Capture accessibility snapshot after action'),
});

export const waitForDefinition = {
  name: 'wait_for',
  description:
    'Wait for text to appear or disappear or a specified time to pass',
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

  const { text, textGone, time } = message.payload;

  if (time) {
    // Wait for specified time
    await new Promise((resolve) => setTimeout(resolve, time * 1000));
    return `Successfully waited ${time} seconds`;
  }

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

  throw new Error('Must specify either text, textGone, or time parameter');
}

export const waitForTool: ToolHandler<WaitForMessage> = {
  definition: waitForDefinition,
  messageSchema: WaitForMessageSchema,
  execute: executeWaitFor,
};
