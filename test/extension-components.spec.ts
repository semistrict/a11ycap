import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

test.describe('Chrome Extension Components', () => {
  const extensionDistPath = '/home/ubuntu/repos/a11ycap/a11ycap/src/chrome-extension/dist';

  test('extension files exist and are valid', async () => {
    const manifestPath = path.join(extensionDistPath, 'manifest.json');
    const backgroundPath = path.join(extensionDistPath, 'background.js');
    const contentScriptPath = path.join(extensionDistPath, 'content-script.js');
    const a11ycapPath = path.join(extensionDistPath, 'a11ycap.js');

    expect(() => readFileSync(manifestPath, 'utf8')).not.toThrow();
    expect(() => readFileSync(backgroundPath, 'utf8')).not.toThrow();
    expect(() => readFileSync(contentScriptPath, 'utf8')).not.toThrow();
    expect(() => readFileSync(a11ycapPath, 'utf8')).not.toThrow();

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('a11ycap Browser Agent');
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.content_scripts[0].js).toContain('content-script.js');
    expect(manifest.web_accessible_resources[0].resources).toContain('a11ycap.js');

    const backgroundContent = readFileSync(backgroundPath, 'utf8');
    expect(backgroundContent).toContain('chrome.runtime.onMessage.addListener');
    expect(backgroundContent).toContain('connectToMCPServer');
    expect(backgroundContent).toContain('ws://localhost:12456/browser-ws');

    const contentScriptContent = readFileSync(contentScriptPath, 'utf8');
    expect(contentScriptContent).toContain('console.log("[Content Script] a11ycap content script loaded and executing")');
    expect(contentScriptContent).toContain('chrome.runtime.getURL("a11ycap.js")');
    expect(contentScriptContent).toContain('injectLibrary');

    const a11ycapContent = readFileSync(a11ycapPath, 'utf8');
    expect(a11ycapContent).toContain('window.a11ycap');
    expect(a11ycapContent).toContain('snapshotForAI');
  });

  test('a11ycap library can be loaded directly in browser', async ({ page }) => {
    await page.goto('data:text/html,<html><head><title>Test</title></head><body><h1>Test</h1></body></html>');
    
    await page.addScriptTag({ path: path.join(extensionDistPath, 'a11ycap.js') });
    
    await page.waitForTimeout(1000);
    
    const hasA11ycap = await page.evaluate(() => {
      return typeof (window as any).a11ycap !== 'undefined';
    });
    
    expect(hasA11ycap).toBe(true);
    
    const canTakeSnapshot = await page.evaluate(async () => {
      try {
        if (typeof (window as any).a11ycap !== 'undefined' && (window as any).a11ycap.snapshotForAI) {
          const snapshot = await (window as any).a11ycap.snapshotForAI(document.body);
          return typeof snapshot === 'string' && snapshot.length > 0;
        }
        return false;
      } catch (error) {
        console.error('Snapshot error:', error);
        return false;
      }
    });
    
    expect(canTakeSnapshot).toBe(true);
  });
});
