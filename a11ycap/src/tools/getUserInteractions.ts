/**
 * Tool for retrieving user interaction events from the buffer
 */

import { z } from 'zod';
import { type InteractionEvent, getEvents } from '../eventBuffer.js';
import type { ToolHandler } from './base.js';

// Core tool schema without sessionId (which is added by MCP server for routing)
const getUserInteractionsSchema = z.object({
  type: z
    .string()
    .optional()
    .describe(
      'Filter by interaction type (click, input, change, keydown, navigation, focus, blur)'
    ),
  since: z
    .number()
    .optional()
    .describe(
      'Get interactions since this timestamp (milliseconds since epoch)'
    ),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of interactions to return (default: 100)'),
});

export const getUserInteractionsDefinition = {
  name: 'get_user_interactions',
  description: `Retrieve recorded user interaction events from the buffer. Shows chronological history of user actions on the page.

IMPORTANT: User interactions must be recorded first. The user can start recording by:
1. Press **ESC three times** to open the A11yCap Tools menu
2. Click "🔴 Interaction Recorder" 
3. The recorder will automatically start capturing interactions
4. User can then perform actions (click, type, navigate) which will be recorded

Example output after user clicks, types, and navigates:
\`\`\`
User Interactions (5 events):
[2023-08-23T15:30:45.123Z] Click on BUTTON[e2] at (150, 200)
[2023-08-23T15:30:46.456Z] Type in INPUT#email (email): "user@example.com"
[2023-08-23T15:30:47.789Z] Key press Tab on INPUT#email
[2023-08-23T15:30:48.012Z] Focus INPUT#password
[2023-08-23T15:30:50.345Z] Navigation (pushstate) to https://example.com/dashboard
\`\`\`

Interaction types captured:
- **click**: Element clicks with coordinates and modifier keys
- **input/change**: Text input with target element and values
- **keydown**: Keyboard events with keys and modifiers  
- **focus/blur**: Element focus changes
- **navigation**: Page navigation (back/forward, pushstate, etc.)

Each event includes timestamp, target element (with refs when available), and relevant interaction data. Perfect for understanding user behavior patterns, debugging UI interactions, and analyzing user workflows.`,
  inputSchema: getUserInteractionsSchema.shape, // Will have sessionId added by MCP server
};

const GetUserInteractionsMessageSchema = z.object({
  id: z.string(),
  type: z.literal('get_user_interactions'),
  payload: getUserInteractionsSchema,
});

type GetUserInteractionsMessage = z.infer<
  typeof GetUserInteractionsMessageSchema
>;

export async function execute(
  message: GetUserInteractionsMessage
): Promise<string> {
  const { type, since, limit = 100 } = message.payload;

  // Get interaction events (filter out console events)
  const allEventStrings = getEvents({ since, limit: limit * 2 }); // Get more to ensure we have enough after filtering
  const interactionStrings = allEventStrings.filter((eventStr) => {
    try {
      const event = JSON.parse(eventStr);
      return event.type !== 'console';
    } catch {
      return false;
    }
  });

  // Further filter by specific interaction type if requested
  let filteredInteractionStrings = interactionStrings;
  if (type) {
    filteredInteractionStrings = interactionStrings.filter((eventStr) => {
      try {
        const event = JSON.parse(eventStr);
        return event.type === type;
      } catch {
        return false;
      }
    });
  }

  // Apply final limit
  const finalInteractionStrings = filteredInteractionStrings.slice(-limit);

  if (finalInteractionStrings.length === 0) {
    return 'No user interactions recorded';
  }

  // Format interactions for human reading
  const formatted = finalInteractionStrings.map((eventStr) => {
    try {
      const interaction = JSON.parse(eventStr);
      const timestamp = new Date(interaction.timestamp).toISOString();

      switch (interaction.type) {
        case 'click': {
          const target = interaction.target.ariaRef
            ? `${interaction.target.tagName}[${interaction.target.ariaRef}]`
            : interaction.target.id
              ? `${interaction.target.tagName}#${interaction.target.id}`
              : `${interaction.target.tagName}`;

          const coords = interaction.coordinates
            ? ` at (${interaction.coordinates.x}, ${interaction.coordinates.y})`
            : '';

          const metaKeys = Object.entries(interaction.metaKeys)
            .filter(([_, pressed]) => pressed)
            .map(([key, _]) => key)
            .join('+');

          const modifiers = metaKeys ? ` with ${metaKeys}` : '';

          return `[${timestamp}] Click on ${target}${coords}${modifiers}`;
        }

        case 'input':
        case 'change': {
          const inputTarget = interaction.target.ariaRef
            ? `${interaction.target.tagName}[${interaction.target.ariaRef}]`
            : interaction.target.id
              ? `${interaction.target.tagName}#${interaction.target.id}`
              : `${interaction.target.tagName}`;

          const inputType = interaction.target.inputType
            ? ` (${interaction.target.inputType})`
            : '';
          const value =
            interaction.value.length > 50
              ? `${interaction.value.slice(0, 50)}...`
              : interaction.value;

          return `[${timestamp}] ${interaction.type === 'input' ? 'Type' : 'Change'} in ${inputTarget}${inputType}: "${value}"`;
        }

        case 'keydown': {
          const keyTarget = interaction.target.ariaRef
            ? `${interaction.target.tagName}[${interaction.target.ariaRef}]`
            : interaction.target.id
              ? `${interaction.target.tagName}#${interaction.target.id}`
              : `${interaction.target.tagName}`;

          const keyMetaKeys = Object.entries(interaction.metaKeys)
            .filter(([_, pressed]) => pressed)
            .map(([key, _]) => key)
            .join('+');

          const keyModifiers = keyMetaKeys ? `${keyMetaKeys}+` : '';

          return `[${timestamp}] Key press ${keyModifiers}${interaction.key} on ${keyTarget}`;
        }

        case 'navigation': {
          const method = interaction.method;
          const from =
            interaction.from !== interaction.to
              ? ` from ${interaction.from}`
              : '';
          return `[${timestamp}] Navigation (${method})${from} to ${interaction.to}`;
        }

        case 'focus':
        case 'blur': {
          const focusTarget = interaction.target.ariaRef
            ? `${interaction.target.tagName}[${interaction.target.ariaRef}]`
            : interaction.target.id
              ? `${interaction.target.tagName}#${interaction.target.id}`
              : `${interaction.target.tagName}`;

          return `[${timestamp}] ${interaction.type === 'focus' ? 'Focus' : 'Blur'} ${focusTarget}`;
        }

        default:
          return `[${timestamp}] ${interaction.type}: ${JSON.stringify(interaction)}`;
      }
    } catch {
      return '[Invalid interaction entry]';
    }
  });

  const header = `User Interactions (${finalInteractionStrings.length} events):`;
  return [header, ...formatted].join('\n');
}

export const getUserInteractionsTool: ToolHandler = {
  definition: getUserInteractionsDefinition,
  messageSchema: GetUserInteractionsMessageSchema,
  execute,
};
