// Debug script to test React component name extraction
const { test } = require('@playwright/test');

test('debug react component names', async ({ page }) => {
  await page.goto('http://localhost:14652/');
  await page.waitForFunction(() => window.testReady, { timeout: 5000 });
  await page.waitForFunction(() => window.__REACT_DEVTOOLS_GLOBAL_HOOK__, { timeout: 5000 });

  // Enable debug logging
  await page.evaluate(() => {
    window.DEBUG_REACT_SNAPSHOT = true;
  });

  // Test snapshot with debug logging
  const snapshot = await page.evaluate(() => {
    console.log('[DEBUG] Starting snapshot with React enabled...');
    return window.snapshot(document.body, { mode: 'ai', enableReact: true });
  });

  console.log('Final snapshot:', snapshot);
});