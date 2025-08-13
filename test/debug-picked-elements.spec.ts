import { expect, test } from '@playwright/test';

test.describe('Debug Picked Elements Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652');
    await page.addScriptTag({ path: 'a11ycap/dist/browser.js' });
    await page.waitForFunction(() => window.A11yCap);
  });

  test('should manually add and retrieve picked element event', async ({
    page,
  }) => {
    // Manually add a picked element event and test if the tool can retrieve it
    const result = await page.evaluate(async () => {
      // Get current page UUID
      const pageUUID = (window as any)._a11yCapPageUUID;

      // Manually add an element_picked event
      window.A11yCap.addEvent({
        type: 'element_picked',
        timestamp: Date.now(),
        url: window.location.href,
        pageUUID: pageUUID,
        element: {
          ref: 'e5',
          selector: 'button#test-button',
          textContent: 'Click me (0)',
          tagName: 'button',
          snapshot: 'test snapshot',
        },
      });

      // Try to retrieve it with the tool
      const toolHandlers = window.A11yCap.toolHandlers;
      const getPickedElementsTool = toolHandlers.get_picked_elements;

      const toolResult = await getPickedElementsTool.execute({
        id: 'test-debug',
        type: 'get_picked_elements',
        payload: {},
      });

      return {
        pageUUID,
        currentUrl: window.location.href,
        toolResult,
        allEvents: window.A11yCap.getEvents().length,
      };
    });

    console.log('Debug result:', result);

    expect(result.pageUUID).toBeDefined();
    expect(result.toolResult.totalPicked).toBe(1);
    expect(result.toolResult.elements.length).toBe(1);
    expect(result.toolResult.pageUUID).toBe(result.pageUUID);
  });
});
