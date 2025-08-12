import { z } from 'zod';
import type { ToolHandler } from './base.js';
import { getEvents } from '../eventBuffer.js';

const getPickedElementsSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of picked elements to return'),
  since: z
    .number()
    .optional()
    .describe('Get picked elements since this timestamp (milliseconds since epoch)'),
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
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

async function executeGetPickedElements(message: GetPickedElementsMessage): Promise<any> {
  if (message.type !== 'get_picked_elements') {
    throw new Error('Invalid message type for getPickedElements handler');
  }

  const currentPageUUID = generatePageUUID();
  const allEventStrings = getEvents();
  
  // Parse and filter for element_picked events for the current page
  let pickedElements = allEventStrings.filter((eventStr: string) => {
    try {
      const event = JSON.parse(eventStr);
      return event.type === 'element_picked' && event.pageUUID === currentPageUUID;
    } catch {
      return false;
    }
  }).map((eventStr: string) => JSON.parse(eventStr));

  // Filter by timestamp if specified
  if (message.payload.since) {
    pickedElements = pickedElements.filter((event: any) => 
      event.timestamp >= message.payload.since!
    );
  }

  // Limit results
  const limit = message.payload.limit || 50;
  pickedElements = pickedElements.slice(-limit); // Get most recent

  // Return summary information
  const summary = pickedElements.map((event: any) => ({
    timestamp: new Date(event.timestamp).toISOString(),
    ref: event.element?.ref || 'unknown',
    tagName: event.element?.tagName || 'unknown',
    textContent: event.element?.textContent || '',
    selector: event.element?.selector || 'unknown',
    snapshot: event.element?.snapshot || ''
  }));

  return {
    pageUUID: currentPageUUID,
    currentUrl: typeof window !== 'undefined' ? window.location.href : '',
    totalPicked: pickedElements.length,
    elements: summary
  };
}

export const getPickedElementsTool: ToolHandler<GetPickedElementsMessage> = {
  definition: getPickedElementsDefinition,
  messageSchema: GetPickedElementsMessageSchema,
  execute: executeGetPickedElements,
};