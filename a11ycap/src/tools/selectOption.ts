import { z } from 'zod';
import type { ToolHandler } from './base.js';
import {
  baseToolSchema,
  ensureInstanceOf,
  getElementByRefOrThrow,
} from './common.js';

// Core tool schema without sessionId (which is added by MCP server for routing)
const selectOptionSchema = baseToolSchema.extend({
  values: z
    .array(z.string())
    .describe(
      'Array of values to select in the dropdown. This can be a single value or multiple values.'
    ),
});

export const selectOptionDefinition = {
  name: 'select_option',
  description: 'Select an option in a dropdown',
  inputSchema: selectOptionSchema.shape, // Will have sessionId added by MCP server
};

const SelectOptionMessageSchema = z.object({
  id: z.string(),
  type: z.literal('select_option'),
  payload: selectOptionSchema, // Same schema as the core tool
});

type SelectOptionMessage = z.infer<typeof SelectOptionMessageSchema>;

async function executeSelectOption(message: SelectOptionMessage): Promise<any> {
  const rawElement = getElementByRefOrThrow(message.payload.ref);
  const element = ensureInstanceOf<HTMLSelectElement>(
    rawElement,
    [HTMLSelectElement],
    `Element with ref "${message.payload.ref}" is not a select element`
  );

  const valuesToSelect = message.payload.values;
  const selectedValues: string[] = [];

  // Clear all selections first
  for (let i = 0; i < element.options.length; i++) {
    element.options[i].selected = false;
  }

  // Select the specified values
  for (const value of valuesToSelect) {
    let found = false;
    for (let i = 0; i < element.options.length; i++) {
      const option = element.options[i];
      if (option.value === value) {
        option.selected = true;
        selectedValues.push(value);
        found = true;
        if (!element.multiple) break; // For single select, stop after first match
      }
    }
    if (!found) {
      throw new Error(
        `Option with value "${value}" not found in select element`
      );
    }
  }

  // Dispatch change event
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return `Successfully selected options [${selectedValues.join(', ')}] in element with ref "${message.payload.ref}"`;
}

export const selectOptionTool: ToolHandler<SelectOptionMessage> = {
  definition: selectOptionDefinition,
  messageSchema: SelectOptionMessageSchema,
  execute: executeSelectOption,
};
