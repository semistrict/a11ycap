// Debug script to test React component name extraction
import { test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils.js';

test('debug react component names', async ({ page }) => {
  await setupA11yCapTest(page, { waitForReactDevTools: true });
  await page.waitForFunction(() => (window as any).reactDevToolsReady, {
    timeout: 5000,
  });

  // Enable debug logging
  await page.evaluate(() => {
    (window as any).DEBUG_REACT_SNAPSHOT = true;
  });

  // Check if React DevTools hook is working
  const hookInfo = await page.evaluate(() => {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) return { hasHook: false };

    const renderers = Array.from(hook.renderers.keys());
    const fiberRoots = [];
    for (const rendererId of renderers) {
      const roots = hook.getFiberRoots(rendererId);
      fiberRoots.push(Array.from(roots).length);
    }

    return {
      hasHook: true,
      renderers,
      fiberRoots,
      supportsFiber: hook.supportsFiber,
    };
  });

  console.log('React DevTools Hook Info:', hookInfo);

  // Test manual fiber extraction
  const manualFiberTest = await page.evaluate(() => {
    const button = document.getElementById('test-button');
    if (!button) return { error: 'No button found' };

    // Find fiber manually
    const fiberKey = Object.keys(button).find((k) =>
      k.startsWith('__reactFiber$')
    );
    if (!fiberKey)
      return { error: 'No fiber key found', keys: Object.keys(button) };

    const fiber = (button as any)[fiberKey];
    if (!fiber) return { error: 'No fiber found' };

    // Walk up to find component
    let current = fiber;
    let steps = 0;
    const walkInfo = [];

    while (current && steps < 10) {
      walkInfo.push({
        step: steps,
        type: current.type,
        typeOf: typeof current.type,
        typeName: current.type?.name,
        displayName: current.type?.displayName,
        debugSource: current._debugSource,
      });

      if (current.type && typeof current.type === 'function') {
        return {
          success: true,
          walkInfo,
          componentName:
            current.type.name || current.type.displayName || 'Anonymous',
          debugSource: current._debugSource,
          foundAt: steps,
        };
      }

      current = current.return;
      steps++;
    }

    return { walkComplete: true, walkInfo, noComponentFound: true };
  });

  console.log('Manual Fiber Test:', JSON.stringify(manualFiberTest, null, 2));

  // Test snapshot with debug logging
  const snapshot = await page.evaluate(async () => {
    (window as any).DEBUG_REACT_SNAPSHOT = true;
    return await window.A11yCap.snapshot(document.body, {
      mode: 'ai',
      enableReact: true,
    });
  });

  console.log('Final snapshot:', snapshot);
});
