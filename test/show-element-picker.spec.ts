import { expect, test } from '@playwright/test';

test.describe('Element Picker Tool', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test app
    await page.goto('http://localhost:14652/');

    // Wait for A11yCap to be available
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
  });

  test('should show element picker overlay', async ({ page }) => {
    // Get element picker
    const pickerExists = await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      return picker !== null;
    });

    expect(pickerExists).toBe(true);

    // Start element picker (non-blocking in test context)
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      // Store promise globally so we can check it later
      window.__pickerPromise = picker.pick();
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
      const cancelButton = glassPane.shadowRoot.querySelector('.cancel');

      return !!(controls && doneButton && cancelButton);
    });

    expect(hasControls).toBe(true);

    // Cancel the picker
    await page.keyboard.press('Escape');
  });

  test('should select elements from test app', async ({ page }) => {
    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      window.__pickerPromise = picker.pick();
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
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return 0;

      const selected = glassPane.shadowRoot.querySelectorAll(
        '.highlight.selected'
      );
      return selected.length;
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
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return null;

      const doneButton = glassPane.shadowRoot.querySelector(
        '.done'
      ) as HTMLElement;
      doneButton?.click();

      // Wait for promise to resolve
      const picked = await window.__pickerPromise;
      return picked;
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      selector: expect.stringContaining('button'),
      text: expect.stringContaining('Click me'),
    });
  });

  test.skip('should cancel picker on Escape key', async ({ page }) => {
    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      window.__pickerPromise = picker.pick();
    });

    await page.waitForTimeout(100);

    // Press Escape
    await page.keyboard.press('Escape');

    // Check result
    const result = await page.evaluate(async () => {
      const picked = await window.__pickerPromise;
      return picked;
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
      window.__pickerPromise = picker.pick();
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
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return null;

      const doneButton = glassPane.shadowRoot.querySelector(
        '.done'
      ) as HTMLElement;
      doneButton?.click();

      const picked = await window.__pickerPromise;
      return picked;
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
      window.__pickerPromise = picker.pick();
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
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return null;

      const doneButton = glassPane.shadowRoot.querySelector(
        '.done'
      ) as HTMLElement;
      doneButton?.click();

      const picked = await window.__pickerPromise;
      return picked;
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
      window.__pickerPromise = picker.pick();
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
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return null;

      const doneButton = glassPane.shadowRoot.querySelector(
        '.done'
      ) as HTMLElement;
      doneButton?.click();

      const picked = await window.__pickerPromise;
      return picked;
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
      window.__pickerPromise = picker.pick();
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

    // Use keyboard shortcut to complete (Cmd/Ctrl + Enter)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+Enter`);

    // Check result
    const result = await page.evaluate(async () => {
      const picked = await window.__pickerPromise;
      return picked;
    });

    expect(result).toHaveLength(1);
    expect(result[0].text).toContain('Click me');
  });

  test('should highlight elements on hover', async ({ page }) => {
    // Start picker
    await page.evaluate(() => {
      const picker = window.A11yCap.getElementPicker();
      window.__pickerPromise = picker.pick();
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

    // Check for hover highlight
    const hasHoverHighlight = await page.evaluate(() => {
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return false;

      const highlights =
        glassPane.shadowRoot.querySelectorAll('.highlight.hovered');
      return highlights.length > 0;
    });

    expect(hasHoverHighlight).toBe(true);

    // Check for tooltip
    const hasTooltip = await page.evaluate(() => {
      const glassPane = document.querySelector('x-a11ycap-glass');
      if (!glassPane?.shadowRoot) return false;

      const tooltip = glassPane.shadowRoot.querySelector('.tooltip');
      return tooltip !== null && tooltip.textContent !== '';
    });

    expect(hasTooltip).toBe(true);

    // Cancel picker
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
