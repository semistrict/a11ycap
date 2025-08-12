import { z } from 'zod';
import type { ToolHandler } from './base.js';
import { baseToolSchema, ensureA11yCap } from './common.js';
import { toPng } from 'html-to-image';

// Core tool schema without sessionId (which is added by MCP server for routing)
const captureElementImageSchema = baseToolSchema.extend({
  quality: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.92)
    .describe('Image quality for JPEG format (0-1)'),
  backgroundColor: z
    .string()
    .optional()
    .describe('Background color for the image (CSS color)'),
  width: z
    .number()
    .optional()
    .describe('Width of the captured image'),
  height: z
    .number()
    .optional()
    .describe('Height of the captured image'),
  cacheBust: z
    .boolean()
    .optional()
    .default(false)
    .describe('Add cache busting to avoid CORS issues'),
});

export const captureElementImageDefinition = {
  name: 'capture_element_image',
  description: 'Capture a PNG image of an element using its accessibility snapshot reference. Uses html-to-image library and may not be pixel-perfect compared to browser screenshots.',
  inputSchema: captureElementImageSchema.shape, // Will have sessionId added by MCP server
};

const CaptureElementImageMessageSchema = z.object({
  id: z.string(),
  type: z.literal('capture_element_image'),
  payload: captureElementImageSchema,
});

type CaptureElementImageMessage = z.infer<typeof CaptureElementImageMessageSchema>;

async function executeCaptureElementImage(message: CaptureElementImageMessage): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('captureElementImage requires browser environment');
  }

  ensureA11yCap();

  const element = window.A11yCap.findElementByRef(message.payload.ref) as HTMLElement;
  if (!element) {
    throw new Error(`Element with ref "${message.payload.ref}" not found`);
  }

  const options = {
    quality: message.payload.quality,
    backgroundColor: message.payload.backgroundColor,
    width: message.payload.width,
    height: message.payload.height,
    cacheBust: message.payload.cacheBust,
  };

  // Remove undefined values
  Object.keys(options).forEach(key => {
    if (options[key as keyof typeof options] === undefined) {
      delete options[key as keyof typeof options];
    }
  });

  try {
    const dataUrl = await toPng(element, options);
    
    // Extract base64 data from data URL (remove "data:image/png;base64," prefix)
    const base64Data = dataUrl.split(',')[1];
    
    return {
      format: 'png',
      base64Data,
      element: message.payload.element,
      ref: message.payload.ref,
    };
  } catch (error) {
    throw new Error(
      `Failed to capture image: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export const captureElementImageTool: ToolHandler<CaptureElementImageMessage> = {
  definition: captureElementImageDefinition,
  messageSchema: CaptureElementImageMessageSchema,
  execute: executeCaptureElementImage,
};