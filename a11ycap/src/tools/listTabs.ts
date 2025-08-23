import { z } from 'zod';
import type { ToolHandler } from './base.js';

export const listTabsDefinition = {
  name: 'list_tabs',
  description: `List all connected browser tabs with their URLs and titles. This should be the FIRST tool used to see which browser tabs are available for automation.

Returns information about each connected browser session including:
- sessionId: Unique identifier for each tab connection
- URL: Current page URL
- Title: Page title
- Last seen timestamp

IMPORTANT: Session IDs change when users navigate to different pages. If you get "session not found" errors, re-run list_tabs to get updated session IDs.

If no tabs are connected, this tool provides instructions for connecting browsers via console injection or HTML script tags.`,
  inputSchema: {},
};

const ListTabsMessageSchema = z.object({
  id: z.string(),
  type: z.literal('list_tabs'),
  payload: z.object({}),
});

type ListTabsMessage = z.infer<typeof ListTabsMessageSchema>;

async function executeListTabs(message: ListTabsMessage): Promise<any> {
  throw new Error(
    'list_tabs is handled server-side by the MCP server, not in the browser'
  );
}

export const listTabsTool: ToolHandler<ListTabsMessage> = {
  definition: listTabsDefinition,
  messageSchema: ListTabsMessageSchema,
  execute: executeListTabs,
};
