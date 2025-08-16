import { z } from 'zod';

// Standardized element targeting schema that all tools should use
export const elementTargetingSchema = z.object({
  element: z
    .string()
    .optional()
    .describe(
      'Human-readable element description used to obtain permission to interact with the element'
    ),
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
      'CSS selector to target multiple elements (e.g., ".button", "div[data-test]")'
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
      'Bounding box to capture elements fully contained within (coordinates relative to viewport)'
    ),
});

// Legacy single-element schema for backward compatibility
export const baseToolSchema = z.object({
  element: z
    .string()
    .describe(
      'Human-readable element description used to obtain permission to interact with the element'
    ),
  ref: z.string().describe('Element reference from snapshot (e.g., "e5")'),
  captureSnapshot: z
    .boolean()
    .optional()
    .default(true)
    .describe('Capture accessibility snapshot after action'),
});

// Extended schema that combines element targeting with standard options
export const multiElementToolSchema = elementTargetingSchema.extend({
  captureSnapshot: z
    .boolean()
    .optional()
    .default(true)
    .describe('Capture accessibility snapshot after action'),
});

export function ensureA11yCap(): any {
  if (typeof window === 'undefined' || !window.A11yCap) {
    throw new Error('A11yCap not available');
  }
  return window.A11yCap;
}

export function getElementByRefOrThrow(ref: string): Element {
  const a11y = ensureA11yCap();
  const element = a11y.findElementByRef(ref);
  if (!element) {
    throw new Error(`Element with ref "${ref}" not found`);
  }
  return element;
}

// Type for element targeting options
type ElementTargetingOptions = {
  refs?: string[];
  selector?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  element?: string; // For permission description
};

/**
 * Resolve elements based on targeting options (refs, selector, or boundingBox)
 * Returns array of elements found
 */
export function resolveTargetElements(
  options: ElementTargetingOptions
): Element[] {
  const elements: Element[] = [];

  // Handle refs (specific element references)
  if (options.refs && options.refs.length > 0) {
    for (const ref of options.refs) {
      try {
        const element = getElementByRefOrThrow(ref);
        elements.push(element);
      } catch (error) {
        // Continue with other refs, but note the error
        console.warn(`Failed to find element with ref "${ref}":`, error);
      }
    }
  }

  // Handle CSS selector
  if (options.selector) {
    try {
      const selectedElements = Array.from(
        document.querySelectorAll(options.selector)
      );
      elements.push(...selectedElements);
    } catch (error) {
      throw new Error(
        `Invalid CSS selector "${options.selector}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Handle bounding box
  if (options.boundingBox) {
    const bbox = options.boundingBox;
    const allElements = Array.from(document.querySelectorAll('*'));
    const elementsInBounds = allElements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left >= bbox.x &&
        rect.top >= bbox.y &&
        rect.right <= bbox.x + bbox.width &&
        rect.bottom <= bbox.y + bbox.height &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    elements.push(...elementsInBounds);
  }

  // Remove duplicates
  const uniqueElements = Array.from(new Set(elements));

  if (uniqueElements.length === 0) {
    throw new Error('No elements found with the provided targeting options');
  }

  return uniqueElements;
}

/**
 * Resolve a single element (for tools that only work with one element)
 * Throws if multiple elements found
 */
export function resolveSingleTargetElement(
  options: ElementTargetingOptions
): Element {
  const elements = resolveTargetElements(options);

  if (elements.length > 1) {
    throw new Error(
      `Multiple elements found (${elements.length}), but this tool only works with a single element. Use more specific targeting.`
    );
  }

  return elements[0];
}

export function ensureInstanceOf<T extends Element>(
  element: Element,
  allowed: Array<new (...args: any[]) => T>,
  errorMessage: string
): T {
  const ok = allowed.some((Cls) => element instanceof Cls);
  if (!ok) {
    throw new Error(errorMessage);
  }
  return element as T;
}
