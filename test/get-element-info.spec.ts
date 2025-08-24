import { test, expect } from '@playwright/test';
import { setupA11yCapTest } from './test-utils';

test.describe('Get Element Info Tool', () => {
  test.beforeEach(async ({ page }) => {
    await setupA11yCapTest(page, { waitForReactDevTools: true });
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
    
    // Verify new sections added in this update
    expect(result.layout).toBeDefined();
    expect(result.layout.constraints).toBeDefined();
    expect(result.layout.boxModel).toBeDefined();
    expect(result.layout.positioning).toBeDefined();
    expect(result.performance).toBeDefined();
    
    // Verify layout constraints structure
    expect(result.layout.constraints.width).toBeDefined();
    expect(result.layout.constraints.height).toBeDefined();
    expect(typeof result.layout.constraints.width.reasoning).toBe('string');
    expect(typeof result.layout.constraints.height.reasoning).toBe('string');
    
    // Verify box model calculations
    expect(result.layout.boxModel.contentBox).toBeDefined();
    expect(result.layout.boxModel.paddingBox).toBeDefined();
    expect(result.layout.boxModel.borderBox).toBeDefined();
    expect(result.layout.boxModel.marginBox).toBeDefined();

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

  test('should provide detailed animation state when available', async ({ page }) => {
    // Add an element with CSS animation for testing
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        @keyframes testAnimation {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-test {
          animation: testAnimation 1s ease-in-out;
          transition: transform 0.3s ease;
        }
      `;
      document.head.appendChild(style);
      
      const animatedDiv = document.createElement('div');
      animatedDiv.className = 'animate-test';
      animatedDiv.textContent = 'Animated element';
      document.body.appendChild(animatedDiv);
    });

    // Take snapshot to get the animated element
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const divMatch = snapshot.match(/div.*"Animated element".*\[ref=([e\d]+)\]/);
    if (divMatch) {
      const divRef = divMatch[1];

      const result = await page.evaluate(async (ref) => {
        const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
        return await toolHandler.execute({
          id: 'test-animation-state',
          type: 'get_element_info',
          payload: {
            element: 'Animated div',
            ref: ref
          }
        });
      }, divRef);

      // Verify performance section includes animation details
      expect(result.performance).toBeDefined();
      expect(result.performance.hasAnimations).toBe(true);
      expect(result.performance.hasTransitions).toBe(true);
      
      // Check for animation details if Web Animations API is available
      if (result.performance.animations) {
        expect(Array.isArray(result.performance.animations)).toBe(true);
      }
      
      if (result.performance.transitions) {
        expect(result.performance.transitions.property).toBeDefined();
        expect(result.performance.transitions.duration).toBeDefined();
      }
      
      if (result.performance.performanceImpact) {
        expect(typeof result.performance.performanceImpact.gpuAccelerated).toBe('boolean');
        expect(typeof result.performance.performanceImpact.causesRepaints).toBe('boolean');
        expect(typeof result.performance.performanceImpact.causesReflows).toBe('boolean');
      }
    }
  });

  test('should analyze layout constraints for different element types', async ({ page }) => {
    // Add elements with specific layout constraints
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        .constraint-test {
          max-width: 200px;
          width: 100%;
          padding: 10px;
          border: 2px solid red;
          margin: 5px;
        }
        .parent-container {
          width: 300px;
          height: 200px;
        }
      `;
      document.head.appendChild(style);
      
      const container = document.createElement('div');
      container.className = 'parent-container';
      
      const constrainedDiv = document.createElement('div');
      constrainedDiv.className = 'constraint-test';
      constrainedDiv.textContent = 'Constrained element';
      
      container.appendChild(constrainedDiv);
      document.body.appendChild(container);
    });

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    const constrainedMatch = snapshot.match(/div.*"Constrained element".*\[ref=([e\d]+)\]/);
    if (constrainedMatch) {
      const constrainedRef = constrainedMatch[1];

      const result = await page.evaluate(async (ref) => {
        const toolHandler = window.A11yCap.toolHandlers['get_element_info'];
        return await toolHandler.execute({
          id: 'test-layout-constraints',
          type: 'get_element_info',
          payload: {
            element: 'Constrained div',
            ref: ref
          }
        });
      }, constrainedRef);

      // Verify layout analysis is comprehensive
      expect(result.layout).toBeDefined();
      expect(result.layout.constraints.width.constraint).toBeDefined();
      expect(result.layout.constraints.height.constraint).toBeDefined();
      expect(result.layout.constraints.width.reasoning).toContain('width');
      
      // Verify box model calculations account for padding, border, margin
      expect(result.layout.boxModel.paddingImpact.width).toBe(20); // 10px * 2
      expect(result.layout.boxModel.borderImpact.width).toBe(4); // 2px * 2
      expect(result.layout.boxModel.marginImpact.width).toBe(10); // 5px * 2
      
      // Verify positioning information
      expect(result.layout.positioning.positionType).toBeDefined();
    }
  });
});