import { test, expect } from '@playwright/test';
import { setupA11yCapTest } from './test-utils.js';

test.describe('Mutate Element Tool', () => {
  test.beforeEach(async ({ page }) => {
    await setupA11yCapTest(page);
  });

  test('should mutate element attributes', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    expect(buttonMatch).not.toBeNull();
    const buttonRef = buttonMatch![1];

    // Mutate attributes
    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-mutate-attrs',
        type: 'mutate_element',
        payload: {
          element: 'Test button',
          ref: ref,
          attributes: {
            'aria-label': 'Updated button label',
            'data-test': 'mutation-test',
            'title': 'Button tooltip'
          }
        }
      });
    }, buttonRef);

    expect(result.success).toBe(true);
    expect(result.ref).toBe(buttonRef);
    expect(result.changes.attributes).toBeDefined();
    expect(result.changes.attributes['aria-label']).toEqual({
      from: null,
      to: 'Updated button label'
    });
    expect(result.changes.attributes['data-test']).toEqual({
      from: null,
      to: 'mutation-test'
    });

    // Verify the attributes were actually set
    const actualAttributes = await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      return {
        ariaLabel: element.getAttribute('aria-label'),
        dataTest: element.getAttribute('data-test'),
        title: element.getAttribute('title')
      };
    }, buttonRef);

    expect(actualAttributes.ariaLabel).toBe('Updated button label');
    expect(actualAttributes.dataTest).toBe('mutation-test');
    expect(actualAttributes.title).toBe('Button tooltip');
  });

  test('should remove attributes using null values', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    const buttonRef = buttonMatch![1];

    // First set an attribute
    await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      element.setAttribute('data-temp', 'will-be-removed');
    }, buttonRef);

    // Now remove it
    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-remove-attrs',
        type: 'mutate_element',
        payload: {
          element: 'Test button',
          ref: ref,
          attributes: {
            'data-temp': null
          }
        }
      });
    }, buttonRef);

    expect(result.success).toBe(true);
    expect(result.changes.attributes['data-temp']).toEqual({
      from: 'will-be-removed',
      to: null
    });

    // Verify the attribute was removed
    const hasAttribute = await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      return element.hasAttribute('data-temp');
    }, buttonRef);

    expect(hasAttribute).toBe(false);
  });

  test('should mutate DOM properties', async ({ page }) => {
    // Show form to get form elements
    await page.click('#show-form-button');
    await page.waitForSelector('#test-form', { state: 'visible' });
    
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const inputMatch = snapshot.match(/textbox[^[]*\[ref=([e\d]+)\]/);
    expect(inputMatch).not.toBeNull();
    const inputRef = inputMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-mutate-props',
        type: 'mutate_element',
        payload: {
          element: 'Form input',
          ref: ref,
          properties: {
            'value': 'New input value',
            'placeholder': 'Updated placeholder'
          }
        }
      });
    }, inputRef);

    expect(result.success).toBe(true);
    expect(result.changes.properties).toBeDefined();
    expect(result.changes.properties['value'].to).toBe('New input value');

    // Verify the properties were set
    const actualValue = await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      return element.value;
    }, inputRef);

    expect(actualValue).toBe('New input value');
  });

  test('should mutate CSS styles', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    const buttonRef = buttonMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-mutate-styles',
        type: 'mutate_element',
        payload: {
          element: 'Test button',
          ref: ref,
          styles: {
            'background-color': 'red',
            'color': 'white',
            'padding': '10px'
          }
        }
      });
    }, buttonRef);

    expect(result.success).toBe(true);
    expect(result.changes.styles).toBeDefined();
    expect(result.changes.styles['background-color'].to).toBe('red');

    // Verify the styles were applied
    const computedStyle = await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        padding: style.padding
      };
    }, buttonRef);

    expect(computedStyle.backgroundColor).toContain('rgb(255, 0, 0)'); // red
    expect(computedStyle.color).toContain('rgb(255, 255, 255)'); // white
  });

  test('should remove CSS styles using null values', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    const buttonRef = buttonMatch![1];

    // First set a style
    await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      element.style.backgroundColor = 'blue';
    }, buttonRef);

    // Now remove it
    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-remove-styles',
        type: 'mutate_element',
        payload: {
          element: 'Test button',
          ref: ref,
          styles: {
            'background-color': null
          }
        }
      });
    }, buttonRef);

    expect(result.success).toBe(true);
    expect(result.changes.styles['background-color'].to).toBe(null);
  });

  test('should mutate text content', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    const buttonRef = buttonMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-mutate-text',
        type: 'mutate_element',
        payload: {
          element: 'Test button',
          ref: ref,
          textContent: 'New Button Text'
        }
      });
    }, buttonRef);

    expect(result.success).toBe(true);
    expect(result.changes.textContent).toBeDefined();
    expect(result.changes.textContent.to).toBe('New Button Text');

    // Verify the text was changed
    const actualText = await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      return element.textContent;
    }, buttonRef);

    expect(actualText).toBe('New Button Text');
  });

  test('should add and remove CSS classes', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    const buttonRef = buttonMatch![1];

    // First add some classes
    const addResult = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-add-classes',
        type: 'mutate_element',
        payload: {
          element: 'Test button',
          ref: ref,
          add_classes: ['btn', 'btn-primary', 'test-class']
        }
      });
    }, buttonRef);

    expect(addResult.success).toBe(true);
    expect(addResult.changes.classes).toBeDefined();
    expect(addResult.changes.classes.added).toEqual(['btn', 'btn-primary', 'test-class']);

    // Verify classes were added
    const classesAfterAdd = await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      return Array.from(element.classList);
    }, buttonRef);

    expect(classesAfterAdd).toContain('btn');
    expect(classesAfterAdd).toContain('btn-primary');
    expect(classesAfterAdd).toContain('test-class');

    // Now remove some classes
    const removeResult = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-remove-classes',
        type: 'mutate_element',
        payload: {
          element: 'Test button',
          ref: ref,
          remove_classes: ['btn-primary', 'test-class']
        }
      });
    }, buttonRef);

    expect(removeResult.success).toBe(true);
    expect(removeResult.changes.classes.removed).toEqual(['btn-primary', 'test-class']);

    // Verify classes were removed
    const classesAfterRemove = await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      return Array.from(element.classList);
    }, buttonRef);

    expect(classesAfterRemove).toContain('btn');
    expect(classesAfterRemove).not.toContain('btn-primary');
    expect(classesAfterRemove).not.toContain('test-class');
  });

  test('should handle multiple element mutation using refs array', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatches = [...snapshot.matchAll(/button[^[]*\[ref=([e\d]+)\]/g)];
    expect(buttonMatches.length).toBeGreaterThanOrEqual(2);
    
    const refs = [buttonMatches[0][1], buttonMatches[1][1]];

    const result = await page.evaluate(async (refs) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-multi-mutate',
        type: 'mutate_element',
        payload: {
          element: 'Multiple buttons',
          refs: refs,
          attributes: {
            'data-multi': 'true'
          },
          add_classes: ['multi-button']
        }
      });
    }, refs);

    expect(result.success).toBe(true);
    expect(result.totalElements).toBe(2);
    expect(result.results).toHaveLength(2);
    
    // Check each result
    result.results.forEach((r: any, index: number) => {
      expect(r.success).toBe(true);
      expect(r.ref).toBe(refs[index]);
      expect(r.changes.attributes['data-multi']).toEqual({
        from: null,
        to: 'true'
      });
      expect(r.changes.classes.added).toContain('multi-button');
    });

    // Verify the mutations were applied
    const actualAttributes = await page.evaluate((refs) => {
      return refs.map((ref: string) => {
        const element = window.A11yCap.findElementByRef(ref);
        return {
          dataMulti: element.getAttribute('data-multi'),
          hasClass: element.classList.contains('multi-button')
        };
      });
    }, refs);

    actualAttributes.forEach((attrs: any) => {
      expect(attrs.dataMulti).toBe('true');
      expect(attrs.hasClass).toBe(true);
    });
  });

  test('should handle multiple element mutation using selector', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-selector-mutate',
        type: 'mutate_element',
        payload: {
          element: 'All buttons',
          selector: 'button',
          attributes: {
            'data-selector-test': 'applied'
          }
        }
      });
    });

    expect(result.success).toBe(true);
    expect(result.totalElements).toBeGreaterThanOrEqual(2);
    expect(result.results.length).toBeGreaterThanOrEqual(2);

    // All results should be successful
    result.results.forEach((r: any) => {
      expect(r.success).toBe(true);
      expect(r.changes.attributes['data-selector-test']).toEqual({
        from: null,
        to: 'applied'
      });
    });

    // Verify all buttons have the attribute
    const buttonAttributes = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      return Array.from(buttons).map(btn => btn.getAttribute('data-selector-test'));
    });

    buttonAttributes.forEach(attr => {
      expect(attr).toBe('applied');
    });
  });

  test('should handle legacy single ref parameter', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    const buttonRef = buttonMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-legacy-ref',
        type: 'mutate_element',
        payload: {
          element: 'Test button',
          ref: ref,
          attributes: {
            'data-legacy': 'true'
          }
        }
      });
    }, buttonRef);

    expect(result.success).toBe(true);
    expect(result.ref).toBe(buttonRef);
    expect(result.changes.attributes['data-legacy']).toEqual({
      from: null,
      to: 'true'
    });
  });

  test('should return single result for single element', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-single-selector',
        type: 'mutate_element',
        payload: {
          element: 'Page heading',
          selector: 'h1',
          attributes: {
            'data-heading': 'main'
          }
        }
      });
    });

    // Should return single result object, not multi-result
    expect(result.ref).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.changes).toBeDefined();
    expect(result.totalElements).toBeUndefined(); // Not a multi-result
  });

  test('should handle combined mutations', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    const buttonRef = buttonMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-combined',
        type: 'mutate_element',
        payload: {
          element: 'Test button',
          ref: ref,
          attributes: {
            'data-combined': 'test',
            'aria-label': 'Combined test button'
          },
          styles: {
            'border': '2px solid blue',
            'margin': '5px'
          },
          add_classes: ['combined-test', 'styled-button'],
          textContent: 'Combined Mutation Test'
        }
      });
    }, buttonRef);

    expect(result.success).toBe(true);
    expect(result.changes.attributes).toBeDefined();
    expect(result.changes.styles).toBeDefined();
    expect(result.changes.classes).toBeDefined();
    expect(result.changes.textContent).toBeDefined();

    // Verify all changes were applied
    const verification = await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      const style = getComputedStyle(element);
      return {
        dataCombined: element.getAttribute('data-combined'),
        ariaLabel: element.getAttribute('aria-label'),
        textContent: element.textContent,
        border: style.border,
        hasCombinedClass: element.classList.contains('combined-test'),
        hasStyledClass: element.classList.contains('styled-button')
      };
    }, buttonRef);

    expect(verification.dataCombined).toBe('test');
    expect(verification.ariaLabel).toBe('Combined test button');
    expect(verification.textContent).toBe('Combined Mutation Test');
    expect(verification.border).toContain('2px');
    expect(verification.border).toContain('rgb(0, 0, 255)'); // blue in rgb format
    expect(verification.hasCombinedClass).toBe(true);
    expect(verification.hasStyledClass).toBe(true);
  });

  test('should handle errors gracefully', async ({ page }) => {
    const resultPromise = page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['mutate_element'];
      return await toolHandler.execute({
        id: 'test-error',
        type: 'mutate_element',
        payload: {
          element: 'Non-existent element',
          ref: 'non-existent-ref',
          attributes: {
            'data-test': 'should-fail'
          }
        }
      });
    });

    await expect(resultPromise).rejects.toThrow();
  });
});