import { expect, test } from '@playwright/test';
import { loadA11yCapScript } from './test-utils';

test.describe('Picked Elements in Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652');
    await loadA11yCapScript(page);
  });

  test('should show [picked] indicator for elements with a11ycap-picked class', async ({
    page,
  }) => {
    // Add picked class to the test button
    await page.evaluate(() => {
      const button = document.getElementById('test-button');
      if (button) {
        button.classList.add('a11ycap-picked');
      }
    });

    // Take snapshot
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    console.log('Snapshot with picked element:', snapshot);

    // Verify the button appears with [picked] indicator
    expect(snapshot).toContain('button "Click me (0)"');
    expect(snapshot).toContain('[picked]');
    
    // More specific check - ensure the picked button has the picked indicator
    expect(snapshot).toMatch(/button.*Click me.*\[picked\]/);
  });

  test('should show multiple [picked] elements in snapshot', async ({ page }) => {
    // Add picked class to multiple elements
    await page.evaluate(() => {
      const button = document.getElementById('test-button');
      const formButton = document.getElementById('show-form-button');
      if (button) button.classList.add('a11ycap-picked');
      if (formButton) formButton.classList.add('a11ycap-picked');
    });

    // Take snapshot
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    console.log('Snapshot with multiple picked elements:', snapshot);

    // Count occurrences of [picked] indicator
    const pickedCount = (snapshot.match(/\[picked\]/g) || []).length;
    expect(pickedCount).toBe(2);
    
    // Verify specific elements are marked as picked
    expect(snapshot).toMatch(/button.*Click me.*\[picked\]/);
    expect(snapshot).toMatch(/button.*Show Form.*\[picked\]/);
  });

  test('should not show [picked] for elements without the class', async ({
    page,
  }) => {
    // Take snapshot without adding picked class to any elements
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    console.log('Snapshot without picked elements:', snapshot);

    // Verify no [picked] indicators appear
    expect(snapshot).not.toContain('[picked]');
  });

  test('should show [picked] when using element picker', async ({ page }) => {
    // Use element picker to pick an element
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      picker.enable();
    });

    // Wait for element picker to be active
    await page.waitForTimeout(100);

    // Click on the test button through the glass pane
    const buttonSelector = '#test-button';
    const button = await page.$(buttonSelector);
    const buttonBox = await button?.boundingBox();

    if (buttonBox) {
      await page.mouse.click(
        buttonBox.x + buttonBox.width / 2,
        buttonBox.y + buttonBox.height / 2
      );
    }

    await page.waitForTimeout(100);

    // Complete the element picker (but keep picked elements)
    await page.evaluate(() => {
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (glassPane?.shadowRoot) {
        const doneButton = glassPane.shadowRoot.querySelector('.done') as HTMLElement;
        doneButton?.click();
      }
    });

    // Take snapshot after element picker usage
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    console.log('Snapshot after element picker usage:', snapshot);

    // Verify the picked element shows [picked] indicator
    expect(snapshot).toContain('[picked]');
    expect(snapshot).toMatch(/button.*Click me.*\[picked\]/);
  });

  test('should preserve [picked] indicators across snapshot modes', async ({
    page,
  }) => {
    // Add picked class to an element
    await page.evaluate(() => {
      const button = document.getElementById('test-button');
      if (button) {
        button.classList.add('a11ycap-picked');
      }
    });

    // Test AI mode snapshot
    const aiSnapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, { 
        mode: 'ai', 
        enableReact: true 
      });
    });

    // Test expect mode snapshot
    const expectSnapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, { 
        mode: 'expect',
        enableReact: true 
      });
    });

    console.log('AI mode snapshot:', aiSnapshot);
    console.log('Expect mode snapshot:', expectSnapshot);

    // Both should show [picked] indicator
    expect(aiSnapshot).toContain('[picked]');
    expect(expectSnapshot).toContain('[picked]');
    
    // Verify the specific element is marked in both modes
    expect(aiSnapshot).toMatch(/button.*Click me.*\[picked\]/);
    expect(expectSnapshot).toMatch(/button.*Click me.*\[picked\]/);
  });
});