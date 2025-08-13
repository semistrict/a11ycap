import { expect, test } from '@playwright/test';

test.describe('Click Ref Functionality', () => {
  test('should click element by ref from snapshot', async ({ page }) => {
    await page.goto('http://localhost:14652/');
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });

    // Take a snapshot to generate refs
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, {
        mode: 'ai',
        enableReact: true,
      });
    });

    console.log('Initial snapshot:', snapshot);

    // Extract a button ref from the snapshot
    const buttonMatch = snapshot.match(/button.*\[ref=(e\d+)\]/);
    expect(buttonMatch).toBeTruthy();
    const buttonRef = buttonMatch![1];

    console.log('Found button ref:', buttonRef);

    // Get initial button text
    const initialText = await page.evaluate(() => {
      return document.getElementById('test-button')?.textContent;
    });

    console.log('Initial button text:', initialText);

    // Use clickRef function to click the button
    const clickResult = await page.evaluate((ref) => {
      return window.A11yCap.clickRef(ref);
    }, buttonRef);

    expect(clickResult).toBe(true);

    // Verify button text changed (state updated)
    const newText = await page.evaluate(() => {
      return document.getElementById('test-button')?.textContent;
    });

    console.log('New button text:', newText);

    // The counter should have incremented
    expect(newText).not.toBe(initialText);
    expect(newText).toContain('Click me (1)');
  });

  test('should find element by ref', async ({ page }) => {
    await page.goto('http://localhost:14652/');
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });

    // Take a snapshot to generate refs
    await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, { mode: 'ai' });
    });

    // Test findElementByRef
    const foundElement = await page.evaluate(() => {
      // Find the button ref from the snapshot
      const buttons = document.querySelectorAll('button');
      let buttonRef = '';

      for (const button of buttons) {
        if ((button as any)._ariaRef?.ref) {
          buttonRef = (button as any)._ariaRef.ref;
          break;
        }
      }

      if (!buttonRef) return null;

      // Use findElementByRef to locate it
      const found = window.A11yCap.findElementByRef(buttonRef);
      return {
        found: !!found,
        isButton: found?.tagName === 'BUTTON',
        hasId: found?.id === 'test-button',
        ref: buttonRef,
      };
    });

    expect(foundElement).toBeTruthy();
    expect(foundElement!.found).toBe(true);
    expect(foundElement!.isButton).toBe(true);
    expect(foundElement!.hasId).toBe(true);

    console.log('Found element with ref:', foundElement!.ref);
  });

  test('should handle non-existent refs gracefully', async ({ page }) => {
    await page.goto('http://localhost:14652/');
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });

    // Try to click a non-existent ref
    const clickResult = await page.evaluate(() => {
      return window.A11yCap.clickRef('e999');
    });

    expect(clickResult).toBe(false);

    // Try to find a non-existent ref
    const foundElement = await page.evaluate(() => {
      return window.A11yCap.findElementByRef('e999');
    });

    expect(foundElement).toBe(null);
  });
});
