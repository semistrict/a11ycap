import { z } from 'zod';
import type { ToolHandler } from './base.js';

// Core tool schema without browserId (which is added by MCP server for routing)
const getNetworkRequestsSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of requests to return (default: 50)'),
  includeDataUrls: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include data: URLs in the results'),
  resourceType: z
    .enum([
      'all',
      'fetch',
      'xmlhttprequest',
      'navigate',
      'script',
      'stylesheet',
      'image',
      'font',
      'other',
    ])
    .optional()
    .default('all')
    .describe('Filter by resource type'),
});

export const getNetworkRequestsDefinition = {
  name: 'get_network_requests',
  description: 'Retrieve recent network requests using the Web Performance API',
  inputSchema: getNetworkRequestsSchema.shape, // Will have browserId added by MCP server
};

const GetNetworkRequestsMessageSchema = z.object({
  id: z.string(),
  type: z.literal('get_network_requests'),
  payload: getNetworkRequestsSchema, // Same schema as the core tool
});

type GetNetworkRequestsMessage = z.infer<
  typeof GetNetworkRequestsMessageSchema
>;

async function executeGetNetworkRequests(
  message: GetNetworkRequestsMessage
): Promise<any> {
  if (typeof window === 'undefined' || !window.performance) {
    throw new Error('Performance API not available');
  }

  try {
    // Get all performance entries
    const entries = performance.getEntries();

    // Filter for network requests (resource entries)
    let networkRequests = entries
      .filter(
        (entry) =>
          entry.entryType === 'resource' || entry.entryType === 'navigation'
      )
      .map((entry) => ({
        name: entry.name,
        entryType: entry.entryType,
        startTime: Math.round(entry.startTime),
        duration: Math.round(entry.duration),
        // Add resource-specific properties if available
        ...('initiatorType' in entry && {
          initiatorType: (entry as any).initiatorType,
        }),
        ...('transferSize' in entry && {
          transferSize: (entry as any).transferSize,
        }),
        ...('encodedBodySize' in entry && {
          encodedBodySize: (entry as any).encodedBodySize,
        }),
        ...('decodedBodySize' in entry && {
          decodedBodySize: (entry as any).decodedBodySize,
        }),
        ...('responseStart' in entry && {
          responseStart: Math.round((entry as any).responseStart),
        }),
        ...('responseEnd' in entry && {
          responseEnd: Math.round((entry as any).responseEnd),
        }),
      }));

    // Filter by resource type if specified
    if (message.payload.resourceType !== 'all') {
      networkRequests = networkRequests.filter(
        (req) =>
          req.initiatorType === message.payload.resourceType ||
          req.entryType === message.payload.resourceType
      );
    }

    // Filter out data URLs if not requested
    if (!message.payload.includeDataUrls) {
      networkRequests = networkRequests.filter(
        (req) => !req.name.startsWith('data:')
      );
    }

    // Sort by start time (most recent first) and limit
    networkRequests = networkRequests
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, message.payload.limit);

    return {
      requests: networkRequests,
      totalCount: networkRequests.length,
      timestamp: Date.now(),
    };
  } catch (error) {
    throw new Error(
      `Failed to retrieve network requests: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export const getNetworkRequestsTool: ToolHandler<GetNetworkRequestsMessage> = {
  definition: getNetworkRequestsDefinition,
  messageSchema: GetNetworkRequestsMessageSchema,
  execute: executeGetNetworkRequests,
};
