import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express, Request, Response } from "express";
import { log } from "../logging.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Set up routes to serve the a11ycap library for browser console injection
 */
export function setupLibraryRoutes(app: Express) {
  // Serve the a11ycap browser bundle
  app.get("/a11ycap.js", async (req: Request, res: Response) => {
    try {
      // Read the browser bundle (IIFE format)
      const browserBundlePath = path.resolve(
        __dirname,
        "../../../a11ycap/dist/browser.js",
      );
      const browserBundle = await fs.readFile(browserBundlePath, "utf-8");

      // Get server details for WebSocket connection
      const protocol =
        req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
      const host = req.get("host") || "localhost:12456";
      const wsProtocol = protocol === "https" ? "wss" : "ws";
      const wsUrl = `${wsProtocol}://${host}/browser-ws`;

        // Use the new enhanced library with built-in MCP connection
      const enhancedBundle = `
// Handle Trusted Types for CSP compatibility
if (typeof window !== 'undefined' && window.trustedTypes) {
  window.trustedTypes.createPolicy('a11ycap-injection', {
    createScript: (script) => script
  });
}

${browserBundle}

// Initialize MCP WebSocket connection using the library's built-in functionality
if (typeof window !== 'undefined' && window.A11yCap) {
  // Check if already connected to prevent duplicate connections
  if (window.__a11ycap_mcp_connected) {
    console.log('🐱 A11yCap already connected to MCP server, skipping duplicate connection');
  } else {
    console.log('🐱 A11yCap loaded with enhanced MCP support');
    
    // Initialize WebSocket connection to MCP server
    const mcpClient = window.A11yCap.initializeMCPConnection('${wsUrl}');
    
    // Mark as connected to prevent duplicate connections
    window.__a11ycap_mcp_connected = true;
    
    console.log('🐱 a11ycap initialized! Try: window.A11yCap.snapshotForAI(document.body)');
  }
}`;

      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
      res.send(enhancedBundle);
    } catch (error) {
      log.error("Error serving a11ycap library:", error);
      res.status(500).send("// Error loading a11ycap library");
    }
  });

  // Alias for the library
  app.get("/a11ycap.min.js", async (_req: Request, res: Response) => {
    // Redirect to main endpoint
    res.redirect("/a11ycap.js");
  });

  // Serve library info
  app.get("/library-info", (_req: Request, res: Response) => {
    res.json({
      name: "a11ycap",
      version: "1.0.0",
      description: "Accessibility snapshot library for AI-powered testing",
      usage: {
        console: "fetch('/a11ycap.js').then(r=>r.text()).then(eval)",
        manual: "window.A11yCap.snapshotForAI(document.body)",
        tools: [
          "snapshotForAI(element, options?)",
          "snapshot(element, options?)",
          "clickRef(ref)",
          "findElementByRef(ref)",
          "extractReactInfo(element)",
          "generateAriaTree(element, options?)",
          "renderAriaTree(tree, options?)",
        ],
      },
      endpoints: {
        library: "/a11ycap.js",
        info: "/library-info",
        health: "/health",
      },
    });
  });

  // Serve a simple test page that demonstrates the library
  app.get("/demo", (_req: Request, res: Response) => {
    const demoHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>a11ycap Demo</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    button { margin: 10px; padding: 10px 20px; }
    .demo-section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
    pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>a11ycap Library Demo</h1>
  
  <div class="demo-section">
    <h2>Interactive Elements</h2>
    <button id="demo-button" onclick="alert('Button clicked!')">Click Me</button>
    <button disabled>Disabled Button</button>
    <input type="text" placeholder="Enter text" aria-label="Demo input">
    <select aria-label="Demo select">
      <option>Option 1</option>
      <option>Option 2</option>
    </select>
  </div>

  <div class="demo-section">
    <h2>Form Elements</h2>
    <form>
      <label for="email">Email:</label>
      <input type="email" id="email" name="email" required>
      
      <fieldset>
        <legend>Preferences</legend>
        <label><input type="checkbox" name="newsletter"> Subscribe to newsletter</label>
        <label><input type="radio" name="theme" value="light"> Light theme</label>
        <label><input type="radio" name="theme" value="dark"> Dark theme</label>
      </fieldset>
    </form>
  </div>

  <div class="demo-section">
    <h2>Try a11ycap</h2>
    <p>Open your browser console and run:</p>
    <pre>fetch('/a11ycap.js').then(r=>r.text()).then(eval)</pre>
    <p>Then try:</p>
    <pre>window.A11yCap.snapshotForAI(document.body)</pre>
    <button onclick="runDemo()">Run Demo in Console</button>
  </div>

  <script>
    async function runDemo() {
      try {
        // Load the library
        const response = await fetch('/a11ycap.js');
        const code = await response.text();
        eval(code);
        
        // Take a snapshot
        const snapshot = window.A11yCap.snapshotForAI(document.body);
        console.log('Demo snapshot:', snapshot);
        
        alert('Demo complete! Check the console for the snapshot.');
      } catch (error) {
        console.error('Demo error:', error);
        alert('Demo failed. Check console for errors.');
      }
    }
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(demoHtml);
  });
}
