import { test, expect } from '@playwright/test';

test.describe('Debug console logs setup', () => {
  test('should show what is available in window.A11yCap', async ({ page }) => {
    await page.goto('http://localhost:14652');
    await page.waitForLoadState('networkidle');

    // Check what's available in A11yCap
    const a11yCapKeys = await page.evaluate(() => {
      return {
        exists: typeof window.A11yCap !== 'undefined',
        keys: typeof window.A11yCap !== 'undefined' ? Object.keys(window.A11yCap) : [],
        toolHandlers: typeof window.A11yCap !== 'undefined' && window.A11yCap.toolHandlers ? Object.keys(window.A11yCap.toolHandlers) : null,
        consoleOriginal: typeof console.log === 'function',
        consoleModified: console.log.toString().includes('bufferConsoleMessage') || console.log.toString().length > 100,
        consoleToString: console.log.toString(),
        hasOriginalConsole: typeof (window as any).__a11ycap_original_console !== 'undefined'
      };
    });

    console.log('A11yCap debug info:', a11yCapKeys);
    expect(a11yCapKeys.exists).toBe(true);
  });

  test('should check if eventBuffer functions work', async ({ page }) => {
    await page.goto('http://localhost:14652');
    await page.waitForLoadState('networkidle');

    const bufferTest = await page.evaluate(() => {
      // Try to access eventBuffer functions directly
      try {
        // @ts-ignore
        const { addEvent, getEvents, getBufferStats } = window.A11yCap || {};
        return {
          hasAddEvent: typeof addEvent === 'function',
          hasGetEvents: typeof getEvents === 'function',
          hasGetBufferStats: typeof getBufferStats === 'function',
          error: null
        };
      } catch (error) {
        return {
          hasAddEvent: false,
          hasGetEvents: false,
          hasGetBufferStats: false,
          error: error.message
        };
      }
    });

    console.log('Event buffer test:', bufferTest);
  });

  test('should test manual console buffering', async ({ page }) => {
    await page.goto('http://localhost:14652');
    await page.waitForLoadState('networkidle');

    // Manually test event buffer
    const manualTest = await page.evaluate(() => {
      try {
        // Create a test console event manually
        const testEvent = {
          type: 'console',
          level: 'log',
          args: ['Manual test message'],
          timestamp: Date.now(),
          url: window.location.href
        };

        // Try to add it to buffer - we need to import the functions
        // Since we can't import in browser context, let's check if they're available globally
        return {
          windowKeys: Object.keys(window),
          a11yCapAvailable: typeof (window as any).A11yCap !== 'undefined',
          testEvent
        };
      } catch (error) {
        return {
          error: error.message,
          stack: error.stack
        };
      }
    });

    console.log('Manual test result:', manualTest);
  });
});