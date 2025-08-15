import { test, expect } from '@playwright/test';

test.describe('Get Element Info Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652');
    await page.waitForLoadState('networkidle');
    
    // Wait for the library to be available (already loaded by test page)
    await page.waitForFunction(() => typeof window.A11yCap !== 'undefined');
  });

  test('should get comprehensive info for a single element', async ({ page }) => {
    // Take initial snapshot to get element refs
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    // Find a button ref from the snapshot
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    expect(buttonMatch).not.toBeNull();
    const buttonRef = buttonMatch![1];

    // Get element info using the tool
    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
      return await toolHandler.execute({
        id: 'test-get-element-info',
        type: 'get_element_info',
        payload: {
          element: 'Test button',
          ref: ref
        }
      });
    }, buttonRef);

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.ref).toBe(buttonRef);
    expect(result.tagName).toBe('button');
    expect(result.textContent).toContain('Click me');
    
    // Check comprehensive properties
    expect(result.aria).toBeDefined();
    expect(result.attributes).toBeDefined();
    expect(result.computed).toBeDefined();
    expect(result.state).toBeDefined();
    expect(result.geometry).toBeDefined();
    expect(result.parent).toBeDefined();
    expect(result.children).toBeDefined();
    expect(result.siblings).toBeDefined();
    expect(result.visual).toBeDefined();
    expect(result.events).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.data).toBeDefined();

    // Verify React information is included
    expect(result.react).toBeDefined();
    expect(result.react.componentName).toBe('App');
    
    // Verify state information
    expect(result.state.focused).toBe(false);
    expect(result.state.disabled).toBe(false);
    expect(result.state.visible).toBe(true);
    
    // Verify geometry
    expect(result.geometry.width).toBeGreaterThan(0);
    expect(result.geometry.height).toBeGreaterThan(0);
  });

  test('should support legacy single ref parameter', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    const buttonRef = buttonMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
      return await toolHandler.execute({
        id: 'test-legacy-ref',
        type: 'get_element_info',
        payload: {
          ref: ref
        }
      });
    }, buttonRef);

    expect(result.ref).toBe(buttonRef);
    expect(result.tagName).toBe('button');
  });

  test('should support new refs array parameter', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    // Find multiple element refs
    const buttonMatches = [...snapshot.matchAll(/button[^[]*\[ref=([e\d]+)\]/g)];
    expect(buttonMatches.length).toBeGreaterThanOrEqual(2);
    
    const refs = [buttonMatches[0][1], buttonMatches[1][1]];

    const result = await page.evaluate(async (refs) => {
      const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
      return await toolHandler.execute({
        id: 'test-refs-array',
        type: 'get_element_info',
        payload: {
          element: 'Test buttons',
          refs: refs
        }
      });
    }, refs);

    // Should return array for multiple elements
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].ref).toBe(refs[0]);
    expect(result[1].ref).toBe(refs[1]);
    expect(result[0].tagName).toBe('button');
    expect(result[1].tagName).toBe('button');
  });

  test('should support selector parameter', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
      return await toolHandler.execute({
        id: 'test-selector',
        type: 'get_element_info',
        payload: {
          element: 'All buttons',
          selector: 'button'
        }
      });
    });

    // Should return array for multiple buttons
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(2);
    
    // All should be buttons
    result.forEach((info: any) => {
      expect(info.tagName).toBe('button');
      expect(info.ref).toMatch(/^element_\d+(_\d+)?$/);
    });
  });

  test('should return single object for single selector match', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
      return await toolHandler.execute({
        id: 'test-single-selector',
        type: 'get_element_info',
        payload: {
          element: 'Page heading',
          selector: 'h1'
        }
      });
    });

    // Should return single object, not array
    expect(Array.isArray(result)).toBe(false);
    expect(result.tagName).toBe('h1');
    expect(result.textContent).toContain('React Test Page');
  });

  test('should handle non-existent element gracefully', async ({ page }) => {
    const resultPromise = page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
      return await toolHandler.execute({
        id: 'test-non-existent',
        type: 'get_element_info',
        payload: {
          element: 'Non-existent element',
          ref: 'non-existent-ref'
        }
      });
    });

    await expect(resultPromise).rejects.toThrow();
  });

  test('should include form-specific information for form elements', async ({ page }) => {
    // Show the form first
    await page.click('#show-form-button');
    await page.waitForSelector('#test-form', { state: 'visible' });
    
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    // Find a form input ref
    const inputMatch = snapshot.match(/textbox[^[]*\[ref=([e\d]+)\]/);
    expect(inputMatch).not.toBeNull();
    const inputRef = inputMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
      return await toolHandler.execute({
        id: 'test-form-element',
        type: 'get_element_info',
        payload: {
          element: 'Form input',
          ref: ref
        }
      });
    }, inputRef);

    expect(result.tagName).toBe('input');
    expect(result.state).toBeDefined();
    expect(typeof result.state).toBe('object');
  });

  test('should provide event handler information', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    // Find the first button (which has a click handler)
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    expect(buttonMatch).not.toBeNull();
    const buttonRef = buttonMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
      return await toolHandler.execute({
        id: 'test-events',
        type: 'get_element_info',
        payload: {
          element: 'Clickable button',
          ref: ref
        }
      });
    }, buttonRef);

    expect(result.events).toBeDefined();
    // Check if it has any event listeners (may vary by implementation)
    if (result.events.hasClickHandler !== undefined) {
      expect(result.events.hasClickHandler).toBe(true);
    }
    if (result.events.listenerTypes) {
      expect(Array.isArray(result.events.listenerTypes)).toBe(true);
    }
  });

  test('should include DOM hierarchy information', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    const buttonRef = buttonMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
      return await toolHandler.execute({
        id: 'test-hierarchy',
        type: 'get_element_info',
        payload: {
          element: 'Button with hierarchy',
          ref: ref
        }
      });
    }, buttonRef);

    expect(result.parent).toBeDefined();
    expect(result.parent.tagName).toBeDefined();
    expect(result.children).toBeDefined();
    expect(result.children.count).toBeDefined();
    expect(result.siblings).toBeDefined();
    expect(result.siblings.total).toBeGreaterThan(0);
    expect(result.siblings.position).toBeGreaterThan(0);
  });
});