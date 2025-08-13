import { expect, test } from '@playwright/test';

test.describe('User Interaction Recording', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652');
    // Wait for the page to be ready
    await page.waitForSelector('#root');
  });

  test('should record click interactions', async ({ page }) => {
    // Clear any existing events
    await page.evaluate(() => {
      return window.A11yCap.clearEvents();
    });

    // Click the button to generate interaction events
    await page.click('#test-button');

    // Get recorded interactions
    const interactions = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: {
          type: 'click',
          limit: 10,
        },
      });
    });

    console.log('Recorded clicks:', interactions);
    expect(interactions).toContain('Click on button');
    expect(interactions).toContain('User Interactions');
  });

  test('should record input interactions', async ({ page }) => {
    // Clear any existing events
    await page.evaluate(() => {
      return window.A11yCap.clearEvents();
    });

    // Type in the input field
    await page.fill('#key-test-input', 'Hello World');

    // Get recorded interactions
    const interactions = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: {
          type: 'input',
          limit: 10,
        },
      });
    });

    console.log('Recorded inputs:', interactions);
    expect(interactions).toContain('Type in input');
    expect(interactions).toContain('Hello World');
  });

  test('should record navigation events on page load', async ({ page }) => {
    // Navigation event should be recorded automatically when page loads
    const interactions = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: {
          type: 'navigation',
          limit: 10,
        },
      });
    });

    console.log('Recorded navigation:', interactions);
    expect(interactions).toContain('Navigation');
    expect(interactions).toContain('localhost:14652');
  });

  test('should record focus and blur events', async ({ page }) => {
    // Clear any existing events
    await page.evaluate(() => {
      return window.A11yCap.clearEvents();
    });

    // Focus on the input field
    await page.focus('#key-test-input');

    // Blur by clicking elsewhere
    await page.click('body');

    // Get recorded interactions
    const interactions = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: {
          limit: 10,
        },
      });
    });

    console.log('Recorded focus/blur:', interactions);
    expect(interactions).toContain('Focus input');
    expect(interactions).toContain('Blur input');
  });

  test('should record keyboard events', async ({ page }) => {
    // Clear any existing events
    await page.evaluate(() => {
      return window.A11yCap.clearEvents();
    });

    // Focus input and press keys
    await page.focus('#key-test-input');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    // Get recorded interactions
    const interactions = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: {
          type: 'keydown',
          limit: 10,
        },
      });
    });

    console.log('Recorded keys:', interactions);
    expect(interactions).toContain('Key press Enter');
    expect(interactions).toContain('Key press Escape');
  });

  test('should handle empty interactions', async ({ page }) => {
    // Clear all events
    await page.evaluate(() => {
      return window.A11yCap.clearEvents();
    });

    // Get interactions when none exist
    const interactions = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: {
          type: 'click',
          limit: 10,
        },
      });
    });

    expect(interactions).toBe('No user interactions recorded');
  });

  test('should filter interactions by type', async ({ page }) => {
    // Clear any existing events
    await page.evaluate(() => {
      return window.A11yCap.clearEvents();
    });

    // Generate multiple types of interactions
    await page.click('#test-button');
    await page.fill('#key-test-input', 'test');
    await page.keyboard.press('Enter');

    // Get only click interactions
    const clickInteractions = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: {
          type: 'click',
          limit: 10,
        },
      });
    });

    // Get only input interactions
    const inputInteractions = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: {
          type: 'input',
          limit: 10,
        },
      });
    });

    expect(clickInteractions).toContain('Click on button');
    expect(clickInteractions).not.toContain('Type in input');

    expect(inputInteractions).toContain('Type in input');
    expect(inputInteractions).not.toContain('Click on button');
  });

  test('should limit number of returned interactions', async ({ page }) => {
    // Clear any existing events
    await page.evaluate(() => {
      return window.A11yCap.clearEvents();
    });

    // Generate multiple click events
    for (let i = 0; i < 5; i++) {
      await page.click('#test-button');
    }

    // Get limited interactions
    const limitedInteractions = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: {
          type: 'click',
          limit: 2,
        },
      });
    });

    // Should contain header and 2 interactions (total 3 lines)
    const lines = limitedInteractions.split('\n');
    expect(lines.length).toBe(3); // Header + 2 interactions
    expect(lines[0]).toContain('User Interactions (2 events)');
  });
});
