/**
 * Generic event buffer using WeakMap and weak references to avoid GC issues
 */

export interface BaseEvent {
  type: string;
  timestamp: number;
  url: string;
}

export interface ConsoleEvent extends BaseEvent {
  type: 'console';
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: any[];
  stack?: string;
}

export interface ClickEvent extends BaseEvent {
  type: 'click';
  target: {
    tagName: string;
    id?: string;
    className?: string;
    textContent?: string;
    ariaRef?: string; // If element has a snapshot ref
  };
  coordinates?: {
    x: number;
    y: number;
  };
  button: number; // 0 = left, 1 = middle, 2 = right
  metaKeys: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
}

export interface InputEvent extends BaseEvent {
  type: 'input' | 'change';
  target: {
    tagName: string;
    id?: string;
    className?: string;
    inputType?: string;
    ariaRef?: string;
  };
  value: string;
  previousValue?: string;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface KeyEvent extends BaseEvent {
  type: 'keydown' | 'keyup' | 'keypress';
  target: {
    tagName: string;
    id?: string;
    className?: string;
    ariaRef?: string;
  };
  key: string;
  code: string;
  metaKeys: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
}

export interface NavigationEvent extends BaseEvent {
  type: 'navigation';
  from: string;
  to: string;
  method: 'pushstate' | 'popstate' | 'hashchange' | 'beforeunload' | 'load';
  title?: string;
}

export interface FocusEvent extends BaseEvent {
  type: 'focus' | 'blur';
  target: {
    tagName: string;
    id?: string;
    className?: string;
    ariaRef?: string;
  };
}

export type InteractionEvent = ClickEvent | InputEvent | KeyEvent | NavigationEvent | FocusEvent;

export type BufferedEvent = ConsoleEvent | InteractionEvent;

// Store events directly in sessionStorage with indexed keys
const MAX_BUFFER_SIZE = 500;
const EVENT_KEY_PREFIX = 'a11ycap_event_';
const STATE_KEY = 'a11ycap_buffer_state';

interface BufferState {
  currentIndex: number;
  size: number;
  oldestIndex: number;
}

/**
 * Get buffer state from sessionStorage
 */
function getBufferState(): BufferState {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { currentIndex: 0, size: 0, oldestIndex: 0 };
  }

  try {
    const stored = sessionStorage.getItem(STATE_KEY);
    if (!stored) {
      return { currentIndex: 0, size: 0, oldestIndex: 0 };
    }
    return JSON.parse(stored);
  } catch {
    return { currentIndex: 0, size: 0, oldestIndex: 0 };
  }
}

/**
 * Save buffer state to sessionStorage
 */
function saveBufferState(state: BufferState): void {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }

  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save buffer state:', error);
  }
}

/**
 * Add an event to the buffer
 */
export function addEvent(event: BufferedEvent): void {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }

  const state = getBufferState();
  const serializedEvent = JSON.stringify(event);
  
  // Store the event directly in sessionStorage
  const eventKey = `${EVENT_KEY_PREFIX}${state.currentIndex}`;
  
  try {
    sessionStorage.setItem(eventKey, serializedEvent);
    
    // Update state
    state.currentIndex = (state.currentIndex + 1) % MAX_BUFFER_SIZE;
    
    if (state.size < MAX_BUFFER_SIZE) {
      state.size++;
    } else {
      // Remove the oldest event that will be overwritten
      const oldestKey = `${EVENT_KEY_PREFIX}${state.oldestIndex}`;
      sessionStorage.removeItem(oldestKey);
      state.oldestIndex = (state.oldestIndex + 1) % MAX_BUFFER_SIZE;
    }
    
    saveBufferState(state);
  } catch (error) {
    console.warn('Failed to add event to buffer:', error);
  }
}

/**
 * Get events from buffer with optional filtering
 * Returns serialized event strings ready for transmission
 */
export function getEvents(options?: {
  type?: string;
  level?: string;
  since?: number;
  limit?: number;
}): string[] {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return [];
  }

  const state = getBufferState();
  if (state.size === 0) {
    return [];
  }

  const eventStrings: string[] = [];
  
  // Iterate through events in chronological order
  for (let i = 0; i < state.size; i++) {
    const index = (state.oldestIndex + i) % MAX_BUFFER_SIZE;
    const eventKey = `${EVENT_KEY_PREFIX}${index}`;
    
    try {
      const eventStr = sessionStorage.getItem(eventKey);
      if (!eventStr) continue;
      
      // Apply filters if needed
      if (options?.type || options?.level || options?.since) {
        try {
          const event = JSON.parse(eventStr);
          
          // Filter by type
          if (options.type && event.type !== options.type) {
            continue;
          }
          
          // Filter by level (for console events)
          if (options.level && (event.type !== 'console' || event.level !== options.level)) {
            continue;
          }
          
          // Filter by timestamp
          if (options.since && event.timestamp < options.since) {
            continue;
          }
        } catch {
          continue; // Skip malformed events
        }
      }
      
      eventStrings.push(eventStr);
    } catch {
      // Skip events that can't be read
    }
  }

  // Apply limit (most recent events)
  if (options?.limit && options.limit > 0) {
    return eventStrings.slice(-options.limit);
  }

  return eventStrings;
}

/**
 * Clear the event buffer
 */
export function clearEvents(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }

  const state = getBufferState();
  
  // Remove all event keys from sessionStorage
  for (let i = 0; i < state.size; i++) {
    const index = (state.oldestIndex + i) % MAX_BUFFER_SIZE;
    const eventKey = `${EVENT_KEY_PREFIX}${index}`;
    sessionStorage.removeItem(eventKey);
  }
  
  // Reset state
  const newState: BufferState = { currentIndex: 0, size: 0, oldestIndex: 0 };
  saveBufferState(newState);
}

/**
 * Get buffer statistics
 */
export function getBufferStats(): {
  totalEvents: number;
  eventTypes: Record<string, number>;
  oldestTimestamp?: number;
  newestTimestamp?: number;
} {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return {
      totalEvents: 0,
      eventTypes: {},
    };
  }

  const state = getBufferState();
  const stats = {
    totalEvents: state.size,
    eventTypes: {} as Record<string, number>,
    oldestTimestamp: undefined as number | undefined,
    newestTimestamp: undefined as number | undefined,
  };

  if (state.size > 0) {
    let oldestTimestamp: number | undefined;
    let newestTimestamp: number | undefined;

    // Iterate through events to get statistics
    for (let i = 0; i < state.size; i++) {
      const index = (state.oldestIndex + i) % MAX_BUFFER_SIZE;
      const eventKey = `${EVENT_KEY_PREFIX}${index}`;
      
      try {
        const eventStr = sessionStorage.getItem(eventKey);
        if (!eventStr) continue;
        
        const event = JSON.parse(eventStr);
        
        // Count events by type
        stats.eventTypes[event.type] = (stats.eventTypes[event.type] || 0) + 1;
        
        // Track timestamps
        if (oldestTimestamp === undefined || event.timestamp < oldestTimestamp) {
          oldestTimestamp = event.timestamp;
        }
        if (newestTimestamp === undefined || event.timestamp > newestTimestamp) {
          newestTimestamp = event.timestamp;
        }
      } catch {
        // Skip malformed events
      }
    }
    
    stats.oldestTimestamp = oldestTimestamp;
    stats.newestTimestamp = newestTimestamp;
  }

  return stats;
}

