import { expect, test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils.js';

test.describe('Element Picker Tool', () => {
  test.beforeEach(async ({ page }) => {
    await setupA11yCapTest(page);
  });

  test('should show element picker overlay', async ({ page }) => {
    // Get element picker
    const pickerExists = await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      return picker !== null;
    });

    expect(pickerExists).toBe(true);

    // Start element picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      picker.enable();
    });

    // Wait for overlay to appear
    await page.waitForTimeout(100);

    // Check that glass pane is visible
    const glassPaneVisible = await page.evaluate(() => {
      const glassPane = document.querySelector('x-a11ycap-glass');
      return (
        glassPane && window.getComputedStyle(glassPane).display === 'block'
      );
    });

    expect(glassPaneVisible).toBe(true);

    // Check for control panel in shadow DOM
    const hasControls = await page.evaluate(() => {
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return false;

      const controls = glassPane.shadowRoot.querySelector('.controls');
      const doneButton = glassPane.shadowRoot.querySelector('.done');
      const clearButton = glassPane.shadowRoot.querySelector('.clear');

      return !!(controls && doneButton && clearButton);
    });

    expect(hasControls).toBe(true);

    // Cancel the picker
    await page.keyboard.press('Escape');
  });

  test('should select elements from test app', async ({ page }) => {
    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      picker.enable();
    });

    await page.waitForTimeout(100);

    // Click the test button through the overlay
    const buttonSelector = '#test-button';
    const button = await page.$(buttonSelector);
    const buttonBox = await button?.boundingBox();

    expect(buttonBox).toBeTruthy();

    if (buttonBox) {
      // Click on the glass pane at button position
      await page.mouse.click(
        buttonBox.x + buttonBox.width / 2,
        buttonBox.y + buttonBox.height / 2
      );
    }

    await page.waitForTimeout(100);

    // Check selection
    const selectedCount = await page.evaluate(() => {
      const pickedElements = document.querySelectorAll('.a11ycap-picked');
      return pickedElements.length;
    });

    expect(selectedCount).toBe(1);

    // Check counter updated
    const counterText = await page.evaluate(() => {
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return '';

      const counter = glassPane.shadowRoot.querySelector('.selected-count');
      return counter?.textContent || '';
    });

    expect(counterText).toBe('Selected: 1');

    // Complete selection
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        // Set up callback to capture results
        window.__pickerResult = null;
        const originalPicker = window.A11yCap.getElementPicker();
        
        // Override the current options with our callback
        originalPicker.currentOptions = {
          ...originalPicker.currentOptions,
          onElementsPicked: (elements) => {
            window.__pickerResult = elements;
            resolve(elements);
          }
        };

        const glassPane = document.querySelector('x-a11ycap-glass');
        if (!glassPane?.shadowRoot) {
          resolve(null);
          return;
        }

        const doneButton = glassPane.shadowRoot.querySelector(
          '.done'
        ) as HTMLElement;
        doneButton?.click();
      });
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      selector: expect.stringContaining('button'),
      text: expect.stringContaining('Click me'),
    });
  });

  test('should complete picker on Escape key', async ({ page }) => {
    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      picker.enable();
    });

    await page.waitForTimeout(100);

    // Set up callback first, then press Escape
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const originalPicker = window.A11yCap.getElementPicker();
        
        // Override the current options with our callback
        originalPicker.currentOptions = {
          ...originalPicker.currentOptions,
          onElementsPicked: (elements) => {
            resolve(elements);
          }
        };

        // Press Escape programmatically to complete
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
    });

    expect(result).toHaveLength(0);

    // Check overlay is hidden
    const overlayHidden = await page.evaluate(() => {
      const glassPane = document.querySelector('x-a11ycap-glass');
      return (
        !glassPane || window.getComputedStyle(glassPane).display === 'none'
      );
    });

    expect(overlayHidden).toBe(true);
  });

  test('should support multi-select with form elements', async ({ page }) => {
    // Show the form first
    await page.click('#show-form-button');
    await page.waitForSelector('#test-form', { state: 'visible' });

    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      picker.enable();
    });

    await page.waitForTimeout(100);

    // Hold Shift for multi-select
    await page.keyboard.down('Shift');

    // Select multiple form elements
    const nameInput = await page.$('#name');
    const nameBox = await nameInput?.boundingBox();
    if (nameBox) {
      await page.mouse.click(
        nameBox.x + nameBox.width / 2,
        nameBox.y + nameBox.height / 2
      );
      await page.waitForTimeout(50);
    }

    const emailInput = await page.$('#email');
    const emailBox = await emailInput?.boundingBox();
    if (emailBox) {
      await page.mouse.click(
        emailBox.x + emailBox.width / 2,
        emailBox.y + emailBox.height / 2
      );
      await page.waitForTimeout(50);
    }

    await page.keyboard.up('Shift');

    // Check selection count
    const selectedCount = await page.evaluate(() => {
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return 0;

      const counter = glassPane.shadowRoot.querySelector('.selected-count');
      const text = counter?.textContent || '';
      const match = text.match(/Selected: (\d+)/);
      return match ? Number.parseInt(match[1]) : 0;
    });

    expect(selectedCount).toBe(2);

    // Complete selection
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const originalPicker = window.A11yCap.getElementPicker();
        
        // Override the current options with our callback
        originalPicker.currentOptions = {
          ...originalPicker.currentOptions,
          onElementsPicked: (elements) => {
            resolve(elements);
          }
        };

        const glassPane = document.querySelector('x-a11ycap-glass');
        if (!glassPane?.shadowRoot) {
          resolve(null);
          return;
        }

        const doneButton = glassPane.shadowRoot.querySelector(
          '.done'
        ) as HTMLElement;
        doneButton?.click();
      });
    });

    expect(result).toHaveLength(2);
    expect(result[0].selector).toContain('#name');
    expect(result[1].selector).toContain('#email');
  });

  test('should generate correct CSS selectors for test app elements', async ({
    page,
  }) => {
    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      picker.enable();
    });

    await page.waitForTimeout(100);

    // Select the test button (has ID)
    const button = await page.$('#test-button');
    const buttonBox = await button?.boundingBox();
    if (buttonBox) {
      await page.mouse.click(
        buttonBox.x + buttonBox.width / 2,
        buttonBox.y + buttonBox.height / 2
      );
    }

    // Complete and check result
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const originalPicker = window.A11yCap.getElementPicker();
        
        // Override the current options with our callback
        originalPicker.currentOptions = {
          ...originalPicker.currentOptions,
          onElementsPicked: (elements) => {
            resolve(elements);
          }
        };

        const glassPane = document.querySelector('x-a11ycap-glass');
        if (!glassPane?.shadowRoot) {
          resolve(null);
          return;
        }

        const doneButton = glassPane.shadowRoot.querySelector(
          '.done'
        ) as HTMLElement;
        doneButton?.click();
      });
    });

    expect(result).toHaveLength(1);
    expect(result[0].selector).toBe('#test-button');
    expect(result[0].text).toContain('Click me');
  });

  test('should return bounding boxes for selected elements', async ({
    page,
  }) => {
    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      picker.enable();
    });

    await page.waitForTimeout(100);

    // Select the test button
    const button = await page.$('#test-button');
    const buttonBox = await button?.boundingBox();

    if (buttonBox) {
      await page.mouse.click(
        buttonBox.x + buttonBox.width / 2,
        buttonBox.y + buttonBox.height / 2
      );
    }

    // Complete selection
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const originalPicker = window.A11yCap.getElementPicker();
        
        // Override the current options with our callback
        originalPicker.currentOptions = {
          ...originalPicker.currentOptions,
          onElementsPicked: (elements) => {
            resolve(elements);
          }
        };

        const glassPane = document.querySelector('x-a11ycap-glass');
        if (!glassPane?.shadowRoot) {
          resolve(null);
          return;
        }

        const doneButton = glassPane.shadowRoot.querySelector(
          '.done'
        ) as HTMLElement;
        doneButton?.click();
      });
    });

    expect(result).toHaveLength(1);
    expect(result[0].boundingBox).toBeDefined();
    expect(result[0].boundingBox.x).toBeGreaterThanOrEqual(0);
    expect(result[0].boundingBox.y).toBeGreaterThanOrEqual(0);
    expect(result[0].boundingBox.width).toBeGreaterThan(0);
    expect(result[0].boundingBox.height).toBeGreaterThan(0);
  });

  test('should handle keyboard shortcuts for completion', async ({ page }) => {
    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      picker.enable();
    });

    await page.waitForTimeout(100);

    // Select an element
    const button = await page.$('#test-button');
    const buttonBox = await button?.boundingBox();

    if (buttonBox) {
      await page.mouse.click(
        buttonBox.x + buttonBox.width / 2,
        buttonBox.y + buttonBox.height / 2
      );
    }

    await page.waitForTimeout(100);

    // Use Escape key to complete (the only keyboard shortcut supported)
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const originalPicker = window.A11yCap.getElementPicker();
        
        // Override the current options with our callback
        originalPicker.currentOptions = {
          ...originalPicker.currentOptions,
          onElementsPicked: (elements) => {
            resolve(elements);
          }
        };

        // Press Escape to complete
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
    });

    expect(result).toHaveLength(1);
    expect(result[0].text).toContain('Click me');
  });

  test('should highlight elements on hover', async ({ page }) => {
    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      picker.enable();
    });

    await page.waitForTimeout(100);

    // Move mouse over button
    const button = await page.$('#test-button');
    const buttonBox = await button?.boundingBox();

    if (buttonBox) {
      await page.mouse.move(
        buttonBox.x + buttonBox.width / 2,
        buttonBox.y + buttonBox.height / 2
      );
      await page.waitForTimeout(100);
    }

    // Check for hover highlight (now uses CSS classes on elements)
    const hasHoverHighlight = await page.evaluate(() => {
      const hoveredElements = document.querySelectorAll('.a11ycap-hovered');
      return hoveredElements.length > 0;
    });

    expect(hasHoverHighlight).toBe(true);

    // Complete picker
    await page.keyboard.press('Escape');
  });
});

// Declare global window properties for TypeScript
declare global {
  interface Window {
    A11yCap: any;
    __pickerPromise: Promise<any>;
  }
}
