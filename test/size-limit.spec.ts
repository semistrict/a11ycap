import { expect, test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils';

test.describe('Size Limited Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    await setupA11yCapTest(page);
  });

  test('should return full snapshot when no size limit specified', async ({
    page,
  }) => {
    const fullSnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body);
    });

    // Should contain elements from the React test page
    expect(fullSnapshot).toContain('React Test Page');
    expect(fullSnapshot).toContain('Click me');
    expect(fullSnapshot).toContain('Show Form');
    console.log('Full snapshot:', fullSnapshot);
  });

  test('should limit snapshot size with max_chars parameter', async ({
    page,
  }) => {
    const limitedSnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body, {
        max_chars: 200,
      });
    });

    // Content before warning should be limited in size
    const contentBeforeWarning = limitedSnapshot.split('\n\n[WARNING:')[0];
    expect(contentBeforeWarning.length).toBeLessThanOrEqual(200);

    // Should still contain the root and some top-level elements
    expect(limitedSnapshot).toContain('React Test Page');
    console.log('Limited snapshot (200 chars):', limitedSnapshot);
  });

  test('should use breadth-first expansion', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Get snapshots with different size limits
      const small = await window.A11yCap.snapshotForAI(document.body, {
        max_chars: 150,
      });
      const medium = await window.A11yCap.snapshotForAI(document.body, {
        max_chars: 300,
      });
      const large = await window.A11yCap.snapshotForAI(document.body, {
        max_chars: 500,
      });

      return { small, medium, large };
    });

    console.log('Small (150):', result.small);
    console.log('Medium (300):', result.medium);
    console.log('Large (500):', result.large);

    // Each should be within size limits (check content before warning)
    const smallContent = result.small.split('\n\n[WARNING:')[0];
    const mediumContent = result.medium.split('\n\n[WARNING:')[0];
    const largeContent = result.large.split('\n\n[WARNING:')[0];

    expect(smallContent.length).toBeLessThanOrEqual(150);
    expect(mediumContent.length).toBeLessThanOrEqual(300);
    expect(largeContent.length).toBeLessThanOrEqual(500);

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
      return await window.A11yCap.snapshotForAI(document.body, {
        max_chars: 50,
      });
    });

    console.log('Tiny snapshot (50 chars):', tinySnapshot);

    // The content before the warning should be <= 50 chars
    const contentBeforeWarning = tinySnapshot.split('\n\n[WARNING:')[0];
    expect(contentBeforeWarning.length).toBeLessThanOrEqual(50);
    // Should be truncated but still valid
    expect(contentBeforeWarning.length).toBeGreaterThan(0);
    // Should have a warning message
    expect(tinySnapshot).toContain('[WARNING:');
  });

  test('should handle size limit smaller than root node', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Try with a very small limit that might be smaller than even the root
      return await window.A11yCap.snapshotForAI(document.body, {
        max_chars: 10,
      });
    });

    console.log('Ultra tiny snapshot (10 chars):', result);

    // The content before the warning should be <= 10 chars
    const contentBeforeWarning = result.split('\n\n[WARNING:')[0];
    expect(contentBeforeWarning.length).toBeLessThanOrEqual(10);
    expect(contentBeforeWarning.length).toBeGreaterThan(0);
    // Should have a warning message
    expect(result).toContain('[WARNING:');
  });

  test('should work with different modes and size limits', async ({ page }) => {
    const results = await page.evaluate(async () => {
      const aiMode = await window.A11yCap.snapshot(document.body, {
        mode: 'ai',
        max_chars: 200,
      });
      const expectMode = await window.A11yCap.snapshot(document.body, {
        mode: 'expect',
        max_chars: 200,
      });

      return { aiMode, expectMode };
    });

    console.log('AI mode limited:', results.aiMode);
    console.log('Expect mode limited:', results.expectMode);

    // Extract content before warning for size checking
    const aiContent = results.aiMode.split('\n\n[WARNING:')[0];
    const expectContent = results.expectMode.split('\n\n[WARNING:')[0];

    expect(aiContent.length).toBeLessThanOrEqual(200);
    expect(expectContent.length).toBeLessThanOrEqual(200);

    // AI mode should have refs, expect mode should not
    expect(results.aiMode).toMatch(/\[ref=e\d+\]/);
    expect(results.expectMode).not.toMatch(/\[ref=e\d+\]/);
  });

  test('should preserve structure integrity within size limit', async ({
    page,
  }) => {
    // Target the dedicated size test container instead of the entire body
    const snapshot = await page.evaluate(async () => {
      const testElement = document.getElementById('size-test-container');
      return await window.A11yCap.snapshotForAI(testElement || document.body, {
        max_chars: 300,
      });
    });

    console.log('Structure test snapshot:', snapshot);

    // Extract the content before the warning (if any)
    const contentBeforeWarning = snapshot.split('\n\n[WARNING:')[0];

    // Should not have broken lines or malformed structure
    expect(contentBeforeWarning).not.toMatch(/- $|^\s*-\s*$/m); // No empty list items

    // Count opening and closing brackets to ensure they're balanced
    const openBrackets = (contentBeforeWarning.match(/\[/g) || []).length;
    const closeBrackets = (contentBeforeWarning.match(/\]/g) || []).length;
    expect(openBrackets).toBe(closeBrackets);

    // The actual content should respect the size limit
    expect(contentBeforeWarning.length).toBeLessThanOrEqual(300);
  });
});
