import { z } from 'zod';
import type { ToolHandler } from './base.js';

export const listTabsDefinition = {
  name: 'list_tabs',
  description: 'List all connected browser tabs with their URLs and titles',
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
