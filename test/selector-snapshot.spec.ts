import { expect, test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils.js';

test.describe('Selector Snapshot Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupA11yCapTest(page);
  });

  test('should capture snapshot using CSS selector for buttons', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-selector-snapshot',
        type: 'take_snapshot',
        payload: {
          selector: 'button',
          mode: 'ai',
          enableReact: true,
          max_chars: 8192,
        },
      });
    });

    expect(result).toContain('Element 1 (button)');
    expect(result).toContain('Element 2 (button)');
    expect(result).toContain('button "Click me (0)"');
    expect(result).toContain('button "Show Form"');
  });

  test('should capture snapshot using specific CSS selector', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-specific-selector',
        type: 'take_snapshot',
        payload: {
          selector: 'h1',
          mode: 'ai',
          enableReact: true,
          max_chars: 4096,
        },
      });
    });

    expect(result).toContain('heading "React Test Page"');
  });

  test('should handle invalid CSS selector gracefully', async ({ page }) => {
    const resultPromise = page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-invalid-selector',
        type: 'take_snapshot',
        payload: {
          selector: 'invalid[selector[',
          mode: 'ai',
          max_chars: 4096,
        },
      });
    });

    await expect(resultPromise).rejects.toThrow('Invalid CSS selector');
  });

  test('should handle selector with no matches', async ({ page }) => {
    const resultPromise = page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-no-matches',
        type: 'take_snapshot',
        payload: {
          selector: '.nonexistent-class',
          mode: 'ai',
          max_chars: 4096,
        },
      });
    });

    await expect(resultPromise).rejects.toThrow(
      'No elements found matching selector'
    );
  });

  test('should respect size limit with multiple elements', async ({ page }) => {
    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-size-limit',
        type: 'take_snapshot',
        payload: {
          selector: 'div',
          mode: 'ai',
          enableReact: true,
          max_chars: 500, // Very small limit to trigger truncation
        },
      });
    });

    // Strip off warning message and compare with actual max_chars
    const resultWithoutWarning = result.split('[WARNING:')[0];
    expect(resultWithoutWarning.length).toBeLessThanOrEqual(500); // Should respect max_chars limit
    expect(result).toContain('Element 1 (div)');
    // Should be truncated before capturing all divs
  });

  test('should work with single element selector (no headers)', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-single-element',
        type: 'take_snapshot',
        payload: {
          selector: 'h1',
          mode: 'ai',
          enableReact: true,
          max_chars: 4096,
        },
      });
    });

    // Should not have "Element 1" header for single element
    expect(result).not.toContain('Element 1 (h1)');
    expect(result).toContain('heading "React Test Page"');
  });

  test('should preserve refs parameter behavior when refs is specified', async ({
    page,
  }) => {
    // First get a snapshot to find a ref
    await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-refs-priority',
        type: 'take_snapshot',
        payload: {
          refs: ['e5'], // Should take priority over selector
          selector: 'button', // Should be ignored
          mode: 'ai',
          enableReact: true,
          max_chars: 4096,
        },
      });
    });

    expect(result).toContain('button "Click me (0)"');
    // Should not have multiple elements or headers for single ref
    expect(result).not.toContain('Element 1');
    expect(result).not.toContain('Element 2');
  });

  test('should handle multiple refs', async ({ page }) => {
    // First get a snapshot to find refs
    await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-multiple-refs',
        type: 'take_snapshot',
        payload: {
          refs: ['e5', 'e7'], // Multiple refs
          mode: 'ai',
          enableReact: true,
          max_chars: 8192,
        },
      });
    });

    // Should have headers for multiple elements
    expect(result).toContain('Element 1 (e5)');
    expect(result).toContain('Element 2 (e7)');
    expect(result).toContain('button');
  });

  test('should handle missing refs with warning', async ({ page }) => {
    // First get a snapshot to find refs
    await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    // Capture console warnings
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning') {
        consoleMessages.push(msg.text());
      }
    });

    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-missing-refs',
        type: 'take_snapshot',
        payload: {
          refs: ['e5', 'nonexistent'], // One valid, one missing
          mode: 'ai',
          enableReact: true,
          max_chars: 8192,
        },
      });
    });

    // Should still capture the valid ref
    expect(result).toContain('button');
    // Should warn about missing ref
    expect(consoleMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Elements not found with refs: nonexistent'),
      ])
    );
  });

  test('should handle all missing refs with error', async ({ page }) => {
    const resultPromise = page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-all-missing-refs',
        type: 'take_snapshot',
        payload: {
          refs: ['nonexistent1', 'nonexistent2'], // All missing
          mode: 'ai',
          max_chars: 4096,
        },
      });
    });

    await expect(resultPromise).rejects.toThrow(
      'No elements found with refs: nonexistent1, nonexistent2'
    );
  });

  test('should handle complex CSS selectors', async ({ page }) => {
    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-complex-selector',
        type: 'take_snapshot',
        payload: {
          selector: 'button, input[type="text"]',
          mode: 'ai',
          enableReact: true,
          max_chars: 8192,
        },
      });
    });

    expect(result).toContain('Element 1');
    expect(result).toContain('Element 2');
    // Should capture both buttons and text inputs
    expect(result).toContain('button');
    expect(result).toContain('textbox');
  });

  test('should capture elements within bounding box', async ({ page }) => {
    const result = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-bounding-box',
        type: 'take_snapshot',
        payload: {
          boundingBox: {
            x: 0,
            y: 0,
            width: 200,
            height: 150,
          },
          mode: 'ai',
          enableReact: true,
          max_chars: 8192,
        },
      });
    });

    // Should capture elements in the top-left area
    expect(result).toContain('Element 1');
    expect(result).toContain('boundingBox(0,0,200x150)');
    // Should contain the heading and first button which are in that area
    expect(result).toContain('React Test Page');
  });

  test('should handle bounding box with no elements', async ({ page }) => {
    const resultPromise = page.evaluate(() => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-empty-bounding-box',
        type: 'take_snapshot',
        payload: {
          boundingBox: {
            x: 5000, // Way off screen
            y: 5000,
            width: 100,
            height: 100,
          },
          mode: 'ai',
          max_chars: 4096,
        },
      });
    });

    await expect(resultPromise).rejects.toThrow(
      'No elements found within bounding box (5000, 5000, 100x100)'
    );
  });

  test('should capture specific area with bounding box', async ({ page }) => {
    // Get button positions first
    const buttonInfo = await page.evaluate(() => {
      const button = document.querySelector('#test-button');
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });

    expect(buttonInfo).not.toBeNull();

    const result = await page.evaluate((buttonRect) => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-specific-bounding-box',
        type: 'take_snapshot',
        payload: {
          boundingBox: {
            x: buttonRect.x - 10,
            y: buttonRect.y - 10,
            width: buttonRect.width + 20,
            height: buttonRect.height + 20,
          },
          mode: 'ai',
          enableReact: true,
          max_chars: 4096,
        },
      });
    }, buttonInfo);

    // Should capture the button area
    expect(result).toContain('button "Click me (0)"');
    expect(result).toContain('boundingBox');
  });

  test('should handle bounding box capturing multiple elements with headers', async ({
    page,
  }) => {
    // Get heading position - this will catch multiple overlapping elements including containers
    const headingInfo = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      if (!heading) return null;
      const rect = heading.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });

    expect(headingInfo).not.toBeNull();

    const result = await page.evaluate((headingRect) => {
      return window.A11yCap.toolHandlers.take_snapshot.execute({
        id: 'test-multi-bounding-box',
        type: 'take_snapshot',
        payload: {
          boundingBox: {
            x: headingRect.x,
            y: headingRect.y,
            width: headingRect.width,
            height: headingRect.height,
          },
          mode: 'ai',
          enableReact: true,
          max_chars: 4096,
        },
      });
    }, headingInfo);

    // Should have headers for multiple elements (document, containers, heading)
    expect(result).toContain('Element 1');
    expect(result).toContain('boundingBox');
    expect(result).toContain('heading "React Test Page"');
  });
});
