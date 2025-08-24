import { z } from 'zod';
import { getEvents } from '../eventBuffer.js';
import type { ToolHandler } from './base.js';

// Core tool schema without sessionId (which is added by MCP server for routing)
const getConsoleLogsSchema = z.object({
  level: z
    .enum(['log', 'warn', 'error', 'info', 'debug'])
    .optional()
    .describe('Filter by log level'),
  since: z
    .number()
    .optional()
    .describe('Get logs since this timestamp (milliseconds since epoch)'),
  limit: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of logs to return (default: 100)'),
});

export const getConsoleLogsDefinition = {
  name: 'get_console_logs',
  description: 'Retrieve console logs from a connected browser',
  inputSchema: getConsoleLogsSchema.shape, // Will have sessionId added by MCP server
};

const GetConsoleLogsMessageSchema = z.object({
  id: z.string(),
  type: z.literal('get_console_logs'),
  payload: getConsoleLogsSchema,
});

type GetConsoleLogsMessage = z.infer<typeof GetConsoleLogsMessageSchema>;

export const getConsoleLogsTool: ToolHandler = {
  definition: getConsoleLogsDefinition,
  messageSchema: GetConsoleLogsMessageSchema,
  execute: async (message: GetConsoleLogsMessage) => {
    const { level, since, limit } = message.payload;

    const eventStrings = getEvents({
      type: 'console',
      level,
      since,
      limit,
    });

    if (eventStrings.length === 0) {
      return 'No console logs found';
    }

    const formattedLogs = eventStrings.map((eventStr) => {
      try {
        const event = JSON.parse(eventStr);
        const timestamp = new Date(event.timestamp).toISOString();
        const level = event.level.toUpperCase().padEnd(5);
        const args = event.args
          .map((arg: any) => {
            if (typeof arg === 'object' && arg !== null) {
              if (arg._type === 'Error') {
                return `Error: ${arg.message}`;
              }
              if (arg._type === 'HTMLElement') {
                return `<${arg.tagName}${arg.id ? ` id="${arg.id}"` : ''}>`;
              }
              return JSON.stringify(arg);
            }
            return String(arg);
          })
          .join(' ');

        return `[${timestamp}] ${level} ${args}`;
      } catch {
        return '[Invalid log entry]';
      }
    });

    return `Console logs (${eventStrings.length} entries):\n\n${formattedLogs.join('\n')}`;
  },
};
