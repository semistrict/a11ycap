// Browser-compatible entry point

import { generateAriaTree, renderAriaTree } from './ariaSnapshot';
import { extractReactInfo } from './reactUtils';

// Re-export the browser-compatible ariaSnapshot functionality
export { generateAriaTree, renderAriaTree, extractReactInfo };
export type { AriaSnapshot, AriaTreeOptions, AriaNode } from './ariaSnapshot';

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

// Simple browser-compatible wrapper for snapshotForAI (AI mode)
export async function snapshotForAI(
  element: Element,
  options: { enableReact?: boolean; refPrefix?: string } = {}
): Promise<string> {
  // The snapshot function already handles overlay hiding/restoring
  return snapshot(element, { mode: 'ai', ...options });
}

/**
 * Click on an element by its snapshot ref
 * @param ref - The ref from a snapshot (e.g., 'e2', 'e5')
 * @param element - Optional root element to search within (defaults to document.body)
 */
export function clickRef(ref: string, element: Element = document.body): boolean {
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
      view: window
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
export function findElementByRef(ref: string, element: Element = document.body): Element | null {
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
 * Get an element by its snapshot ref (alias for findElementByRef)
 * @param ref - The ref to search for (e.g., 'e2', 'e5')
 * @param element - Root element to search within
 */
export function getElementByRef(ref: string, element: Element = document.body): Element | null {
  return findElementByRef(ref, element);
}

/**
 * Wait for React DevTools to be fully ready for component extraction
 * Returns a promise that resolves when React DevTools is initialized
 */
export function waitForReactDevTools(timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    function check() {
      // Check if React DevTools hook exists
      if (typeof window === 'undefined' || !window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }
        setTimeout(check, 10);
        return;
      }
      
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      
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
 * Optionally expose functions globally for browser console debugging
 * Call this if you want to use the functions directly from browser console
 */
export function exposeGlobally(): void {
  if (typeof window !== 'undefined') {
    (window as any).pwsnapshot = {
      snapshot,
      snapshotForAI,
      waitForReactDevTools,
      clickRef,
      findElementByRef,
      getElementByRef,
      generateAriaTree,
      renderAriaTree,
      extractReactInfo
    };
    
    // Also expose commonly used functions directly
    (window as any).snapshot = snapshot;
    (window as any).snapshotForAI = snapshotForAI;
    (window as any).clickRef = clickRef;
    (window as any).getElementByRef = getElementByRef;
    
    console.log('pwsnapshot functions exposed globally. Access via window.pwsnapshot or directly (snapshot, snapshotForAI, etc.)');
  }
}
