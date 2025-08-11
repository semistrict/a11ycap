import { z } from 'zod';
import type { ToolHandler } from './base.js';

// We'll load Readability dynamically to avoid bundling issues
declare global {
  interface Window {
    Readability?: any;
  }
}

// Core tool schema without sessionId (which is added by MCP server for routing)
const getReadabilitySchema = z.object({
  includeContent: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include the main article content (can be very long)'),
  includeExcerpt: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include a brief excerpt of the article'),
  maxContentLength: z
    .number()
    .optional()
    .default(50000)
    .describe('Maximum length of content to return (characters)'),
});

export const getReadabilityDefinition = {
  name: 'get_readability',
  description: 'Extract readable article content from the current page using Mozilla Readability',
  inputSchema: getReadabilitySchema.shape, // Will have sessionId added by MCP server
};

const GetReadabilityMessageSchema = z.object({
  id: z.string(),
  type: z.literal('get_readability'),
  payload: getReadabilitySchema,
});

type GetReadabilityMessage = z.infer<typeof GetReadabilityMessageSchema>;

async function loadReadability(): Promise<any> {
  // Check if Readability is already loaded
  if (window.Readability) {
    return window.Readability;
  }

  // Load Readability from CDN
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@mozilla/readability@0.5.0/Readability.js';
    script.onload = () => {
      if (window.Readability) {
        resolve(window.Readability);
      } else {
        reject(new Error('Failed to load Readability library'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Readability script'));
    document.head.appendChild(script);
  });
}

async function executeGetReadability(message: GetReadabilityMessage): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('getReadability requires browser environment');
  }

  try {
    // Load Readability library
    const Readability = await loadReadability();
    
    // Clone the document to avoid modifying the original
    const documentClone = document.cloneNode(true) as Document;
    
    // Create a Readability instance
    const reader = new Readability(documentClone, {
      debug: false,
      charThreshold: 500,
    });
    
    // Parse the document
    const article = reader.parse();
    
    if (!article) {
      return 'Unable to extract readable content from this page';
    }
    
    // Prepare the result based on options
    const result: any = {
      success: true,
      url: window.location.href,
      title: article.title || document.title,
      byline: article.byline,
      dir: article.dir,
      lang: article.lang,
      length: article.length,
      siteName: article.siteName,
    };
    
    // Add excerpt if requested
    if (message.payload.includeExcerpt && article.excerpt) {
      result.excerpt = article.excerpt;
    }
    
    // Add content if requested
    if (message.payload.includeContent && article.textContent) {
      let content = article.textContent;
      
      // Truncate if necessary
      if (content.length > message.payload.maxContentLength) {
        content = content.substring(0, message.payload.maxContentLength) + '...';
        result.contentTruncated = true;
        result.originalLength = article.textContent.length;
      }
      
      result.content = content;
    }
    
    // Add HTML content for potential further processing
    if (article.content) {
      // Just include a flag that HTML is available
      result.htmlAvailable = true;
    }
    
    // Format as human-readable text
    let output = `Article: ${result.title}\nURL: ${result.url}`;
    
    if (result.byline) output += `\nAuthor: ${result.byline}`;
    if (result.siteName) output += `\nSite: ${result.siteName}`;
    if (result.length) output += `\nLength: ${result.length} characters`;
    
    if (result.excerpt) {
      output += `\n\nExcerpt:\n${result.excerpt}`;
    }
    
    if (result.content) {
      output += `\n\nContent:\n${result.content}`;
      if (result.contentTruncated) {
        output += `\n\n[Content truncated from ${result.originalLength} characters]`;
      }
    }
    
    return output;
  } catch (error) {
    throw new Error(
      `Failed to extract readable content: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export const getReadabilityTool: ToolHandler<GetReadabilityMessage> = {
  definition: getReadabilityDefinition,
  messageSchema: GetReadabilityMessageSchema,
  execute: executeGetReadability,
};