import { z } from 'zod';
import type { ToolHandler } from './base.js';
import { type ElementInfo, generateElementInfo } from './getElementInfo.js';

const getPickedElementsSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of picked elements to return'),
  since: z
    .number()
    .optional()
    .describe(
      'Get picked elements since this timestamp (milliseconds since epoch)'
    ),
});

export const getPickedElementsDefinition = {
  name: 'get_picked_elements',
  description:
    'Retrieve elements that were picked using the triple-ESC element picker for the current page',
  inputSchema: getPickedElementsSchema.shape,
};

const GetPickedElementsMessageSchema = z.object({
  id: z.string(),
  type: z.literal('get_picked_elements'),
  payload: getPickedElementsSchema,
});

type GetPickedElementsMessage = z.infer<typeof GetPickedElementsMessageSchema>;

// Generate page UUID from URL hash (same logic as in index.ts)
function generatePageUUID(): string {
  if (typeof window === 'undefined') return '';
  const url = window.location.href;
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

async function executeGetPickedElements(
  message: GetPickedElementsMessage
): Promise<any> {
  if (message.type !== 'get_picked_elements') {
    throw new Error('Invalid message type for getPickedElements handler');
  }

  const currentPageUUID = generatePageUUID();

  // Get all elements with the picked class
  const pickedElements = Array.from(document.querySelectorAll('.a11ycap-picked'));

  // Apply limit
  const limit = message.payload.limit || 50;
  const limitedElements = pickedElements.slice(0, limit);

  // Get detailed element information for each picked element
  const detailedElements = limitedElements.map((element) => {
    // Don't provide a fallback ref - let generateElementInfo handle it
    return generateElementInfo(element as Element);
  });

  // Return just the array of ElementInfo objects, same as get_element_info
  return detailedElements;
}

export const getPickedElementsTool: ToolHandler<GetPickedElementsMessage> = {
  definition: getPickedElementsDefinition,
  messageSchema: GetPickedElementsMessageSchema,
  execute: executeGetPickedElements,
};
