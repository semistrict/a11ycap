/**
 * Logging utility for MCP server
 * 
 * Uses MCP protocol logging via sendLoggingMessage when available,
 * falls back to stderr for startup/shutdown logging.
 */

import process from "node:process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

let mcpServer: McpServer | null = null;
let currentLogLevel: "debug" | "info" | "warning" | "error" = "info";

export function initializeLogging(server: McpServer) {
  mcpServer = server;
}

export function setLogLevel(level: "debug" | "info" | "warning" | "error") {
  currentLogLevel = level;
}

function shouldLog(messageLevel: "debug" | "info" | "warning" | "error"): boolean {
  const levels = ["debug", "info", "warning", "error"];
  const currentIndex = levels.indexOf(currentLogLevel);
  const messageIndex = levels.indexOf(messageLevel);
  return messageIndex >= currentIndex;
}

export const log = {
  info: async (message: string, data?: any) => {
    if (!shouldLog("info")) return;
    
    if (mcpServer) {
      try {
        await mcpServer.server.sendLoggingMessage({
          level: "info",
          data: data ? { message, data } : message,
        });
      } catch {
        // Fallback to stderr if MCP logging fails
        process.stderr.write(`ℹ️  ${message}\n`);
      }
    } else {
      // No MCP server available, use stderr
      process.stderr.write(`ℹ️  ${message}\n`);
    }
  },
  
  error: async (message: string, data?: any) => {
    if (!shouldLog("error")) return;
    
    if (mcpServer) {
      try {
        await mcpServer.server.sendLoggingMessage({
          level: "error", 
          data: data ? { message, data } : message,
        });
      } catch {
        // Fallback to stderr if MCP logging fails
        process.stderr.write(`❌ ${message}\n`);
      }
    } else {
      // No MCP server available, use stderr
      process.stderr.write(`❌ ${message}\n`);
    }
  },
  
  warn: async (message: string, data?: any) => {
    if (!shouldLog("warning")) return;
    
    if (mcpServer) {
      try {
        await mcpServer.server.sendLoggingMessage({
          level: "warning",
          data: data ? { message, data } : message,
        });
      } catch {
        // Fallback to stderr if MCP logging fails
        process.stderr.write(`⚠️  ${message}\n`);
      }
    } else {
      // No MCP server available, use stderr
      process.stderr.write(`⚠️  ${message}\n`);
    }
  },
  
  debug: async (message: string, data?: any) => {
    if (!shouldLog("debug")) return;
    
    if (mcpServer) {
      try {
        await mcpServer.server.sendLoggingMessage({
          level: "debug",
          data: data ? { message, data } : message,
        });
      } catch {
        // Fallback to stderr if MCP logging fails
        if (process.env.DEBUG) {
          process.stderr.write(`🐛 ${message}\n`);
        }
      }
    } else if (process.env.DEBUG) {
      // No MCP server available, use stderr only in debug mode
      process.stderr.write(`🐛 ${message}\n`);
    }
  }
};