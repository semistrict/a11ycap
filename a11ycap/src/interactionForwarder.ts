/**
 * User interaction recording using event buffer
 */

import {
  type ClickEvent,
  type FocusEvent,
  type InputEvent,
  type KeyEvent,
  type NavigationEvent,
  addEvent,
} from './eventBuffer.js';

// Global recording state
let isRecording = false;
let recordingStartTime: number | null = null;

/**
 * Start recording interactions
 */
export function startRecording(): void {
  isRecording = true;
  recordingStartTime = Date.now();
  console.log('[a11ycap] Started recording interactions');
}

/**
 * Stop recording interactions
 */
export function stopRecording(): void {
  isRecording = false;
  recordingStartTime = null;
  console.log('[a11ycap] Stopped recording interactions');
}

/**
 * Check if recording is active
 */
export function isRecordingActive(): boolean {
  return isRecording;
}

/**
 * Get recording duration in milliseconds
 */
export function getRecordingDuration(): number | null {
  if (!isRecording || !recordingStartTime) return null;
  return Date.now() - recordingStartTime;
}

/**
 * Generate page UUID from URL hash (same logic as in index.ts)
 */
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

/**
 * Extract target information from DOM element
 */
function extractTargetInfo(element: Element): {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  ariaRef?: string;
} {
  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: element.className || undefined,
    textContent: element.textContent?.slice(0, 100) || undefined,
    ariaRef: (element as any)._ariaRef?.ref || undefined,
  };
}

/**
 * Extract meta keys from keyboard/mouse event
 */
function extractMetaKeys(event: KeyboardEvent | MouseEvent) {
  return {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

/**
 * Check if an element is part of our internal UI (shadow DOM)
 * This prevents recording interactions with our own menu/recorder interface
 */
function isInternalUIElement(element: Element): boolean {
  // Check if the element itself or any ancestor has our UI class
  let current: Element | null = element;
  
  while (current) {
    // Check if this element has our UI class
    if (current.classList.contains('a11ycap-ui')) {
      return true;
    }
    
    // Move up to parent element
    current = current.parentElement;
  }
  
  // Check if the element is inside a shadow root with our UI class
  const root = element.getRootNode();
  if (root instanceof ShadowRoot) {
    const host = root.host;
    if (host && host.classList.contains('a11ycap-ui')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Install user interaction listeners to buffer events locally
 */
export function installInteractionForwarders(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Track previous values for input change detection
  const inputPreviousValues = new WeakMap<
    HTMLInputElement | HTMLTextAreaElement,
    string
  >();

  // Click events
  document.addEventListener(
    'click',
    (event) => {
      try {
        if (!isRecording) return;
        if (!(event.target instanceof Element)) return;
        
        // Skip interactions with our own UI elements
        if (isInternalUIElement(event.target)) return;

        const clickEvent: ClickEvent = {
          type: 'click',
          timestamp: Date.now(),
          url: window.location.href,
          pageUUID: generatePageUUID(),
          target: extractTargetInfo(event.target),
          coordinates: {
            x: event.clientX,
            y: event.clientY,
          },
          button: event.button,
          metaKeys: extractMetaKeys(event),
        };

        addEvent(clickEvent);
      } catch (error) {
        console.error('Failed to record click event:', error);
      }
    },
    true
  ); // Use capture phase to catch all clicks

  // Input events
  document.addEventListener(
    'input',
    (event) => {
      try {
        if (!isRecording) return;
        if (
          !(
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement
          )
        ) {
          return;
        }
        
        // Skip interactions with our own UI elements
        if (isInternalUIElement(event.target)) return;

        const element = event.target;
        const previousValue = inputPreviousValues.get(element) || '';
        const currentValue = element.value;

        const inputEvent: InputEvent = {
          type: 'input',
          timestamp: Date.now(),
          url: window.location.href,
          pageUUID: generatePageUUID(),
          target: {
            ...extractTargetInfo(element),
            inputType: element.type || undefined,
          },
          value: currentValue,
          previousValue:
            previousValue !== currentValue ? previousValue : undefined,
          selectionStart: element.selectionStart || undefined,
          selectionEnd: element.selectionEnd || undefined,
        };

        // Update previous value
        inputPreviousValues.set(element, currentValue);

        addEvent(inputEvent);
      } catch (error) {
        console.error('Failed to record input event:', error);
      }
    },
    true
  );

  // Change events (for selects, checkboxes, radios)
  document.addEventListener(
    'change',
    (event) => {
      try {
        if (!isRecording) return;
        if (!(event.target instanceof HTMLElement)) return;
        
        // Skip interactions with our own UI elements
        if (isInternalUIElement(event.target)) return;

        const element = event.target as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement;
        let value = '';

        if (element instanceof HTMLInputElement) {
          if (element.type === 'checkbox' || element.type === 'radio') {
            value = element.checked ? element.value || 'checked' : 'unchecked';
          } else {
            value = element.value;
          }
        } else if (element instanceof HTMLSelectElement) {
          value = element.value;
        } else if (element instanceof HTMLTextAreaElement) {
          value = element.value;
        }

        const changeEvent: InputEvent = {
          type: 'change',
          timestamp: Date.now(),
          url: window.location.href,
          pageUUID: generatePageUUID(),
          target: {
            ...extractTargetInfo(element),
            inputType: (element as HTMLInputElement).type || undefined,
          },
          value,
        };

        addEvent(changeEvent);
      } catch (error) {
        console.error('Failed to record change event:', error);
      }
    },
    true
  );

  // Key events
  document.addEventListener(
    'keydown',
    (event) => {
      try {
        if (!isRecording) return;
        if (!(event.target instanceof Element)) return;
        
        // Skip interactions with our own UI elements
        if (isInternalUIElement(event.target)) return;

        const keyEvent: KeyEvent = {
          type: 'keydown',
          timestamp: Date.now(),
          url: window.location.href,
          pageUUID: generatePageUUID(),
          target: extractTargetInfo(event.target),
          key: event.key,
          code: event.code,
          metaKeys: extractMetaKeys(event),
        };

        addEvent(keyEvent);
      } catch (error) {
        console.error('Failed to record keydown event:', error);
      }
    },
    true
  );

  // Focus events
  document.addEventListener(
    'focus',
    (event) => {
      try {
        if (!isRecording) return;
        if (!(event.target instanceof Element)) return;
        
        // Skip interactions with our own UI elements
        if (isInternalUIElement(event.target)) return;

        const focusEvent: FocusEvent = {
          type: 'focus',
          timestamp: Date.now(),
          url: window.location.href,
          pageUUID: generatePageUUID(),
          target: extractTargetInfo(event.target),
        };

        addEvent(focusEvent);
      } catch (error) {
        console.error('Failed to record focus event:', error);
      }
    },
    true
  );

  document.addEventListener(
    'blur',
    (event) => {
      try {
        if (!isRecording) return;
        if (!(event.target instanceof Element)) return;
        
        // Skip interactions with our own UI elements
        if (isInternalUIElement(event.target)) return;

        const blurEvent: FocusEvent = {
          type: 'blur',
          timestamp: Date.now(),
          url: window.location.href,
          pageUUID: generatePageUUID(),
          target: extractTargetInfo(event.target),
        };

        addEvent(blurEvent);
      } catch (error) {
        console.error('Failed to record blur event:', error);
      }
    },
    true
  );

  // Navigation events
  const recordNavigation = (
    method: NavigationEvent['method'],
    from?: string,
    to?: string
  ) => {
    try {
      if (!isRecording) return;
      const navigationEvent: NavigationEvent = {
        type: 'navigation',
        timestamp: Date.now(),
        url: window.location.href,
        pageUUID: generatePageUUID(),
        from: from || document.referrer || window.location.href,
        to: to || window.location.href,
        method,
        title: document.title,
      };

      addEvent(navigationEvent);
    } catch (error) {
      console.error('Failed to record navigation event:', error);
    }
  };

  // Track page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      recordNavigation('load');
    });
  } else {
    // Document already loaded
    recordNavigation('load');
  }

  // Track navigation events
  window.addEventListener('beforeunload', () => {
    recordNavigation('beforeunload');
  });

  window.addEventListener('popstate', () => {
    recordNavigation('popstate');
  });

  window.addEventListener('hashchange', () => {
    recordNavigation('hashchange');
  });

  // Override pushState to track programmatic navigation
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    const previousUrl = window.location.href;
    const result = originalPushState.apply(this, args);
    setTimeout(() => {
      recordNavigation('pushstate', previousUrl, window.location.href);
    }, 0);
    return result;
  };

  // Store originals for potential restoration
  (window as any).__a11ycap_original_pushState = originalPushState;
}

/**
 * Restore original event handlers and navigation methods
 */
export function restoreInteractionForwarders(): void {
  const originalPushState = (window as any).__a11ycap_original_pushState;
  if (originalPushState) {
    history.pushState = originalPushState;
    (window as any).__a11ycap_original_pushState = undefined;
  }

  // Note: Individual event listeners can't be removed without keeping references
  // This is acceptable since we're using WeakMap for memory management
}
