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
  description: `Retrieve elements that were picked using the visual element picker. Returns full element information for previously selected elements.

IMPORTANT: Elements must be picked first using the Element Picker. The user can pick elements by:
1. Press **ESC three times** to open the A11yCap Tools menu
2. Click "🎯 Element Picker" 
3. The picker overlay will activate - user can click on any elements on the page
4. Multiple elements can be selected by clicking different parts of the page
5. Press ESC to exit the picker when done

This tool returns the same detailed ElementInfo data as get_element_info, but only for elements that were previously picked by the user through the visual interface. Each picked element includes:

- Basic properties (tagName, id, className, text content)
- Complete accessibility information (ARIA attributes, computed names, roles)
- Visual styling and geometry data
- Element state and form properties
- Parent/child/sibling relationships
- React component information (when available)
- Event handlers and interaction capabilities

Perfect for getting detailed information about specific elements the user has visually identified and selected, without needing to know refs or write CSS selectors.`,
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
  const pickedElements = Array.from(
    document.querySelectorAll('.a11ycap-picked')
  );

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
