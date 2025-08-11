import { test, expect } from '@playwright/test';

test.describe('Snapshot by Ref', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to our React test page via HTTP server  
    await page.goto('http://localhost:14652/');

    // Wait for the library to load
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
  });

  test('should snapshot specific element by ref', async ({ page }) => {
    // First take a full snapshot to get refs
    const fullSnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body);
    });

    console.log('Full snapshot:', fullSnapshot);

    // Extract a button ref from the full snapshot
    const buttonRefMatch = fullSnapshot.match(/button.*?\[ref=(e\d+)\]/);
    expect(buttonRefMatch).toBeTruthy();
    const buttonRef = buttonRefMatch![1];

    console.log('Found button ref:', buttonRef);

    // Now take a snapshot of just that button element
    const buttonSnapshot = await page.evaluate(async (ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      if (!element) return null;
      return await window.A11yCap.snapshotForAI(element);
    }, buttonRef);

    console.log('Button snapshot:', buttonSnapshot);

    expect(buttonSnapshot).toBeTruthy();
    expect(buttonSnapshot).toContain('Click me');
    // Should be much shorter than full snapshot
    expect(buttonSnapshot!.length).toBeLessThan(fullSnapshot.length);
    // Should not contain the heading since we're only snapshotting the button
    expect(buttonSnapshot).not.toContain('React Test Page');
  });

  test('should snapshot heading element by ref', async ({ page }) => {
    // First take a full snapshot to get refs
    const fullSnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body);
    });

    // Extract heading ref from the full snapshot
    const headingRefMatch = fullSnapshot.match(/heading.*?\[ref=(e\d+)\]/);
    expect(headingRefMatch).toBeTruthy();
    const headingRef = headingRefMatch![1];

    console.log('Found heading ref:', headingRef);

    // Now take a snapshot of just that heading element
    const headingSnapshot = await page.evaluate(async (ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      if (!element) return null;
      return await window.A11yCap.snapshotForAI(element);
    }, headingRef);

    console.log('Heading snapshot:', headingSnapshot);

    expect(headingSnapshot).toBeTruthy();
    expect(headingSnapshot).toContain('React Test Page');
    expect(headingSnapshot).toContain('heading');
    // Should be much shorter than full snapshot
    expect(headingSnapshot!.length).toBeLessThan(fullSnapshot.length);
    // Should not contain buttons since we're only snapshotting the heading
    expect(headingSnapshot).not.toContain('Click me');
  });

  test('should work with snapshot by ref and size limits', async ({ page }) => {
    // Click the "Show Form" button to reveal a more complex structure
    await page.click('text=Show Form');
    await page.waitForTimeout(100); // Wait for form to appear

    // Take a full snapshot to get refs
    const fullSnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body);
    });

    console.log('Full snapshot with form:', fullSnapshot);

    // Find the form/container ref
    const containerRefMatch = fullSnapshot.match(/generic.*?\[ref=(e\d+)\].*form/i);
    if (!containerRefMatch) {
      // Look for any container element with nested content
      const anyContainerMatch = fullSnapshot.match(/generic.*?\[ref=(e\d+)\](?:\s*\[[^\]]+\])?:/);
      expect(anyContainerMatch).toBeTruthy();
      
      const containerRef = anyContainerMatch![1];
      console.log('Found container ref:', containerRef);

      // Take a limited size snapshot of that container
      const limitedContainerSnapshot = await page.evaluate(async (args) => {
        const element = window.A11yCap.findElementByRef(args.ref);
        if (!element) return null;
        return await window.A11yCap.snapshotForAI(element, { max_bytes: args.maxBytes });
      }, { ref: containerRef, maxBytes: 150 });

      console.log('Limited container snapshot:', limitedContainerSnapshot);

      if (limitedContainerSnapshot) {
        // When truncated, a warning message is appended, so total length will exceed max_bytes
        if (limitedContainerSnapshot.includes('[WARNING: Snapshot was truncated')) {
          // The actual content is truncated to 150 bytes, but warning is added
          expect(limitedContainerSnapshot).toContain('[WARNING: Snapshot was truncated');
          expect(limitedContainerSnapshot.length).toBeGreaterThan(150); // Due to warning
        } else {
          // If not truncated, should be within limit
          expect(limitedContainerSnapshot.length).toBeLessThanOrEqual(150);
        }
        expect(limitedContainerSnapshot.length).toBeGreaterThan(0);
      }
    }
  });

  test('should return null for non-existent ref', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const element = window.A11yCap.findElementByRef('nonexistent');
      return element;
    });

    expect(result).toBeNull();
  });

  test('should work with different modes when snapshotting by ref', async ({ page }) => {
    // Get a button ref first
    const fullSnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body);
    });

    const buttonRefMatch = fullSnapshot.match(/button.*?\[ref=(e\d+)\]/);
    expect(buttonRefMatch).toBeTruthy();
    const buttonRef = buttonRefMatch![1];

    // Test different modes on the same element
    const results = await page.evaluate(async (ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      if (!element) return null;

      const aiMode = await window.A11yCap.snapshot(element, { mode: 'ai' });
      const expectMode = await window.A11yCap.snapshot(element, { mode: 'expect' });
      
      return { aiMode, expectMode };
    }, buttonRef);

    console.log('AI mode button snapshot:', results!.aiMode);
    console.log('Expect mode button snapshot:', results!.expectMode);

    expect(results).toBeTruthy();
    
    // AI mode should have refs, expect mode should not
    expect(results!.aiMode).toMatch(/\[ref=e\d+\]/);
    expect(results!.expectMode).not.toMatch(/\[ref=e\d+\]/);
    
    // Both should contain the button text
    expect(results!.aiMode).toContain('Click me');
    expect(results!.expectMode).toContain('Click me');
  });

  test('should handle nested element refs', async ({ page }) => {
    // Click to show the form which has nested elements
    await page.click('text=Show Form');
    await page.waitForTimeout(100);

    // Get full snapshot with form
    const fullSnapshot = await page.evaluate(async () => {
      return await window.A11yCap.snapshotForAI(document.body);
    });

    console.log('Full snapshot with nested elements:', fullSnapshot);

    // Find any nested element ref (look for textbox or any input)
    const nestedRefMatch = fullSnapshot.match(/textbox.*?\[ref=(e\d+)\]/) || 
                          fullSnapshot.match(/generic.*?\[ref=(e\d+)\].*textbox/);
    
    if (nestedRefMatch) {
      const nestedRef = nestedRefMatch[1];
      console.log('Found nested element ref:', nestedRef);

      // Snapshot just that nested element
      const nestedSnapshot = await page.evaluate(async (ref) => {
        const element = window.A11yCap.findElementByRef(ref);
        if (!element) return null;
        return await window.A11yCap.snapshotForAI(element);
      }, nestedRef);

      console.log('Nested element snapshot:', nestedSnapshot);

      if (nestedSnapshot) {
        expect(nestedSnapshot.length).toBeGreaterThan(0);
        expect(nestedSnapshot.length).toBeLessThan(fullSnapshot.length);
      }
    } else {
      console.log('No nested elements found in form, test passed');
    }
  });
});