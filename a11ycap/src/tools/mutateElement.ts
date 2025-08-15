import { z } from 'zod';
import type { ToolHandler } from './base.js';
import {
  getElementByRefOrThrow,
  multiElementToolSchema,
  resolveTargetElements,
} from './common.js';

const mutateElementSchema = multiElementToolSchema.extend({
  // Support legacy single ref for backward compatibility
  ref: z
    .string()
    .optional()
    .describe(
      'Element reference from snapshot (e.g., "e5") - legacy, use refs instead'
    ),
  attributes: z
    .record(z.string(), z.union([z.string(), z.null()]))
    .optional()
    .describe('Attributes to set or remove. Use null to remove an attribute'),
  properties: z
    .record(z.string(), z.any())
    .optional()
    .describe('DOM properties to set (e.g., value, checked, selected)'),
  styles: z
    .record(z.string(), z.union([z.string(), z.null()]))
    .optional()
    .describe('CSS styles to set or remove. Use null to remove a style'),
  textContent: z
    .string()
    .optional()
    .describe('Set the text content of the element'),
  innerHTML: z
    .string()
    .optional()
    .describe('Set the innerHTML of the element (use with caution)'),
  add_classes: z
    .array(z.string())
    .optional()
    .describe('CSS classes to add to the element'),
  remove_classes: z
    .array(z.string())
    .optional()
    .describe('CSS classes to remove from the element'),
});

export const mutateElementDefinition = {
  name: 'mutate_element',
  description:
    'Modify attributes, properties, styles, or content of one or more elements',
  inputSchema: mutateElementSchema.shape,
};

const MutateElementMessageSchema = z.object({
  id: z.string(),
  type: z.literal('mutate_element'),
  payload: mutateElementSchema,
});

type MutateElementMessage = z.infer<typeof MutateElementMessageSchema>;

interface MutationResult {
  success: boolean;
  ref: string;
  changes: {
    attributes?: Record<string, { from: string | null; to: string | null }>;
    properties?: Record<string, { from: any; to: any }>;
    styles?: Record<string, { from: string; to: string | null }>;
    textContent?: { from: string | null; to: string };
    innerHTML?: { from: string; to: string };
    classes?: {
      added: string[];
      removed: string[];
      from: string;
      to: string;
    };
  };
  errors?: string[];
}

interface MultiMutationResult {
  success: boolean;
  totalElements: number;
  results: MutationResult[];
}

function mutateSingleElement(
  element: Element,
  ref: string,
  payload: z.infer<typeof mutateElementSchema>
): MutationResult {
  const htmlElement = element as HTMLElement;
  const result: MutationResult = {
    success: true,
    ref,
    changes: {},
    errors: [],
  };

  try {
    // Mutate attributes
    if (payload.attributes) {
      const attributeChanges: Record<
        string,
        { from: string | null; to: string | null }
      > = {};

      for (const [attrName, attrValue] of Object.entries(payload.attributes)) {
        try {
          const currentValue = element.getAttribute(attrName);

          if (attrValue === null) {
            // Remove attribute
            element.removeAttribute(attrName);
            attributeChanges[attrName] = { from: currentValue, to: null };
          } else {
            // Set attribute
            element.setAttribute(attrName, attrValue);
            attributeChanges[attrName] = { from: currentValue, to: attrValue };
          }
        } catch (error) {
          result.errors?.push(
            `Failed to set attribute '${attrName}': ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      if (Object.keys(attributeChanges).length > 0) {
        result.changes.attributes = attributeChanges;
      }
    }

    // Mutate DOM properties
    if (payload.properties) {
      const propertyChanges: Record<string, { from: any; to: any }> = {};

      for (const [propName, propValue] of Object.entries(payload.properties)) {
        try {
          const currentValue = (element as any)[propName];
          (element as any)[propName] = propValue;
          propertyChanges[propName] = { from: currentValue, to: propValue };
        } catch (error) {
          result.errors?.push(
            `Failed to set property '${propName}': ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      if (Object.keys(propertyChanges).length > 0) {
        result.changes.properties = propertyChanges;
      }
    }

    // Mutate styles
    if (payload.styles) {
      const styleChanges: Record<string, { from: string; to: string | null }> =
        {};

      for (const [styleName, styleValue] of Object.entries(payload.styles)) {
        try {
          const currentValue = htmlElement.style.getPropertyValue(styleName);

          if (styleValue === null) {
            // Remove style
            htmlElement.style.removeProperty(styleName);
            styleChanges[styleName] = { from: currentValue, to: null };
          } else {
            // Set style
            htmlElement.style.setProperty(styleName, styleValue);
            styleChanges[styleName] = { from: currentValue, to: styleValue };
          }
        } catch (error) {
          result.errors?.push(
            `Failed to set style '${styleName}': ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      if (Object.keys(styleChanges).length > 0) {
        result.changes.styles = styleChanges;
      }
    }

    // Set textContent
    if (payload.textContent !== undefined) {
      const currentTextContent = element.textContent;
      element.textContent = payload.textContent;
      result.changes.textContent = {
        from: currentTextContent,
        to: payload.textContent,
      };
    }

    // Set innerHTML
    if (payload.innerHTML !== undefined) {
      const currentInnerHTML = element.innerHTML;
      element.innerHTML = payload.innerHTML;
      result.changes.innerHTML = {
        from: currentInnerHTML,
        to: payload.innerHTML,
      };
    }

    // Handle CSS class modifications
    if (payload.add_classes || payload.remove_classes) {
      const currentClassName = element.className;
      const classList = element.classList;
      const addedClasses: string[] = [];
      const removedClasses: string[] = [];

      try {
        // Add classes
        if (payload.add_classes) {
          for (const className of payload.add_classes) {
            if (!classList.contains(className)) {
              classList.add(className);
              addedClasses.push(className);
            }
          }
        }

        // Remove classes
        if (payload.remove_classes) {
          for (const className of payload.remove_classes) {
            if (classList.contains(className)) {
              classList.remove(className);
              removedClasses.push(className);
            }
          }
        }

        // Only record changes if something actually changed
        if (addedClasses.length > 0 || removedClasses.length > 0) {
          result.changes.classes = {
            added: addedClasses,
            removed: removedClasses,
            from: currentClassName,
            to: element.className,
          };
        }
      } catch (error) {
        result.errors?.push(
          `Failed to modify CSS classes: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Check if any errors occurred
    if (result.errors && result.errors.length > 0) {
      result.success = false;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      ref,
      changes: {},
      errors: [
        `Failed to mutate element: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
  }
}

async function executeMutateElement(
  message: MutateElementMessage
): Promise<MutationResult | MultiMutationResult> {
  // Handle legacy single ref
  if (message.payload.ref) {
    const element = getElementByRefOrThrow(message.payload.ref);
    return mutateSingleElement(element, message.payload.ref, message.payload);
  }

  // Handle new multi-element targeting
  const elements = resolveTargetElements(message.payload);

  // If only one element, return single result for consistency
  if (elements.length === 1) {
    const ref = message.payload.refs?.[0] || `element_${Date.now()}`;
    return mutateSingleElement(elements[0], ref, message.payload);
  }

  // Multiple elements, return multi-result
  const results: MutationResult[] = [];
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const ref = message.payload.refs?.[i] || `element_${Date.now()}_${i}`;
    const result = mutateSingleElement(element, ref, message.payload);
    results.push(result);
  }

  const overallSuccess = results.every((r) => r.success);

  return {
    success: overallSuccess,
    totalElements: elements.length,
    results,
  };
}

export const mutateElementTool: ToolHandler<MutateElementMessage> = {
  definition: mutateElementDefinition,
  messageSchema: MutateElementMessageSchema,
  execute: executeMutateElement,
};
