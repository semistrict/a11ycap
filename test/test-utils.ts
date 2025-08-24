import { Page } from '@playwright/test';

/**
 * Shared test utilities for A11yCap testing
 */

/**
 * Initialize A11yCap test environment by navigating to test page and waiting for library to load
 * @param page Playwright page object
 * @param options Optional configuration
 */
export async function setupA11yCapTest(
  page: Page,
  options: {
    /** Wait for React DevTools (default: false) */
    waitForReactDevTools?: boolean;
    /** Custom timeout in milliseconds (default: 5000) */
    timeout?: number;
  } = {}
) {
  const { waitForReactDevTools = false, timeout = 5000 } = options;

  // Navigate to test page
  await page.goto('http://localhost:14652');
  await page.waitForLoadState('networkidle');
  
  // Wait for A11yCap to finish initializing
  await page.waitForFunction(() => window.A11yCap, { timeout });
  
  // Optionally wait for React DevTools
  if (waitForReactDevTools) {
    await page.waitForFunction(() => window.__REACT_DEVTOOLS_GLOBAL_HOOK__, {
      timeout,
    });
  }
}

/**
 * Load A11yCap library via script tag (for tests that need manual loading)
 * @param page Playwright page object
 * @param scriptPath Path to the script (default: 'a11ycap/dist/browser.js')
 * @param timeout Timeout in milliseconds (default: 5000)
 */
export async function loadA11yCapScript(
  page: Page,
  scriptPath = 'a11ycap/dist/browser.js',
  timeout = 5000
) {
  await page.addScriptTag({ path: scriptPath });
  await page.waitForFunction(() => window.A11yCap, { timeout });
}