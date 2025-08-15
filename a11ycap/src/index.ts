// Browser-compatible entry point

import { generateAriaTree, renderAriaTree } from './ariaSnapshot';
import { ElementPicker, getElementPicker } from './elementPicker';
import { extractReactInfo } from './reactUtils';

// Re-export the browser-compatible ariaSnapshot functionality
export { generateAriaTree, renderAriaTree, extractReactInfo };
export type { AriaSnapshot, AriaTreeOptions, AriaNode } from './ariaSnapshot';

// Re-export element picker functionality
export { getElementPicker, ElementPicker };
export type { PickedElement } from './elementPicker';

// Re-export MCP connection functionality
export {
  MCPWebSocketClient,
  initializeMCPConnection,
} from './mcpConnection.js';

// Re-export message types
export type {
  BaseMessage,
  PageInfoMessage,
  HeartbeatMessage,
  CommandResponseMessage,
  BrowserToServerMessage,
  BrowserCommand,
  ServerToBrowserMessage,
} from './types/messages.js';

// Re-export MCP tool definitions
export { toolDefinitions, type McpToolDefinition } from './mcpTools.js';

// Export tool handlers for browser use
export { toolHandlers } from './tools/index.js';

// Re-export eventBuffer functionality
export {
  addEvent,
  getEvents,
  clearEvents,
  getBufferStats,
} from './eventBuffer.js';
import { addEvent } from './eventBuffer.js';

// Re-export console forwarder functionality
export {
  installConsoleForwarders,
  restoreConsole,
} from './consoleForwarder.js';
import { installConsoleForwarders } from './consoleForwarder.js';

// Re-export interaction forwarder functionality
export {
  installInteractionForwarders,
  restoreInteractionForwarders,
} from './interactionForwarder.js';
import { installInteractionForwarders } from './interactionForwarder.js';

// Global page UUID
let currentPageUUID = '';

// Generate page UUID from URL hash
function generatePageUUID(): string {
  if (typeof window === 'undefined') return '';
  const url = window.location.href;
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Triple-ESC key listener state
let escPressCount = 0;
let escPressTimer: number | null = null;

// Install forwarders automatically in browser environment
if (typeof window !== 'undefined') {
  installConsoleForwarders();
  installInteractionForwarders();

  // Initialize page UUID
  currentPageUUID = generatePageUUID();
  // Expose globally for testing and debugging
  (window as any)._a11yCapPageUUID = currentPageUUID;
  (window as any)._a11yCapEscCount = () => escPressCount;
  (window as any)._a11yCapEscTimer = () => escPressTimer;

  // Triple-ESC key listener to enable element picker
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      escPressCount++;

      // Clear existing timer
      if (escPressTimer) {
        window.clearTimeout(escPressTimer);
      }

      // Check for triple press
      if (escPressCount === 3) {
        // Enable element picker only if not already active
        const picker = getElementPicker();
        if (!picker.isPickerActive()) {
          picker.enable({
            includeSnapshots: true,
            onElementsPicked: (elements) => {
              // Save picked elements to event log with page UUID
              for (const element of elements) {
                addEvent({
                  type: 'element_picked',
                  timestamp: Date.now(),
                  url: window.location.href,
                  pageUUID: currentPageUUID,
                  element: {
                    ref: element.ref,
                    selector: element.selector,
                    textContent:
                      element.element?.textContent?.slice(0, 100) || '',
                    tagName: element.element?.tagName.toLowerCase() || '',
                    snapshot: element.snapshot || '',
                  },
                });
              }
              console.log(
                `Picked ${elements.length} elements for page ${currentPageUUID}`
              );
            },
          });
        }
        escPressCount = 0;
      } else {
        // Reset counter after 1 second if not triple-pressed
        escPressTimer = window.setTimeout(() => {
          escPressCount = 0;
        }, 1000);
      }
    } else if (escPressCount > 0) {
      // Reset if any other key is pressed
      escPressCount = 0;
      if (escPressTimer) {
        window.clearTimeout(escPressTimer);
      }
    }
  });

  // Listen for URL changes to update page UUID
  const updatePageUUID = () => {
    currentPageUUID = generatePageUUID();
    (window as any)._a11yCapPageUUID = currentPageUUID;
  };

  // Listen for popstate (back/forward button)
  window.addEventListener('popstate', updatePageUUID);

  // Listen for hashchange
  window.addEventListener('hashchange', updatePageUUID);
}

/**
 * Hide CRA dev overlay that can interfere with interactions during testing
 */
function hideCRADevOverlay(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const overlay = document.getElementById('webpack-dev-server-client-overlay');
  if (overlay && overlay.style.display !== 'none') {
    overlay.style.display = 'none';
    return overlay;
  }
  return null;
}

/**
 * Restore CRA dev overlay after snapshot
 */
function restoreCRADevOverlay(overlay: HTMLElement | null): void {
  if (overlay) {
    overlay.style.display = '';
  }
}

// General snapshot function supporting all modes
export async function snapshot(
  element: Element,
  options: {
    mode?: 'ai' | 'expect' | 'codegen' | 'autoexpect';
    enableReact?: boolean;
    refPrefix?: string;
    max_bytes?: number;
  } = {}
): Promise<string> {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    throw new Error('Can only capture aria snapshot of Element nodes.');
  }

  // Temporarily hide CRA dev overlay during snapshot
  const overlay = hideCRADevOverlay();

  try {
    // Wait for React DevTools if React is enabled
    if (options.enableReact) {
      await waitForReactDevTools();
    }

    const mode = options.mode || 'expect';
    const tree = generateAriaTree(element, {
      mode,
      enableReact: options.enableReact,
      refPrefix: options.refPrefix,
    });

    // If max_bytes is specified, use breadth-first rendering with size limit
    if (options.max_bytes) {
      return renderAriaTreeWithSizeLimit(tree, {
        mode,
        enableReact: options.enableReact,
        refPrefix: options.refPrefix,
        max_bytes: options.max_bytes,
      });
    }

    return renderAriaTree(tree, {
      mode,
      enableReact: options.enableReact,
      refPrefix: options.refPrefix,
    });
  } finally {
    // Restore overlay after snapshot
    restoreCRADevOverlay(overlay);
  }
}

/**
 * Render aria tree with size limit using breadth-first expansion
 */
function renderAriaTreeWithSizeLimit(
  tree: any,
  options: {
    mode: 'ai' | 'expect' | 'codegen' | 'autoexpect';
    enableReact?: boolean;
    refPrefix?: string;
    max_bytes: number;
  }
): string {
  // Start with just the root node
  let currentTree = { ...tree, children: [] };
  let lastValidResult = renderAriaTree(currentTree, options);

  if (lastValidResult.length > options.max_bytes) {
    // Even root node exceeds limit, return truncated version with warning
    let truncated = lastValidResult.slice(0, options.max_bytes);

    // Ensure we don't cut off in the middle of a bracket expression
    // Find the last complete bracket pair or cut before any incomplete one
    const lastOpenBracket = truncated.lastIndexOf('[');
    const lastCloseBracket = truncated.lastIndexOf(']');

    if (lastOpenBracket > lastCloseBracket) {
      // We have an unclosed bracket, truncate before it
      truncated = truncated.slice(0, lastOpenBracket).trimEnd();
    }

    return `${truncated}\n\n[WARNING: Snapshot was truncated due to size limit. Even the root element exceeded the limit. To get a focused snapshot of a specific element, use take_snapshot with the 'ref' parameter, e.g., take_snapshot(ref="e5") to snapshot just that element and its children, or use 'selector' to target specific elements, e.g., take_snapshot(selector=".button").]`;
  }

  // Breadth-first expansion
  const queue = tree.children
    ? [
        ...tree.children.map((child: any, index: number) => ({
          child,
          path: [index],
        })),
      ]
    : [];

  let wasTruncated = false;

  while (queue.length > 0) {
    const { child, path } = queue.shift()!;

    // Try adding this child to the tree
    const testTree = JSON.parse(JSON.stringify(currentTree));
    addChildAtPath(testTree, path, child);

    const testResult = renderAriaTree(testTree, options);

    if (testResult.length <= options.max_bytes) {
      // This child fits, keep it and add its children to queue
      currentTree = testTree;
      lastValidResult = testResult;

      if (child.children) {
        child.children.forEach((grandchild: any, index: number) => {
          queue.push({ child: grandchild, path: [...path, index] });
        });
      }
    } else {
      // This child doesn't fit, mark as truncated
      wasTruncated = true;
    }
  }

  // Add truncation warning if the snapshot was limited
  if (wasTruncated) {
    lastValidResult +=
      '\n\n[WARNING: Snapshot was truncated due to size limit. Some elements may be missing. To get a focused snapshot of a specific element, use take_snapshot with the \'ref\' parameter, e.g., take_snapshot(ref="e5") to snapshot just that element and its children, or use \'selector\' to target specific elements, e.g., take_snapshot(selector=".button").]';
  }

  return lastValidResult;
}

/**
 * Add a child node at the specified path in the tree
 */
function addChildAtPath(tree: any, path: number[], child: any): void {
  let current = tree;
  for (let i = 0; i < path.length - 1; i++) {
    if (!current.children) current.children = [];
    if (!current.children[path[i]]) {
      current.children[path[i]] = { children: [] };
    }
    current = current.children[path[i]];
  }
  if (!current.children) current.children = [];
  current.children[path[path.length - 1]] = { ...child, children: [] };
}

// Simple browser-compatible wrapper for snapshotForAI (AI mode)
export async function snapshotForAI(
  element: Element,
  options: {
    enableReact?: boolean;
    refPrefix?: string;
    max_bytes?: number;
  } = {}
): Promise<string> {
  // The snapshot function already handles overlay hiding/restoring
  return snapshot(element, { mode: 'ai', ...options });
}

/**
 * Click on an element by its snapshot ref
 * @param ref - The ref from a snapshot (e.g., 'e2', 'e5')
 * @param element - Optional root element to search within (defaults to document.body)
 */
export function clickRef(
  ref: string,
  element: Element = document.body
): boolean {
  // Find the element with the matching ref from the last snapshot
  const targetElement = findElementByRef(ref, element);
  if (!targetElement) {
    console.warn(`Element with ref="${ref}" not found`);
    return false;
  }

  // Temporarily hide CRA dev overlay for reliable clicking
  const overlay = hideCRADevOverlay();

  try {
    // Click the element
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    targetElement.dispatchEvent(clickEvent);
    return true;
  } catch (error) {
    console.error(`Failed to click element with ref="${ref}":`, error);
    return false;
  } finally {
    // Restore overlay
    restoreCRADevOverlay(overlay);
  }
}

/**
 * Find an element by its snapshot ref
 * @param ref - The ref to search for (e.g., 'e2', 'e5')
 * @param element - Root element to search within
 */
export function findElementByRef(
  ref: string,
  element: Element = document.body
): Element | null {
  // Check if the element itself has the ref
  if ((element as any)._ariaRef?.ref === ref) {
    return element;
  }

  // Recursively search children
  for (const child of element.children) {
    if ((child as any)._ariaRef?.ref === ref) {
      return child;
    }

    const found = findElementByRef(ref, child);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Wait for React DevTools to be fully ready for component extraction
 * Returns a promise that resolves when React DevTools is initialized
 */
export function waitForReactDevTools(timeout = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    // If React DevTools aren't available at all, just proceed immediately
    if (
      typeof window === 'undefined' ||
      !window.__REACT_DEVTOOLS_GLOBAL_HOOK__
    ) {
      resolve(false);
      return;
    }

    const startTime = Date.now();
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

    function check() {
      // Check if hook has renderers (indicates it's fully initialized)
      if (hook.renderers && hook.renderers.size > 0) {
        resolve(true);
        return;
      }

      // Also check for our custom ready flag
      if ((window as any).reactDevToolsReady) {
        resolve(true);
        return;
      }

      // Only wait briefly since React info is optional
      if (Date.now() - startTime > timeout) {
        resolve(false);
        return;
      }

      setTimeout(check, 10);
    }

    check();
  });
}

/**
 * Global A11yCap interface for test environment
 */
interface A11yCapGlobal {
  snapshotForAI: typeof snapshotForAI;
  snapshot: typeof snapshot;
  extractReactInfo: typeof extractReactInfo;
  clickRef: typeof clickRef;
  findElementByRef: typeof findElementByRef;
  generateAriaTree: typeof generateAriaTree;
  renderAriaTree: typeof renderAriaTree;
  initializeMCPConnection: (wsUrl: string) => any;
  getElementPicker: typeof getElementPicker;
  toolHandlers: any;
  addEvent: any;
  getEvents: any;
  clearEvents: any;
  getBufferStats: any;
  installConsoleForwarders: any;
  restoreConsole: any;
  installInteractionForwarders: any;
  restoreInteractionForwarders: any;
}

declare global {
  interface Window {
    A11yCap: A11yCapGlobal;
  }
}
