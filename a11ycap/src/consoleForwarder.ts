/**
 * Console message buffering using event buffer
 */

import { type ConsoleEvent, addEvent } from './eventBuffer.js';

/**
 * Install console wrappers to buffer messages locally
 */
export function installConsoleForwarders(): void {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  const bufferConsoleMessage = (level: ConsoleEvent['level'], args: any[]) => {
    // Call original console method first
    originalConsole[level].apply(console, args);

    // Don't buffer our own a11ycap messages to avoid loops
    if (args[0] && typeof args[0] === 'string' && args[0].includes('🐱')) {
      return;
    }

    try {
      // Serialize arguments safely
      const serializedArgs = args.map((arg) => {
        try {
          if (arg instanceof Error) {
            return {
              _type: 'Error',
              message: arg.message,
              stack: arg.stack,
              name: arg.name,
            };
          }
          if (arg instanceof HTMLElement) {
            return {
              _type: 'HTMLElement',
              tagName: arg.tagName,
              id: arg.id || undefined,
              className: arg.className || undefined,
              textContent: arg.textContent?.slice(0, 100),
            };
          }
          if (typeof arg === 'object' && arg !== null) {
            // Try to stringify, but limit depth
            return JSON.parse(JSON.stringify(arg, null, 2));
          }
          return arg;
        } catch {
          return String(arg);
        }
      });

      const consoleEvent: ConsoleEvent = {
        type: 'console',
        level,
        args: serializedArgs,
        timestamp: Date.now(),
        url: window.location.href,
        stack: level === 'error' ? new Error().stack : undefined,
      };

      addEvent(consoleEvent);
    } catch (error) {
      // Silently fail if we can't buffer the message
      originalConsole.error('Failed to buffer console message:', error);
    }
  };

  // Wrap each console method
  console.log = (...args: any[]) => bufferConsoleMessage('log', args);
  console.warn = (...args: any[]) => bufferConsoleMessage('warn', args);
  console.error = (...args: any[]) => bufferConsoleMessage('error', args);
  console.info = (...args: any[]) => bufferConsoleMessage('info', args);
  console.debug = (...args: any[]) => bufferConsoleMessage('debug', args);

  // Store originals for potential restoration
  (window as any).__a11ycap_original_console = originalConsole;
}

/**
 * Restore original console methods
 */
export function restoreConsole(): void {
  const originals = (window as any).__a11ycap_original_console;
  if (originals) {
    console.log = originals.log;
    console.warn = originals.warn;
    console.error = originals.error;
    console.info = originals.info;
    console.debug = originals.debug;
    (window as any).__a11ycap_original_console = undefined;
  }
}
