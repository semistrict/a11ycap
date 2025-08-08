/**
 * React-specific utilities for extracting component information from DOM elements.
 * Uses React DevTools global hook and fiber nodes to gather component context.
 */

export interface ReactInfo {
  componentName?: string;      // e.g. "App.Button", "ContactForm"
  componentState?: string;     // e.g. "{count: 1, loading: true}"
  interactionHints?: string[]; // e.g. ["onClick=handleSubmit", "loading"]
  relevantProps?: Record<string, any>; // selective props that affect behavior
  debugSource?: string;        // e.g. "App.tsx:42:8"
}

interface DevToolsHook {
  renderers: Map<number, any>;
  supportsFiber: boolean;
  getFiberRoots(rendererID: number): Set<any>;
  inject?(renderer: any): number;
  onCommitFiberRoot?(rendererID: number, root: any, priorityLevel: number, didError: boolean): void;
  onCommitFiberUnmount?(rendererID: number, fiber: any): void;
  sub?: any;
  emit?: (event: string, data?: any) => void;
}

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook;
  }
}

/**
 * Find the React fiber node associated with a DOM element
 */
function findFiberForDom(dom: Element): { componentFiber: any; domFiber: any } | null {
  // [DEBUG] Debug fiber search
  if (typeof window !== 'undefined' && (window as any).DEBUG_REACT_SNAPSHOT) {
    console.log('[DEBUG] Searching for fiber on element:', dom);
    console.log('[DEBUG] Element keys:', Object.keys(dom));
  }
  
  let node: any = dom;
  while (node) {
    // Look for React fiber properties on the DOM node
    const fiberKey = Object.keys(node).find((k: string) => k.startsWith("__reactFiber"));
    if (typeof window !== 'undefined' && (window as any).DEBUG_REACT_SNAPSHOT && fiberKey) {
      console.log('[DEBUG] Found fiber key:', fiberKey, 'on node:', node);
    }
    if (fiberKey) {
      const domFiber = node[fiberKey];
      if (domFiber) {
        // [DEBUG] Found fiber, now walk up to find component fiber
        if (typeof window !== 'undefined' && (window as any).DEBUG_REACT_SNAPSHOT) {
          console.log('[DEBUG] Found fiber, walking up to find component:', domFiber);
        }
        // Return both the component fiber and original DOM fiber
        const componentFiber = findComponentFiber(domFiber);
        return { componentFiber: componentFiber || domFiber, domFiber };
      }
    }
    node = node.parentNode;
  }
  return null;
}

/**
 * Walk up the fiber tree to find the nearest component fiber (not host fiber)
 */
function findComponentFiber(fiber: any): any {
  let current = fiber;
  while (current) {
    // [DEBUG]
    if (typeof window !== 'undefined' && (window as any).DEBUG_REACT_SNAPSHOT) {
      console.log('[DEBUG] Checking fiber:', current, 'type:', current.type, 'typeof type:', typeof current.type);
    }
    
    // Look for component fibers (function components or class components)
    // Host components like 'button', 'div' have string types
    // Component fibers have function types
    if (current.type && typeof current.type === 'function') {
      if (typeof window !== 'undefined' && (window as any).DEBUG_REACT_SNAPSHOT) {
        console.log('[DEBUG] Found component fiber:', current);
      }
      return current;
    }
    current = current.return;
  }
  return fiber; // Fallback to original fiber if no component found
}

/**
 * Get debug source information from a fiber node or DOM element
 */
function getDebugSourceInfo(fiber: any, domElement?: Element): string | undefined {
  if (!fiber) return undefined;
  
  // First try to get debug info from data attributes (injected by Babel plugin)
  if (domElement) {
    const dataDebugSource = domElement.getAttribute('data-debug-source');
    if (dataDebugSource) {
      // Extract just the filename from the full path
      const parts = dataDebugSource.split(':');
      if (parts.length >= 2) {
        const fullPath = parts[0];
        const line = parts[1];
        const shortFileName = fullPath.split('/').pop() || fullPath;
        return `${shortFileName}:${line}`;
      }
      return dataDebugSource;
    }
  }
  
  // Fallback to React fiber debug info
  const debugSource = fiber._debugSource;
  if (!debugSource) return undefined;
  
  const { fileName, lineNumber, columnNumber } = debugSource;
  if (!fileName) return undefined;
  
  // Extract just the filename from the full path
  const shortFileName = fileName.split('/').pop() || fileName;
  
  // Format as filename:line:column if we have line info
  if (lineNumber !== undefined) {
    if (columnNumber !== undefined) {
      return `${shortFileName}:${lineNumber}:${columnNumber}`;
    }
    return `${shortFileName}:${lineNumber}`;
  }
  
  return shortFileName;
}

/**
 * Get the component name from a fiber node
 */
function getComponentName(fiber: any): string | undefined {
  if (!fiber) return undefined;
  
  // Try to get component name from fiber.type
  if (fiber.type) {
    if (typeof fiber.type === 'string') {
      // DOM element like 'div', 'button' - not a React component
      return undefined;
    }
    
    if (fiber.type.displayName) {
      return fiber.type.displayName;
    }
    
    if (fiber.type.name) {
      return fiber.type.name;
    }
    
    // For anonymous components, try to get name from constructor
    if (fiber.type.constructor && fiber.type.constructor.name !== 'Object') {
      return fiber.type.constructor.name;
    }
  }
  
  // Try elementType as fallback
  if (fiber.elementType) {
    if (fiber.elementType.displayName) return fiber.elementType.displayName;
    if (fiber.elementType.name) return fiber.elementType.name;
  }
  
  return undefined;
}

/**
 * Extract relevant state information from fiber hooks
 */
function getComponentState(fiber: any): string | undefined {
  if (!fiber || !fiber.memoizedState) return undefined;
  
  try {
    const state: any = {};
    let hook = fiber.memoizedState;
    let hookIndex = 0;
    
    // Walk through the hook chain
    while (hook && hookIndex < 10) { // Limit iterations to prevent infinite loops
      // Check if this is a useState hook
      if (hook.memoizedState !== undefined) {
        // Only include primitive state values for clarity
        const value = hook.memoizedState;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          state[`state${hookIndex}`] = value;
        } else if (typeof value === 'object' && value !== null) {
          // For objects, try to extract useful properties
          if ('count' in value) state.count = value.count;
          if ('loading' in value) state.loading = value.loading;
          if ('error' in value) state.error = value.error;
          if ('disabled' in value) state.disabled = value.disabled;
        }
      }
      
      hook = hook.next;
      hookIndex++;
    }
    
    // Only return state if we found something meaningful
    if (Object.keys(state).length > 0) {
      return JSON.stringify(state);
    }
  } catch (error) {
    // Ignore errors in state extraction
  }
  
  return undefined;
}

/**
 * Extract interaction hints from component props
 */
function getInteractionHints(componentFiber: any, domFiber?: any): string[] {
  const hints: string[] = [];
  
  if (!componentFiber) return hints;
  
  // Check both component fiber props and DOM fiber props
  const componentProps = componentFiber.memoizedProps || {};
  const domProps = (domFiber && domFiber.memoizedProps) || {};
  
  // Combine props, with DOM props taking precedence for interaction hints
  const props = { ...componentProps, ...domProps };
  
  // Check for event handlers
  if (props.onClick) hints.push('onClick');
  if (props.onChange) hints.push('onChange');
  if (props.onSubmit) hints.push('onSubmit');
  if (props.onFocus) hints.push('onFocus');
  if (props.onBlur) hints.push('onBlur');
  
  // Check for boolean props that affect behavior
  if (props.disabled === true) hints.push('disabled');
  if (props.loading === true) hints.push('loading');
  if (props.required === true) hints.push('required');
  if (props.readOnly === true) hints.push('readOnly');
  
  // Check for semantic props
  if (props.type) hints.push(`type=${props.type}`);
  if (props.variant) hints.push(`variant=${props.variant}`);
  if (props.intent) hints.push(`intent=${props.intent}`);
  
  return hints;
}

/**
 * Extract relevant props that provide meaningful context
 */
function getRelevantProps(fiber: any): Record<string, any> {
  const relevantProps: Record<string, any> = {};
  
  if (!fiber || !fiber.memoizedProps) return relevantProps;
  
  const props = fiber.memoizedProps;
  
  // Include props that affect behavior or provide semantic meaning
  const meaningfulProps = ['required', 'disabled', 'loading', 'error', 'variant', 'intent', 'size', 'type'];
  
  for (const propName of meaningfulProps) {
    if (props[propName] !== undefined) {
      relevantProps[propName] = props[propName];
    }
  }
  
  return relevantProps;
}

/**
 * Check if React DevTools is available
 */
function isReactDevToolsAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
}

/**
 * Main function to extract React information from a DOM element
 */
export function extractReactInfo(element: Element): ReactInfo | null {
  // Early return if React DevTools is not available
  if (!isReactDevToolsAvailable()) {
    return { componentName: 'DEBUG: No DevTools' } as any;
  }
  
  const fiberResult = findFiberForDom(element);
  if (!fiberResult) {
    return { componentName: 'DEBUG: No Fiber' } as any;
  }
  
  const { componentFiber, domFiber } = fiberResult;
  
  // Continue with normal extraction
  try {

    // [DEBUG] Debug logging
    if (typeof window !== 'undefined' && (window as any).DEBUG_REACT_SNAPSHOT) {
      console.log('[DEBUG] Found fiber for element:', element, componentFiber);
      console.log('[DEBUG] Fiber type:', componentFiber.type);
      console.log('[DEBUG] Fiber elementType:', componentFiber.elementType);
    }
    
    // Extract information from the fiber 
    const componentName = getComponentName(componentFiber);
    const componentState = getComponentState(componentFiber);
    const debugSource = getDebugSourceInfo(componentFiber, element);
    
    // [DEBUG] Debug component extraction
    if (typeof window !== 'undefined' && (window as any).DEBUG_REACT_SNAPSHOT) {
      console.log('[DEBUG] Extracted componentName:', componentName);
      console.log('[DEBUG] Extracted componentState:', componentState);
      console.log('[DEBUG] Extracted debugSource:', debugSource);
    }
    const interactionHints = getInteractionHints(componentFiber, domFiber);
    const relevantProps = getRelevantProps(componentFiber);
    
    // Only return ReactInfo if we found something meaningful
    if (componentName || componentState || interactionHints.length > 0 || Object.keys(relevantProps).length > 0 || debugSource) {
      const result = {
        componentName,
        componentState,
        interactionHints: interactionHints.length > 0 ? interactionHints : undefined,
        relevantProps: Object.keys(relevantProps).length > 0 ? relevantProps : undefined,
        debugSource,
      };
      console.log('[DEBUG] Returning React info:', result);
      return result;
    }
    
    console.log('[DEBUG] No meaningful React info found');
  } catch (error) {
    // Ignore errors and return null - we don't want React extraction to break the snapshot
    console.debug('Error extracting React info:', error);
  }
  
  return null;
}