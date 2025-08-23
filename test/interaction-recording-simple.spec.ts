import { test, expect } from '@playwright/test';

test.describe('Simple Interaction Recording', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652');
    await page.waitForLoadState('networkidle');
  });

  test('should control recording through exposed API', async ({ page }) => {
    // Clear any existing events
    await page.evaluate(() => {
      window.A11yCap.clearEvents();
    });

    // Recording should be off initially
    const initialState = await page.evaluate(() => {
      return window.A11yCap.isRecordingActive();
    });
    expect(initialState).toBe(false);

    // Start recording
    await page.evaluate(() => {
      window.A11yCap.startRecording();
    });

    const afterStart = await page.evaluate(() => {
      return window.A11yCap.isRecordingActive();
    });
    expect(afterStart).toBe(true);

    // Perform some interactions
    await page.click('button:has-text("Click me")');
    await page.fill('input[type="text"]', 'Test input');

    // Get recorded events
    const events = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: { limit: 100 },
      });
    });

    expect(events).toContain('Click on button');
    expect(events).toContain('Test input');

    // Stop recording
    await page.evaluate(() => {
      window.A11yCap.stopRecording();
    });

    const afterStop = await page.evaluate(() => {
      return window.A11yCap.isRecordingActive();
    });
    expect(afterStop).toBe(false);

    // Clear events
    await page.evaluate(() => {
      window.A11yCap.clearEvents();
    });

    // New interactions should not be recorded
    await page.click('button:has-text("Show Form")');

    const eventsAfterStop = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: { limit: 100 },
      });
    });

    expect(eventsAfterStop).toBe('No user interactions recorded');
  });
});