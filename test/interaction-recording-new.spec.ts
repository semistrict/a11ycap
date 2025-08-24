import { test, expect } from '@playwright/test';
import { setupA11yCapTest } from './test-utils';

test.describe('New Interaction Recording UI', () => {
  test.beforeEach(async ({ page }) => {
    await setupA11yCapTest(page);
  });

  test('should show main menu on triple-ESC', async ({ page }) => {
    // Triple-press ESC to open main menu
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Wait for main menu to appear
    await page.waitForFunction(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      return menu && menu.style.display === 'block';
    });

    // Check menu is visible
    const menuVisible = await page.evaluate(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      return menu?.shadowRoot?.querySelector('.menu-title')?.textContent?.includes('A11yCap Tools');
    });
    expect(menuVisible).toBe(true);
  });

  test('should start recording automatically when selected from menu', async ({ page }) => {
    // Open main menu
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await page.waitForFunction(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      return menu && menu.style.display === 'block';
    });

    // Click on Interaction Recorder option
    await page.evaluate(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      const shadowRoot = menu?.shadowRoot;
      const recorderOption = shadowRoot?.querySelector('[data-action="recorder"]') as HTMLElement;
      recorderOption?.click();
    });

    // Wait for recorder to appear
    await page.waitForFunction(() => {
      const recorder = document.querySelector('x-a11ycap-recorder');
      return recorder && recorder.style.display === 'block';
    });

    // Verify recording started automatically
    const isRecording = await page.evaluate(() => {
      return (window as any).A11yCap?.isRecordingActive?.();
    });
    expect(isRecording).toBe(true);

    // Verify UI shows recording state
    const recordButtonText = await page.evaluate(() => {
      const recorder = document.querySelector('x-a11ycap-recorder');
      const shadowRoot = recorder?.shadowRoot;
      const buttonText = shadowRoot?.querySelector('.record-button .button-text');
      return buttonText?.textContent;
    });
    expect(recordButtonText).toBe('Stop Recording');
  });

  test('should record interactions when recording is active', async ({ page }) => {
    // Clear any existing events
    await page.evaluate(() => {
      window.A11yCap.clearEvents();
    });

    // Open menu and start recording
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await page.waitForFunction(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      return menu && menu.style.display === 'block';
    });

    await page.evaluate(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      const shadowRoot = menu?.shadowRoot;
      const recorderOption = shadowRoot?.querySelector('[data-action="recorder"]') as HTMLElement;
      recorderOption?.click();
    });

    // Wait for recording to start
    await page.waitForFunction(() => {
      return (window as any).A11yCap?.isRecordingActive?.();
    });

    // Perform some interactions
    await page.click('button:has-text("Click me")');
    await page.fill('input[type="text"]', 'Test input');

    // Wait for events to be recorded with polling
    await page.waitForFunction(async () => {
      const events = await window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: { limit: 100 },
      });
      return events.includes('Click on button') && events.includes('Test input');
    }, { timeout: 5000 });

    // Get recorded events for final assertion
    const events = await page.evaluate(async () => {
      return await window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: { limit: 100 },
      });
    });

    expect(events).toContain('Click on button');
    expect(events).toContain('Test input');
  });

  test('should allow stopping recording', async ({ page }) => {
    // Start recording via menu
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await page.waitForFunction(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      return menu && menu.style.display === 'block';
    });

    await page.evaluate(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      const shadowRoot = menu?.shadowRoot;
      const recorderOption = shadowRoot?.querySelector('[data-action="recorder"]') as HTMLElement;
      recorderOption?.click();
    });

    // Wait for recording to start
    await page.waitForFunction(() => {
      return (window as any).A11yCap?.isRecordingActive?.();
    });

    // Click stop button
    await page.evaluate(() => {
      const recorder = document.querySelector('x-a11ycap-recorder');
      const shadowRoot = recorder?.shadowRoot;
      const recordButton = shadowRoot?.querySelector('.record-button') as HTMLElement;
      recordButton?.click();
    });

    // Verify recording stopped
    const isRecording = await page.evaluate(() => {
      return (window as any).A11yCap?.isRecordingActive?.();
    });
    expect(isRecording).toBe(false);
  });

  test('should allow element picker separately from recording', async ({ page }) => {
    // Open main menu
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await page.waitForFunction(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      return menu && menu.style.display === 'block';
    });

    // Click on Element Picker option
    await page.evaluate(() => {
      const menu = document.querySelector('x-a11ycap-menu');
      const shadowRoot = menu?.shadowRoot;
      const pickerOption = shadowRoot?.querySelector('[data-action="picker"]') as HTMLElement;
      pickerOption?.click();
    });

    // Wait for element picker to appear
    await page.waitForFunction(() => {
      const picker = document.querySelector('x-a11ycap-glass');
      return picker && picker.style.display === 'block';
    });

    // Verify element picker is active
    const pickerTitle = await page.evaluate(() => {
      const picker = document.querySelector('x-a11ycap-glass');
      const shadowRoot = picker?.shadowRoot;
      return shadowRoot?.querySelector('h3')?.textContent;
    });
    expect(pickerTitle).toContain('Element Picker');

    // Verify recording is NOT active (separate from picker)
    const isRecording = await page.evaluate(() => {
      return (window as any).A11yCap?.isRecordingActive?.();
    });
    expect(isRecording).toBe(false);
  });
});