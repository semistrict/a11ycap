import { z } from 'zod';
import type { ToolHandler } from './base.js';

// Core tool schema without sessionId (which is added by MCP server for routing)
const takeSnapshotSchema = z.object({
  mode: z
    .enum(['ai', 'expect', 'codegen', 'autoexpect'])
    .optional()
    .default('ai')
    .describe('Snapshot mode'),
  enableReact: z
    .boolean()
    .optional()
    .default(true)
    .describe('Enable React component information'),
  ref: z
    .string()
    .optional()
    .describe(
      'Element reference from snapshot (e.g., "e5") for specific element (default: document.body)'
    ),
  max_bytes: z
    .number()
    .default(4096)
    .describe(
      'Maximum size in bytes for the snapshot (uses breadth-first expansion)'
    ),
});

export const takeSnapshotDefinition = {
  name: 'take_snapshot',
  description: 'Take an accessibility snapshot from a connected browser',
  inputSchema: takeSnapshotSchema.shape, // Will have sessionId added by MCP server
};

const TakeSnapshotMessageSchema = z.object({
  id: z.string(),
  type: z.literal('take_snapshot'),
  payload: takeSnapshotSchema, // Same schema as the core tool
});

type TakeSnapshotMessage = z.infer<typeof TakeSnapshotMessageSchema>;

async function executeTakeSnapshot(message: TakeSnapshotMessage): Promise<any> {
  if (typeof window === 'undefined' || !window.A11yCap) {
    throw new Error('A11yCap not available');
  }

  const element = message.payload.ref
    ? window.A11yCap.findElementByRef(message.payload.ref)
    : document.body;

  if (!element) {
    throw new Error(
      `Element with ref "${message.payload.ref || 'undefined'}" not found`
    );
  }

  const result = await window.A11yCap.snapshotForAI(element, message.payload);
  return result;
}

export const takeSnapshotTool: ToolHandler<TakeSnapshotMessage> = {
  definition: takeSnapshotDefinition,
  messageSchema: TakeSnapshotMessageSchema,
  execute: executeTakeSnapshot,
};
