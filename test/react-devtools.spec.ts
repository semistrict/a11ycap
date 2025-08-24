import { expect, test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils';

test.describe('React DevTools Integration', () => {
  test('should find React fiber node for DOM element', async ({ page }) => {
    await setupA11yCapTest(page, { waitForReactDevTools: true });

    const result = await page.evaluate(() => {
      // Get the React DevTools hook
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook) return { error: 'React DevTools hook not found' };

      // Check if getFiberRoots exists, otherwise use a different approach
      let fiberNode = null;
      if (hook.getFiberRoots && typeof hook.getFiberRoots === 'function') {
        const fiberRoots = hook.getFiberRoots(1);
        fiberNode = Array.from(fiberRoots)[0]?.current;
      } else {
        // Fallback: try to find fiber directly from DOM element
        const button = document.getElementById('test-button');
        if (button) {
          const fiberKey = Object.keys(button).find((k) =>
            k.startsWith('__reactFiber')
          );
          if (fiberKey) {
            fiberNode = (button as any)[fiberKey];
          }
        }
      }

      function findFiberForDom(dom: any): any {
        let node = dom;
        while (node) {
          const fiberKey = Object.keys(node).find((k: string) =>
            k.startsWith('__reactFiber$')
          );
          if (fiberKey) {
            const fiber = node[fiberKey];
            if (fiber) return fiber;
          }
          node = node.parentNode;
        }
        return null;
      }

      // Find the test button element
      const button = document.getElementById('test-button');
      if (!button) {
        return { error: 'Button not found' };
      }

      // Find the fiber node for the button
      const fiber = findFiberForDom(button);

      return {
        hasFiberRoot: !!fiberNode,
        hasButton: !!button,
        buttonText: button.textContent,
        hasFiber: !!fiber,
        fiberType: fiber ? fiber.type : null,
        fiberProps: fiber ? Object.keys(fiber.memoizedProps || {}) : null,
      };
    });

    console.log('React DevTools result:', result);

    // Assertions
    expect(result.hasButton).toBe(true);
    expect(result.buttonText).toContain('Click me');
    expect(result.hasFiber).toBe(true);
    expect(result.fiberType).toBe('button');
    expect(result.fiberProps).toContain('onClick');
    expect(result.fiberProps).toContain('id');
  });

  test('should find React component for form elements', async ({ page }) => {
    await page.goto('http://localhost:14652/');

    // Remove CRA dev overlay for clicks
    await page.evaluate(() => {
      const overlay = document.getElementById(
        'webpack-dev-server-client-overlay'
      );
      if (overlay) overlay.remove();
    });

    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
    await page.waitForFunction(() => window.__REACT_DEVTOOLS_GLOBAL_HOOK__, {
      timeout: 5000,
    });

    // Click the "Show Form" button to render form elements
    await page.click('button:has-text("Show Form")');

    const result = await page.evaluate(() => {
      function findFiberForDom(dom: any): any {
        let node = dom;
        while (node) {
          const fiberKey = Object.keys(node).find((k: string) =>
            k.startsWith('__reactFiber$')
          );
          if (fiberKey) {
            const fiber = node[fiberKey];
            if (fiber) return fiber;
          }
          node = node.parentNode;
        }
        return null;
      }

      // Find form elements
      const form = document.getElementById('test-form');
      const nameInput = document.getElementById('name');
      const emailInput = document.getElementById('email');

      if (!form || !nameInput || !emailInput) {
        return { error: 'Form elements not found' };
      }

      return {
        formFiber: !!findFiberForDom(form),
        nameInputFiber: !!findFiberForDom(nameInput),
        emailInputFiber: !!findFiberForDom(emailInput),
        formVisible: form.style.display !== 'none',
      };
    });

    console.log('Form fiber result:', result);

    expect(result.formFiber).toBe(true);
    expect(result.nameInputFiber).toBe(true);
    expect(result.emailInputFiber).toBe(true);
    expect(result.formVisible).toBe(true);
  });

  test('should track React component state changes', async ({ page }) => {
    await page.goto('http://localhost:14652/');

    // Remove CRA dev overlay for clicks
    await page.evaluate(() => {
      const overlay = document.getElementById(
        'webpack-dev-server-client-overlay'
      );
      if (overlay) overlay.remove();
    });

    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
    await page.waitForFunction(() => window.__REACT_DEVTOOLS_GLOBAL_HOOK__, {
      timeout: 5000,
    });

    const initialState = await page.evaluate(() => {
      function findFiberForDom(dom: any): any {
        let node = dom;
        while (node) {
          const fiberKey = Object.keys(node).find((k: string) =>
            k.startsWith('__reactFiber$')
          );
          if (fiberKey) {
            const fiber = node[fiberKey];
            if (fiber) return fiber;
          }
          node = node.parentNode;
        }
        return null;
      }

      const button = document.getElementById('test-button');
      const fiber = findFiberForDom(button);

      return {
        buttonText: button?.textContent || '',
        hasHooks: !!fiber?.memoizedState,
      };
    });

    // Click the button to change state
    await page.click('#test-button');

    const afterClickState = await page.evaluate(() => {
      function findFiberForDom(dom: any): any {
        let node = dom;
        while (node) {
          const fiberKey = Object.keys(node).find((k: string) =>
            k.startsWith('__reactFiber$')
          );
          if (fiberKey) {
            const fiber = node[fiberKey];
            if (fiber) return fiber;
          }
          node = node.parentNode;
        }
        return null;
      }

      const button = document.getElementById('test-button');
      const fiber = findFiberForDom(button);

      return {
        buttonText: button?.textContent || '',
        hasHooks: !!fiber?.memoizedState,
      };
    });

    console.log('State change:', {
      initial: initialState,
      afterClick: afterClickState,
    });

    expect(initialState.buttonText).toContain('(0)');
    expect(afterClickState.buttonText).toContain('(1)');
  });
});

test.describe('React-Aware Snapshot Integration', () => {
  test('should include React component info when enableReact is true', async ({
    page,
  }) => {
    await page.goto('http://localhost:14652/');
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
    await page.waitForFunction(() => window.__REACT_DEVTOOLS_GLOBAL_HOOK__, {
      timeout: 5000,
    });

    const debugInfo = await page.evaluate(() => {
      const button = document.getElementById('test-button');
      if (!button) return { error: 'Button not found' };

      // Enable debug logging
      (window as any).DEBUG_REACT_SNAPSHOT = true;

      // Test extractReactInfo directly
      const { extractReactInfo } = window as any;
      let reactInfo = null;
      try {
        reactInfo = extractReactInfo
          ? extractReactInfo(button)
          : 'extractReactInfo not found';
      } catch (e) {
        reactInfo = { error: e.message };
      }

      // Get fiber directly to inspect its properties
      const fiberKey = Object.keys(button).find((k) =>
        k.startsWith('__reactFiber')
      );
      let fiberProperties = [];
      let hasDebugSource = false;
      let debugSourceValue = null;
      let hasDebugOwner = false;
      let debugOwnerValue = null;

      if (fiberKey) {
        const fiber = (button as any)[fiberKey];
        const componentFiber = (() => {
          let current = fiber;
          while (current) {
            if (current.type && typeof current.type === 'function') {
              return current;
            }
            current = current.return;
          }
          return fiber;
        })();

        fiberProperties = Object.keys(componentFiber);
        hasDebugSource = '_debugSource' in componentFiber;
        debugSourceValue = componentFiber._debugSource;
        hasDebugOwner = '_debugOwner' in componentFiber;
        debugOwnerValue = componentFiber._debugOwner;
      }

      return {
        hasHook: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
        hasButton: !!button,
        buttonFiber: fiberKey,
        fiberProperties,
        hasDebugSource,
        debugSourceValue,
        hasDebugOwner,
        debugOwnerValue,
        reactInfo,
      };
    });

    console.log('Debug info:', debugInfo);

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, {
        mode: 'ai',
        enableReact: true,
      });
    });

    console.log('React-aware snapshot:', snapshot);

    // Should contain React component and interaction info
    expect(snapshot).toContain('[component=App]');
    expect(snapshot).toContain('[onClick]');
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('Click me');
  });

  test('should not include React info when enableReact is false', async ({
    page,
  }) => {
    await page.goto('http://localhost:14652/');
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, {
        mode: 'ai',
        enableReact: false,
      });
    });

    console.log('Non-React snapshot:', snapshot);

    // Should not contain React component information
    expect(snapshot).not.toContain('[component=');
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('Click me');
  });

  test('should include React state and interaction hints', async ({ page }) => {
    await page.goto('http://localhost:14652/');

    // Remove CRA dev overlay for clicks
    await page.evaluate(() => {
      const overlay = document.getElementById(
        'webpack-dev-server-client-overlay'
      );
      if (overlay) overlay.remove();
    });

    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
    await page.waitForFunction(() => window.__REACT_DEVTOOLS_GLOBAL_HOOK__, {
      timeout: 5000,
    });

    // Click the button to change state
    await page.click('#test-button');

    // Show the form to get more React components
    await page.click('button:has-text("Show Form")');

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, {
        mode: 'ai',
        enableReact: true,
      });
    });

    console.log('React snapshot with state and interactions:', snapshot);

    // Should contain interaction hints like onClick
    expect(snapshot).toContain('onClick');

    // Should show form elements with React info
    expect(snapshot).toContain('textbox');
  });

  test('should work with snapshotForAI function', async ({ page }) => {
    await page.goto('http://localhost:14652/');
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
    await page.waitForFunction(() => window.__REACT_DEVTOOLS_GLOBAL_HOOK__, {
      timeout: 5000,
    });

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    console.log('snapshotForAI with React:', snapshot);

    // Should be in AI mode with React info
    expect(snapshot).toContain('[ref=');
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('[component=');
  });
});
