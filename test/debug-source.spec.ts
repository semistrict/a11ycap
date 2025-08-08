import { expect, test } from '@playwright/test';

test.describe('Debug Source Information', () => {
  test('should extract debug source info from data attributes', async ({ page }) => {
    await page.goto('http://localhost:14652/');
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });

    const debugSourceInfo = await page.evaluate(() => {
      const button = document.getElementById('test-button');
      if (!button) return { error: 'Button not found' };
      
      // Check for data attributes from Babel plugin
      const dataDebugId = button.getAttribute('data-debug-id');
      const dataDebugSource = button.getAttribute('data-debug-source');
      
      // Test extractReactInfo to see if it picks up debug source
      const extractReactInfo = window.A11yCap.extractReactInfo;
      let reactInfo = null;
      try {
        reactInfo = extractReactInfo ? extractReactInfo(button) : 'extractReactInfo not found';
      } catch (e) {
        reactInfo = { error: e.message };
      }

      return {
        hasButton: !!button,
        dataDebugId,
        dataDebugSource,
        hasDataAttributes: !!(dataDebugId || dataDebugSource),
        reactInfo
      };
    });
    
    console.log('Debug source info:', debugSourceInfo);

    // Assertions
    expect(debugSourceInfo.hasButton).toBe(true);
    
    // This test should FAIL if debug source info is not available
    if (!debugSourceInfo.hasDataAttributes) {
      throw new Error('EXPECTED FAILURE: No debug source data attributes found. Babel plugin may not be working.');
    }
    
    if (!debugSourceInfo.reactInfo?.debugSource) {
      throw new Error('EXPECTED FAILURE: extractReactInfo did not return debugSource. React utils may not be reading data attributes.');
    }

    // If we get here, debug source is working
    expect(debugSourceInfo.dataDebugId).toBeTruthy();
    expect(debugSourceInfo.dataDebugSource).toContain(':');
    expect(debugSourceInfo.reactInfo.debugSource).toBeTruthy();
  });
});