/**
 * Show Element Picker Tool
 * Displays an interactive element picker overlay and returns selected elements
 */

import { z } from 'zod';
import { generateAriaTree } from '../ariaSnapshot.js';
import { getElementPicker } from '../elementPicker.js';
import type { ToolDefinition, ToolHandler } from './base.js';

// Message schema for MCP communication
export const ShowElementPickerMessageSchema = z.object({
  type: z.literal('show_element_picker'),
  id: z.string(),
  payload: z.object({
    includeSnapshots: z
      .boolean()
      .optional()
      .describe('Include accessibility snapshots of selected elements'),
  }),
});

export type ShowElementPickerMessage = z.infer<
  typeof ShowElementPickerMessageSchema
>;

export interface PickedElementResult {
  selector: string;
  ariaLabel?: string;
  text?: string;
  ref?: string;
  snapshot?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Tool definition for MCP registration
export const showElementPickerDefinition: ToolDefinition = {
  name: 'show_element_picker',
  description:
    'Show an interactive element picker overlay to visually select elements on the page. Multiple elements can be selected by clicking.',
  inputSchema: {
    includeSnapshots: z
      .boolean()
      .optional()
      .describe('Include accessibility snapshots of selected elements'),
  },
};

// Tool handler
export const showElementPickerHandler: ToolHandler<ShowElementPickerMessage> = {
  definition: showElementPickerDefinition,
  messageSchema: ShowElementPickerMessageSchema,

  async execute(
    message: ShowElementPickerMessage
  ): Promise<string> {
    const picker = getElementPicker();

    // Enable picker with options but return immediately
    picker.enable({
      includeSnapshots: message.payload.includeSnapshots || false,
    });

    return 'Element picker enabled. Multiple elements can be selected by clicking. Use triple-ESC key to activate element picker. Selected elements will be saved to the event log and can be retrieved with get_picked_elements.';
  },
};

// Export tool with standard structure
export const showElementPickerTool = showElementPickerHandler;
