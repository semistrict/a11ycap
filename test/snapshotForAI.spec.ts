import { expect, test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils';

test.describe('snapshotForAI', () => {
  test('should generate basic snapshot for simple button', async ({ page }) => {
    await setupA11yCapTest(page);

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    console.log('Snapshot result:', snapshot);

    // Basic assertions
    expect(typeof snapshot).toBe('string');
    expect(snapshot.length).toBeGreaterThan(0);
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('Click me');
  });

  test('should generate complex snapshot for form with multiple elements', async ({
    page,
  }) => {
    await setupA11yCapTest(page);

    // Now inject complex HTML structure
    await page.evaluate(() => {
      document.body.innerHTML = `
        <form>
          <fieldset>
            <legend>Personal Information</legend>
            <label for="name">Name:</label>
            <input type="text" id="name" value="John Doe">
            
            <label for="email">Email:</label>
            <input type="email" id="email" placeholder="Enter email">
            
            <div>
              <label><input type="radio" name="gender" value="male" checked> Male</label>
              <label><input type="radio" name="gender" value="female"> Female</label>
            </div>
            
            <label for="country">Country:</label>
            <select id="country">
              <option value="">Select country</option>
              <option value="us" selected>United States</option>
              <option value="uk">United Kingdom</option>
            </select>
            
            <label>
              <input type="checkbox" checked> Subscribe to newsletter
            </label>
          </fieldset>
          
          <button type="submit">Submit Form</button>
          <button type="reset">Reset</button>
        </form>
      `;
    });

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    console.log('Complex form snapshot:', snapshot);

    // Verify complex form elements are captured
    expect(snapshot).toContain('form');
    expect(snapshot).toContain('Personal Information');
    expect(snapshot).toContain('textbox');
    expect(snapshot).toContain('John Doe');
    expect(snapshot).toContain('radio');
    expect(snapshot).toContain('Male');
    expect(snapshot).toContain('combobox');
    expect(snapshot).toContain('United States');
    expect(snapshot).toContain('checkbox');
    expect(snapshot).toContain('checked');
    expect(snapshot).toContain('Submit Form');
  });

  test('should handle iframes in snapshot', async ({ page }) => {
    await setupA11yCapTest(page);

    // Create content with iframe
    await page.evaluate(() => {
      document.body.innerHTML = `
        <h1>Main Page</h1>
        <iframe name="test-frame" src="data:text/html,<h2>Iframe Content</h2><button>Iframe Button</button>">
        </iframe>
        <p>After iframe</p>
      `;
    });

    // Wait a bit for iframe to load
    await page.waitForTimeout(100);

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    console.log('Iframe snapshot:', snapshot);

    // Verify iframe is detected in snapshot
    expect(snapshot).toContain('heading "Main Page"');
    expect(snapshot).toContain('iframe');
    expect(snapshot).toContain('After iframe');
  });

  test('should handle nested elements with active states', async ({ page }) => {
    await setupA11yCapTest(page);

    // Create content with focusable elements
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div>
          <button id="btn1">Button 1</button>
          <button id="btn2" autofocus>Button 2</button>
          <input type="text" id="input1" placeholder="Text input">
          <textarea id="textarea1" placeholder="Textarea"></textarea>
        </div>
      `;
    });

    // Wait for autofocus to take effect
    await page.waitForFunction(() => document.activeElement?.id === 'btn2', {
      timeout: 1000,
    });

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    console.log('Active elements snapshot:', snapshot);

    // Verify active element is marked
    expect(snapshot).toContain('Button 1');
    expect(snapshot).toContain('Button 2');
    expect(snapshot).toContain('[active]');
    expect(snapshot).toContain('textbox');
  });
});

test.describe('snapshot (non-AI modes)', () => {
  test('should generate expect mode snapshot', async ({ page }) => {
    await setupA11yCapTest(page);

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, { mode: 'expect' });
    });

    console.log('Expect mode snapshot:', snapshot);

    // Basic assertions
    expect(typeof snapshot).toBe('string');
    expect(snapshot.length).toBeGreaterThan(0);
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('Click me');

    // Compare with AI mode to verify different output formats
    const aiSnapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });

    console.log('AI mode snapshot for comparison:', aiSnapshot);

    // Expect mode doesn't include references, AI mode includes [ref=eX] tags
    expect(snapshot).not.toContain('[ref=');
    expect(aiSnapshot).toContain('[ref=');
  });

  test('should generate codegen mode snapshot', async ({ page }) => {
    await setupA11yCapTest(page);

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, { mode: 'codegen' });
    });

    console.log('Codegen mode snapshot:', snapshot);

    // Basic assertions
    expect(typeof snapshot).toBe('string');
    expect(snapshot.length).toBeGreaterThan(0);
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('Click me');
  });

  test('should generate autoexpect mode snapshot', async ({ page }) => {
    await setupA11yCapTest(page);

    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, { mode: 'autoexpect' });
    });

    console.log('Autoexpect mode snapshot:', snapshot);

    // Basic assertions
    expect(typeof snapshot).toBe('string');
    expect(snapshot.length).toBeGreaterThan(0);
    expect(snapshot).toContain('button');
    expect(snapshot).toContain('Click me');
  });

  test('should default to expect mode when no mode specified', async ({
    page,
  }) => {
    await setupA11yCapTest(page);

    const snapshotDefault = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body);
    });

    const snapshotExpect = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, { mode: 'expect' });
    });

    console.log('Default mode snapshot:', snapshotDefault);

    // Should be identical to expect mode
    expect(snapshotDefault).toBe(snapshotExpect);
  });

  test('should handle form elements in expect mode', async ({ page }) => {
    await setupA11yCapTest(page);

    // Create a more complex form for testing
    await page.evaluate(() => {
      const form = document.createElement('form');
      form.innerHTML = `
        <label for="name">Name:</label>
        <input type="text" id="name" name="name" value="John Doe">
        
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" placeholder="Enter email">
        
        <fieldset>
          <legend>Gender</legend>
          <label><input type="radio" name="gender" value="male" checked> Male</label>
          <label><input type="radio" name="gender" value="female"> Female</label>
        </fieldset>
        
        <label>
          <input type="checkbox" name="newsletter" checked> Subscribe to newsletter
        </label>
        
        <button type="submit">Submit Form</button>
      `;
      document.body.appendChild(form);
    });

    const snapshot = await page.evaluate(() => {
      const form = document.querySelector('form') as HTMLFormElement;
      return window.A11yCap.snapshot(form, { mode: 'expect' });
    });

    console.log('Form snapshot (expect mode):', snapshot);

    // Verify form elements are captured with their states
    expect(snapshot).toContain('textbox');
    expect(snapshot).toContain('John Doe');
    expect(snapshot).toContain('radio');
    expect(snapshot).toContain('[checked]');
    expect(snapshot).toContain('checkbox');
    expect(snapshot).toContain('Subscribe to newsletter');
    expect(snapshot).toContain('Submit Form');

    // Compare with AI mode
    const aiSnapshot = await page.evaluate(() => {
      const form = document.querySelector('form') as HTMLFormElement;
      return window.A11yCap.snapshotForAI(form);
    });

    console.log('Form snapshot (AI mode):', aiSnapshot);

    // Both should capture the essential information
    expect(aiSnapshot).toContain('textbox');
    expect(aiSnapshot).toContain('John Doe');
    expect(aiSnapshot).toContain('radio');
    expect(aiSnapshot).toContain('checkbox');
  });
});
