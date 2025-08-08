import { z } from "zod";
import type { ToolHandler } from "./base.js";

export const selectOptionDefinition = {
  name: "select_option",
  description: "Select an option in a dropdown",
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
    values: z
      .array(z.string())
      .describe("Array of values to select in the dropdown. This can be a single value or multiple values."),
    captureSnapshot: z
      .boolean()
      .optional()
      .default(true)
      .describe("Capture accessibility snapshot after action")
  }
};

const SelectOptionMessageSchema = z.object({
  id: z.string(),
  type: z.literal('select_option'),
  payload: z.object({
    ref: z.string(),
    values: z.array(z.string()),
  })
});

type SelectOptionMessage = z.infer<typeof SelectOptionMessageSchema>;

async function executeSelectOption(message: SelectOptionMessage): Promise<any> {
  if (typeof window === 'undefined' || !window.A11yCap) {
    throw new Error('A11yCap not available');
  }

  const element = window.A11yCap.findElementByRef(message.payload.ref);
  if (!element) {
    throw new Error(`Element with ref "${message.payload.ref}" not found`);
  }

  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`Element with ref "${message.payload.ref}" is not a select element`);
  }

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
      throw new Error(`Option with value "${value}" not found in select element`);
    }
  }

  // Dispatch change event
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return { selected: true, values: selectedValues };
}

export const selectOptionTool: ToolHandler<SelectOptionMessage> = {
  definition: selectOptionDefinition,
  messageSchema: SelectOptionMessageSchema,
  execute: executeSelectOption
};