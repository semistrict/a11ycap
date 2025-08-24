import { expect, test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils';

test.describe('Capture Element Image Tool', () => {
  test.beforeEach(async ({ page }) => {
    await setupA11yCapTest(page);
  });

  test('should capture image of an element by ref', async ({ page }) => {
    // Get initial snapshot to find element refs
    const snapshotResult = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    expect(snapshotResult).toContain('button "Click me (0)"');
    expect(snapshotResult).toContain('[ref=e5]');

    // Capture image of the button
    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.capture_element_image.execute({
        id: 'test-capture',
        type: 'capture_element_image',
        payload: {
          element: 'button "Click me (0)"',
          ref: 'e5',
          captureSnapshot: false,
          quality: 0.8,
          backgroundColor: '#ffffff',
          cacheBust: false,
        },
      });
    });

    expect(result).toHaveProperty('format', 'png');
    expect(result).toHaveProperty('base64Data');
    expect(result).toHaveProperty('element', 'button "Click me (0)"');
    expect(result).toHaveProperty('ref', 'e5');
    expect(result.base64Data).toMatch(/^[A-Za-z0-9+/=]+$/); // Valid base64
    expect(result.base64Data.length).toBeGreaterThan(0);
  });

  test('should handle non-existent element ref', async ({ page }) => {
    const resultPromise = page.evaluate(() => {
      return window.A11yCap.toolHandlers.capture_element_image.execute({
        id: 'test-capture',
        type: 'capture_element_image',
        payload: {
          element: 'nonexistent element',
          ref: 'e999',
          captureSnapshot: false,
          quality: 0.8,
          cacheBust: false,
        },
      });
    });

    await expect(resultPromise).rejects.toThrow(
      'Element with ref "e999" not found'
    );
  });

  test('should handle quality parameter (PNG ignores quality)', async ({
    page,
  }) => {
    // Get a valid element ref first
    await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    // Test with quality setting (PNG ignores this but should not error)
    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.capture_element_image.execute({
        id: 'test-capture',
        type: 'capture_element_image',
        payload: {
          element: 'button',
          ref: 'e5',
          captureSnapshot: false,
          quality: 0.5,
          cacheBust: false,
        },
      });
    });

    expect(result.format).toBe('png');
    expect(result).toHaveProperty('base64Data');
    expect(result.base64Data).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  test('should handle background color option', async ({ page }) => {
    await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.capture_element_image.execute({
        id: 'test-capture',
        type: 'capture_element_image',
        payload: {
          element: 'button',
          ref: 'e5',
          captureSnapshot: false,
          quality: 0.8,
          backgroundColor: '#ff0000', // Red background
          cacheBust: false,
        },
      });
    });

    expect(result).toHaveProperty('format', 'png');
    expect(result).toHaveProperty('base64Data');
    expect(result.base64Data).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  test('should handle width and height options', async ({ page }) => {
    await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.capture_element_image.execute({
        id: 'test-capture',
        type: 'capture_element_image',
        payload: {
          element: 'button',
          ref: 'e5',
          captureSnapshot: false,
          quality: 0.8,
          width: 200,
          height: 100,
          cacheBust: false,
        },
      });
    });

    expect(result).toHaveProperty('format', 'png');
    expect(result).toHaveProperty('base64Data');
    expect(result.base64Data).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
