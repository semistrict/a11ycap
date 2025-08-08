import { test, expect } from '@playwright/test';

test.describe('Size Limited Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to our React test page via HTTP server  
    await page.goto('http://localhost:14652/');

    // Wait for the library to load
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
  });

  test('should return full snapshot when no size limit specified', async ({ page }) => {
    const fullSnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body);
    });

    // Should contain elements from the React test page
    expect(fullSnapshot).toContain('React Test Page');
    expect(fullSnapshot).toContain('Click me');
    expect(fullSnapshot).toContain('Show Form');
    console.log('Full snapshot:', fullSnapshot);
  });

  test('should limit snapshot size with max_bytes parameter', async ({ page }) => {
    const limitedSnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body, { max_bytes: 200 });
    });

    // Should be limited in size
    expect(limitedSnapshot.length).toBeLessThanOrEqual(200);
    
    // Should still contain the root and some top-level elements
    expect(limitedSnapshot).toContain('React Test Page');
    console.log('Limited snapshot (200 bytes):', limitedSnapshot);
  });

  test('should use breadth-first expansion', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Get snapshots with different size limits
      const small = await window.A11yCap.snapshotForAI(document.body, { max_bytes: 150 });
      const medium = await window.A11yCap.snapshotForAI(document.body, { max_bytes: 300 });
      const large = await window.A11yCap.snapshotForAI(document.body, { max_bytes: 500 });
      
      return { small, medium, large };
    });

    console.log('Small (150):', result.small);
    console.log('Medium (300):', result.medium);
    console.log('Large (500):', result.large);

    // Each should be within size limits
    expect(result.small.length).toBeLessThanOrEqual(150);
    expect(result.medium.length).toBeLessThanOrEqual(300);
    expect(result.large.length).toBeLessThanOrEqual(500);

    // Larger limits should contain more content
    expect(result.medium.length).toBeGreaterThanOrEqual(result.small.length);
    expect(result.large.length).toBeGreaterThanOrEqual(result.medium.length);

    // All should start with the same root structure due to breadth-first
    const rootPattern = /- heading "React Test Page"/;
    expect(result.small).toMatch(rootPattern);
    expect(result.medium).toMatch(rootPattern);
    expect(result.large).toMatch(rootPattern);
  });

  test('should handle very small size limits', async ({ page }) => {
    const tinySnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body, { max_bytes: 50 });
    });

    console.log('Tiny snapshot (50 bytes):', tinySnapshot);
    
    expect(tinySnapshot.length).toBeLessThanOrEqual(50);
    // Should be truncated but still valid
    expect(tinySnapshot.length).toBeGreaterThan(0);
  });

  test('should handle size limit smaller than root node', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Try with a very small limit that might be smaller than even the root
      return await window.A11yCap.snapshotForAI(document.body, { max_bytes: 10 });
    });

    console.log('Ultra tiny snapshot (10 bytes):', result);
    
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should work with different modes and size limits', async ({ page }) => {
    const results = await page.evaluate(async () => {
      const aiMode = await window.A11yCap.snapshot(document.body, { 
        mode: 'ai', 
        max_bytes: 200 
      });
      const expectMode = await window.A11yCap.snapshot(document.body, { 
        mode: 'expect', 
        max_bytes: 200 
      });
      
      return { aiMode, expectMode };
    });

    console.log('AI mode limited:', results.aiMode);
    console.log('Expect mode limited:', results.expectMode);

    expect(results.aiMode.length).toBeLessThanOrEqual(200);
    expect(results.expectMode.length).toBeLessThanOrEqual(200);

    // AI mode should have refs, expect mode should not
    expect(results.aiMode).toMatch(/\[ref=e\d+\]/);
    expect(results.expectMode).not.toMatch(/\[ref=e\d+\]/);
  });

  test('should preserve structure integrity within size limit', async ({ page }) => {
    // Target the dedicated size test container instead of the entire body
    const snapshot = await page.evaluate(async () => {
      const testElement = document.getElementById('size-test-container');
      return await window.A11yCap.snapshotForAI(testElement || document.body, { max_bytes: 300 });
    });

    console.log('Structure test snapshot:', snapshot);

    // Should not have broken lines or malformed structure
    expect(snapshot).not.toMatch(/- $|^\s*-\s*$/m); // No empty list items
    
    // Count opening and closing brackets to ensure they're balanced
    const openBrackets = (snapshot.match(/\[/g) || []).length;
    const closeBrackets = (snapshot.match(/\]/g) || []).length;
    expect(openBrackets).toBe(closeBrackets);
  });
});