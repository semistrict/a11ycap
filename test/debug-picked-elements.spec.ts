import { expect, test } from '@playwright/test';

test.describe('Debug Picked Elements Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652');
    await page.addScriptTag({ path: 'a11ycap/dist/browser.js' });
    await page.waitForFunction(() => window.A11yCap);
  });

  test('should manually add picked CSS class and retrieve picked element', async ({
    page,
  }) => {
    // Manually add picked class to an element and test if the tool can retrieve it
    const result = await page.evaluate(async () => {
      // Find the test button and add the picked class
      const button = document.getElementById('test-button');
      if (!button) {
        throw new Error('Test button not found');
      }
      
      button.classList.add('a11ycap-picked');

      // Try to retrieve it with the tool
      const toolHandlers = window.A11yCap.toolHandlers;
      const getPickedElementsTool = toolHandlers.get_picked_elements;

      const toolResult = await getPickedElementsTool.execute({
        id: 'test-debug',
        type: 'get_picked_elements',
        payload: {},
      });

      return {
        currentUrl: window.location.href,
        toolResult,
        buttonHasPickedClass: button.classList.contains('a11ycap-picked'),
      };
    });

    console.log('Debug result:', result);

    expect(result.buttonHasPickedClass).toBe(true);
    expect(Array.isArray(result.toolResult)).toBe(true);
    expect(result.toolResult.length).toBe(1);
    expect(result.toolResult[0].tagName).toBe('button');
  });
});
