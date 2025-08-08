import { z, type ZodRawShape } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
}

export interface ToolHandler<T = any> {
  definition: ToolDefinition;
  messageSchema: z.ZodSchema<any>;
  execute: (message: T) => Promise<any>;
}

export interface BaseToolMessage {
  id: string;
  type: string;
  payload: any;
}