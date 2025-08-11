/**
 * Show Element Picker Tool
 * Displays an interactive element picker overlay and returns selected elements
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from './base.js';
import { getElementPicker } from '../elementPicker.js';
import { generateAriaTree } from '../ariaSnapshot.js';

// Message schema for MCP communication
export const ShowElementPickerMessageSchema = z.object({
  type: z.literal('show_element_picker'),
  id: z.string(),
  payload: z.object({
    multiSelect: z.boolean().optional().describe('Allow selecting multiple elements (hold Shift)'),
    includeSnapshots: z.boolean().optional().describe('Include accessibility snapshots of selected elements')
  })
});

export type ShowElementPickerMessage = z.infer<typeof ShowElementPickerMessageSchema>;

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
  description: 'Show an interactive element picker overlay to visually select elements on the page',
  inputSchema: {
    multiSelect: z.boolean().optional().describe('Allow selecting multiple elements (hold Shift)'),
    includeSnapshots: z.boolean().optional().describe('Include accessibility snapshots of selected elements')
  }
};

// Tool handler
export const showElementPickerHandler: ToolHandler<ShowElementPickerMessage> = {
  definition: showElementPickerDefinition,
  messageSchema: ShowElementPickerMessageSchema,
  
  async execute(message: ShowElementPickerMessage): Promise<PickedElementResult[]> {
    const picker = getElementPicker();
    
    // Show picker and wait for user to select elements
    const pickedElements = await picker.pick();
    
    // Convert to result format
    const results: PickedElementResult[] = [];
    
    for (const picked of pickedElements) {
      const rect = picked.element.getBoundingClientRect();
      
      const result: PickedElementResult = {
        selector: picked.selector,
        ariaLabel: picked.ariaLabel,
        text: picked.text?.substring(0, 100), // Limit text length
        ref: picked.ref,
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        }
      };
      
      // Include snapshot if requested
      if (message.payload.includeSnapshots) {
        try {
          const ariaTree = generateAriaTree(picked.element, {
            mode: 'ai',
            enableReact: true
          });
          result.snapshot = JSON.stringify(ariaTree, null, 2);
        } catch (error) {
          console.error('Failed to generate snapshot:', error);
        }
      }
      
      results.push(result);
    }
    
    return results;
  }
};

// Export tool with standard structure
export const showElementPickerTool = showElementPickerHandler;