import { describe, test, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

describe('Debug MCP Server Startup', () => {
  test('can start a single MCP server', async () => {
    const serverPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');
    
    console.log('Server path:', serverPath);
    
    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        ...process.env,
        PORT: '12458',
        NODE_ENV: 'test'
      },
      stderr: 'inherit' // Show server errors in test output
    });
    
    const client = new Client({
      name: 'debug-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    // Set up error handlers
    let connectError: any = null;
    
    try {
      console.log('Attempting to connect...');
      await client.connect(transport);
      console.log('Connected successfully');
      
      // Try listing tools
      console.log('Listing tools...');
      try {
        const tools = await client.listTools();
        console.log('Available tools:', tools.tools.map(t => t.name));
        
        // Check if we can call list_tabs
        console.log('Calling list_tabs...');
        const result = await client.callTool({ name: 'list_tabs', arguments: {} });
        console.log('list_tabs result:', result);
      } catch (toolError) {
        console.error('Tool operation failed:', toolError);
        throw toolError;
      }
      
    } catch (error) {
      connectError = error;
      console.error('Connection failed:', error);
    } finally {
      try {
        await transport.close();
        console.log('Transport closed successfully');
      } catch (error) {
        console.error('Error closing transport:', error);
      }
    }
    
    // The test should pass if we can connect, even if there are no browsers
    expect(connectError).toBe(null);
  }, 10000);
});