import { z } from 'zod';
import type { ToolHandler } from './base.js';

// Core tool schema without sessionId (which is added by MCP server for routing)
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
  description: `Retrieve recent network requests using the Web Performance API. Returns detailed information about HTTP requests made by the page including timing, size, and type data.

Example output:
\`\`\`
Network requests (8 entries):

FETCH https://api.example.com/users (245ms) [2KB]
SCRIPT https://cdn.example.com/js/analytics.js (156ms) [45KB]
STYLESHEET https://fonts.googleapis.com/css2?family=Inter (89ms) [12KB]
IMAGE https://images.example.com/logo.png (67ms) [8KB]
XMLHTTPREQUEST https://api.example.com/data (423ms) [156KB]
FONT https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2 (234ms) [34KB]
NAVIGATE https://example.com/dashboard (1203ms) [89KB]
OTHER https://example.com/manifest.json (12ms) [1KB]
\`\`\`

Each entry shows:
- HTTP method/type (FETCH, SCRIPT, STYLESHEET, IMAGE, etc.)
- Full URL of the request
- Duration in milliseconds (if available)
- Transfer size in KB (if available)

Useful for debugging API calls, monitoring performance, analyzing resource loading, and understanding network traffic patterns.`,
  inputSchema: getNetworkRequestsSchema.shape, // Will have sessionId added by MCP server
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

    if (networkRequests.length === 0) {
      return 'No network requests found';
    }

    const formattedRequests = networkRequests.map((req) => {
      const method = req.initiatorType
        ? req.initiatorType.toUpperCase()
        : 'GET';
      const duration = req.duration ? ` (${Math.round(req.duration)}ms)` : '';
      const size = req.transferSize
        ? ` [${Math.round(req.transferSize / 1024)}KB]`
        : '';
      return `${method} ${req.name}${duration}${size}`;
    });

    return `Network requests (${networkRequests.length} entries):\n\n${formattedRequests.join('\n')}`;
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
