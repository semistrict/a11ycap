import { z } from "zod";
import type { ToolHandler } from "./base.js";

export const takeSnapshotDefinition = {
  name: "take_snapshot",
  description: "Take an accessibility snapshot from a connected browser",
  inputSchema: {
    browserId: z
      .string()
      .optional()
      .describe("Browser connection ID (uses first available if not specified)"),
    mode: z
      .enum(["ai", "expect", "codegen", "autoexpect"])
      .optional()
      .default("ai")
      .describe("Snapshot mode"),
    enableReact: z
      .boolean()
      .optional()
      .default(true)
      .describe("Enable React component information"),
    ref: z
      .string()
      .optional()
      .describe('Element reference from snapshot (e.g., "e5") for specific element (default: document.body)'),
    max_bytes: z
      .number()
      .optional()
      .describe("Maximum size in bytes for the snapshot (uses breadth-first expansion)")
  }
};

const TakeSnapshotMessageSchema = z.object({
  id: z.string(),
  type: z.literal('take_snapshot'),
  payload: z.object({
    ref: z.string().optional(),
    mode: z.enum(["ai", "expect", "codegen", "autoexpected"]).optional(),
    enableReact: z.boolean().optional(),
    max_bytes: z.number().optional(),
  })
});

type TakeSnapshotMessage = z.infer<typeof TakeSnapshotMessageSchema>;

async function executeTakeSnapshot(message: TakeSnapshotMessage): Promise<any> {
  if (typeof window === 'undefined' || !window.A11yCap) {
    throw new Error('A11yCap not available');
  }

  const element = message.payload.ref ? 
    window.A11yCap.findElementByRef(message.payload.ref) : 
    document.body;
  
  if (!element) {
    throw new Error(`Element with ref "${message.payload.ref || 'undefined'}" not found`);
  }
  
  const result = await window.A11yCap.snapshotForAI(element, message.payload);
  return { snapshot: result };
}

export const takeSnapshotTool: ToolHandler<TakeSnapshotMessage> = {
  definition: takeSnapshotDefinition,
  messageSchema: TakeSnapshotMessageSchema,
  execute: executeTakeSnapshot
};