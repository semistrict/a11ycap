import { z } from 'zod';

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
    .describe('Capture accessibility snapshot after action')
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
