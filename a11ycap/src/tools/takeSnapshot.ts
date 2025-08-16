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
  refs: z
    .array(z.string())
    .optional()
    .describe(
      'Element references from snapshot (e.g., ["e5", "e7"]) for specific elements'
    ),
  selector: z
    .string()
    .optional()
    .describe(
      'CSS selector to capture multiple elements (e.g., ".button", "div[data-test]")'
    ),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional()
    .describe(
      'Bounding box to capture all elements within (coordinates relative to viewport)'
    ),
  max_chars: z
    .number()
    .default(4096)
    .describe(
      'Maximum size in characters for the snapshot (uses breadth-first expansion)'
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

  let elements: Element[] = [];

  if (message.payload.refs && message.payload.refs.length > 0) {
    // Multiple elements by refs
    const foundElements: Element[] = [];
    const missingRefs: string[] = [];

    for (const ref of message.payload.refs) {
      const element = window.A11yCap.findElementByRef(ref);
      if (element) {
        foundElements.push(element);
      } else {
        missingRefs.push(ref);
      }
    }

    if (foundElements.length === 0) {
      throw new Error(
        `No elements found with refs: ${message.payload.refs.join(', ')}`
      );
    }

    if (missingRefs.length > 0) {
      console.warn(`Elements not found with refs: ${missingRefs.join(', ')}`);
    }

    elements = foundElements;
  } else if (message.payload.selector) {
    // Multiple elements by CSS selector
    try {
      const nodeList = document.querySelectorAll(message.payload.selector);
      elements = Array.from(nodeList);
      if (elements.length === 0) {
        throw new Error(
          `No elements found matching selector "${message.payload.selector}"`
        );
      }
    } catch (error) {
      throw new Error(
        `Invalid CSS selector "${message.payload.selector}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  } else if (message.payload.boundingBox) {
    // Multiple elements within bounding box
    const bbox = message.payload.boundingBox;
    const allElements = document.querySelectorAll('*');
    const elementsInBounds: Element[] = [];

    for (const element of allElements) {
      const rect = element.getBoundingClientRect();

      // Check if element intersects with the bounding box
      const intersects = !(
        rect.right < bbox.x ||
        rect.left > bbox.x + bbox.width ||
        rect.bottom < bbox.y ||
        rect.top > bbox.y + bbox.height
      );

      if (intersects && rect.width > 0 && rect.height > 0) {
        elementsInBounds.push(element);
      }
    }

    if (elementsInBounds.length === 0) {
      throw new Error(
        `No elements found within bounding box (${bbox.x}, ${bbox.y}, ${bbox.width}x${bbox.height})`
      );
    }

    elements = elementsInBounds;
  } else {
    // Default to document.body
    elements = [document.body];
  }

  // Generate snapshots for all elements and combine with size limit
  const snapshots: string[] = [];
  let totalLength = 0;
  const maxChars = message.payload.max_chars || 4096;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    try {
      const snapshot = await window.A11yCap.snapshotForAI(element, {
        ...message.payload,
        max_chars: undefined, // Remove individual limit, we'll apply global limit
      });

      let headerLabel = '';
      if (message.payload.refs?.[i]) {
        headerLabel = message.payload.refs[i];
      } else if (message.payload.selector) {
        headerLabel = message.payload.selector;
      } else if (message.payload.boundingBox) {
        const bbox = message.payload.boundingBox;
        headerLabel = `boundingBox(${bbox.x},${bbox.y},${bbox.width}x${bbox.height})`;
      } else {
        headerLabel = 'element';
      }

      const snapshotWithHeader =
        elements.length > 1
          ? `Element ${i + 1} (${headerLabel}):\n${snapshot}\n`
          : snapshot;

      // Check if adding this snapshot would exceed the limit
      const newLength = totalLength + snapshotWithHeader.length;
      if (newLength > maxChars && snapshots.length > 0) {
        // If we already have some snapshots and this would exceed limit, stop here
        snapshots.push(
          `\n[WARNING: Additional elements truncated due to size limit. Captured ${snapshots.length} of ${elements.length} elements.]`
        );
        break;
      }

      snapshots.push(snapshotWithHeader);
      totalLength = newLength;

      // If this single snapshot exceeds the limit, truncate it
      if (totalLength > maxChars) {
        const combined = snapshots.join('\n');
        const truncated = combined.slice(0, maxChars);

        // Ensure we don't cut off in the middle of a bracket expression
        const lastOpenBracket = truncated.lastIndexOf('[');
        const lastCloseBracket = truncated.lastIndexOf(']');

        if (lastOpenBracket > lastCloseBracket) {
          // We have an unclosed bracket, truncate before it
          const finalTruncated = truncated.slice(0, lastOpenBracket).trimEnd();
          return `${finalTruncated}\n\n[WARNING: Snapshot was truncated due to size limit. To get a focused snapshot of a specific element, use take_snapshot with the 'refs' parameter, e.g., take_snapshot(refs=["e5"]) to snapshot just that element and its children, or use 'selector' to target specific elements, e.g., take_snapshot(selector=".button").]`;
        }

        return `${truncated}\n\n[WARNING: Snapshot was truncated due to size limit. To get a focused snapshot of a specific element, use take_snapshot with the 'refs' parameter, e.g., take_snapshot(refs=["e5"]) to snapshot just that element and its children, or use 'selector' to target specific elements, e.g., take_snapshot(selector=".button").]`;
      }
    } catch (error) {
      const errorMsg = `[ERROR: Failed to snapshot element ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}]\n`;
      if (totalLength + errorMsg.length <= maxChars) {
        snapshots.push(errorMsg);
        totalLength += errorMsg.length;
      }
    }
  }

  return snapshots.join('\n');
}

export const takeSnapshotTool: ToolHandler<TakeSnapshotMessage> = {
  definition: takeSnapshotDefinition,
  messageSchema: TakeSnapshotMessageSchema,
  execute: executeTakeSnapshot,
};
