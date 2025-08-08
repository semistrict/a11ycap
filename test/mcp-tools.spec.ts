import { expect, test } from '@playwright/test';

test.describe('MCP Tools Implementation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652/');
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
  });

  test('should handle take_snapshot functionality', async ({ page }) => {
    // Test basic snapshot generation
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    expect(snapshot).toContain('React Test Page');
    expect(snapshot).toContain('[ref=');
    
    // Test snapshot with different modes
    const expectSnapshot = await page.evaluate(() => {
      return window.A11yCap.snapshot(document.body, { mode: 'expect' });
    });

    expect(expectSnapshot).toContain('React Test Page');
    expect(expectSnapshot).not.toContain('[ref=');
  });

  test('should handle click_element functionality', async ({ page }) => {
    // Take snapshot to get element refs
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    // Extract button ref
    const buttonMatch = snapshot.match(/button.*"Click me.*\[ref=(e\d+)\]/);
    expect(buttonMatch).toBeTruthy();
    const buttonRef = buttonMatch![1];

    // Get initial button text
    const initialText = await page.locator('#test-button').textContent();
    expect(initialText).toContain('Click me (0)');

    // Use clickRef to click the button
    const clickResult = await page.evaluate((ref) => {
      return window.A11yCap.clickRef(ref);
    }, buttonRef);

    expect(clickResult).toBe(true);

    // Verify button text changed
    const newText = await page.locator('#test-button').textContent();
    expect(newText).toContain('Click me (1)');
  });

  test('should handle type_text functionality', async ({ page }) => {
    // Show the form first
    await page.click('#show-form-button');
    await page.waitForSelector('#test-form', { state: 'visible' });

    // Take snapshot to get input refs
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    // Extract name input ref
    const nameInputMatch = snapshot.match(/textbox.*"Name:".*\[ref=(e\d+)\]/);
    expect(nameInputMatch).toBeTruthy();
    const nameInputRef = nameInputMatch![1];

    // Test typing text into input
    const testText = 'John Doe';
    await page.evaluate((data) => {
      const element = window.A11yCap.findElementByRef(data.ref);
      if (element && element instanceof HTMLInputElement) {
        element.value = data.text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { ref: nameInputRef, text: testText });

    // Verify text was entered
    const inputValue = await page.locator('#name').inputValue();
    expect(inputValue).toBe(testText);
  });

  test('should handle type_text with slowly option', async ({ page }) => {
    // Show the form first
    await page.click('#show-form-button');
    await page.waitForSelector('#test-form', { state: 'visible' });

    // Take snapshot to get input refs
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    // Extract email input ref
    const emailInputMatch = snapshot.match(/textbox.*"Email:".*\[ref=(e\d+)\]/);
    expect(emailInputMatch).toBeTruthy();
    const emailInputRef = emailInputMatch![1];

    // Test typing slowly (character by character)
    const testText = 'test@example.com';
    await page.evaluate(async (data) => {
      const element = window.A11yCap.findElementByRef(data.ref);
      if (element && element instanceof HTMLInputElement) {
        element.value = ''; // Clear first
        
        // Type character by character
        for (let i = 0; i < data.text.length; i++) {
          const char = data.text[i];
          element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
          element.value += char;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        }
      }
    }, { ref: emailInputRef, text: testText });

    // Verify text was entered
    const inputValue = await page.locator('#email').inputValue();
    expect(inputValue).toBe(testText);
  });

  test('should handle press_key functionality', async ({ page }) => {
    // Focus the key test input
    await page.click('#key-test-input');

    // Take snapshot to get input ref
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    // Extract key test input ref
    const inputMatch = snapshot.match(/textbox.*"Focus and press keys here".*\[ref=(e\d+)\]/);
    expect(inputMatch).toBeTruthy();
    const inputRef = inputMatch![1];

    // Simulate pressing Enter key
    await page.evaluate((data) => {
      const element = window.A11yCap.findElementByRef(data.ref);
      if (element) {
        element.dispatchEvent(new KeyboardEvent('keydown', { key: data.key, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: data.key, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: data.key, bubbles: true }));
      }
    }, { ref: inputRef, key: 'Enter' });

    // Verify key press was registered
    const keyDisplay = await page.locator('#key-press-display').textContent();
    expect(keyDisplay).toContain('Enter');
  });

  test('should handle hover_element functionality', async ({ page }) => {
    // Take snapshot to get element refs
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    // Extract button ref (use existing button for hover test)
    const buttonMatch = snapshot.match(/button.*"Click me.*\[ref=(e\d+)\]/);
    expect(buttonMatch).toBeTruthy();
    const buttonRef = buttonMatch![1];

    // Simulate hover on button
    const hoverResult = await page.evaluate((ref) => {
      const element = window.A11yCap.findElementByRef(ref);
      if (element) {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        return true;
      }
      return false;
    }, buttonRef);

    expect(hoverResult).toBe(true);
  });

  test('should handle select_option functionality', async ({ page }) => {
    // Take snapshot to get select element ref
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    // Extract select element ref
    const selectMatch = snapshot.match(/combobox.*"Choose an option:".*\[ref=(e\d+)\]/);
    expect(selectMatch).toBeTruthy();
    const selectRef = selectMatch![1];

    // Verify initial state (no selection)
    const initialValue = await page.locator('#test-select').inputValue();
    expect(initialValue).toBe('');

    // Select an option
    const testValue = 'option2';
    await page.evaluate((data) => {
      const element = window.A11yCap.findElementByRef(data.ref);
      if (element && element instanceof HTMLSelectElement) {
        // Find the option and select it
        for (let option of element.options) {
          if (option.value === data.value) {
            option.selected = true;
            break;
          }
        }
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { ref: selectRef, value: testValue });

    // Verify selection
    const selectedValue = await page.locator('#test-select').inputValue();
    expect(selectedValue).toBe(testValue);

    // Verify UI updated
    await expect(page.locator('text=Selected: option2')).toBeVisible();
  });

  test('should handle wait_for functionality', async ({ page }) => {
    // Test waiting for existing text
    const textExists = await page.evaluate(() => {
      return document.body.textContent?.includes('React Test Page') || false;
    });
    expect(textExists).toBe(true);

    // Test waiting for text to appear
    await page.click('text=Start Loading (2s delay)');
    
    // Verify loading message appears
    await expect(page.locator('text=Loading...')).toBeVisible();
    
    // Wait for completion message
    await expect(page.locator('text=Loading complete!')).toBeVisible();
    
    // Clear the message
    await page.click('text=Clear Message');
    
    // Test that loading messages are gone
    await expect(page.locator('text=Loading...')).not.toBeVisible();
    await expect(page.locator('text=Loading complete!')).not.toBeVisible();
  });

  test('should handle execute_js functionality', async ({ page }) => {
    // Test simple JavaScript execution
    const titleResult = await page.evaluate(() => {
      return eval('document.title');
    });
    expect(titleResult).toBe('React App');

    // Test more complex JavaScript
    const buttonCount = await page.evaluate(() => {
      return eval('document.querySelectorAll("button").length');
    });
    expect(buttonCount).toBeGreaterThan(0);

    // Test accessing React state indirectly
    const pageText = await page.evaluate(() => {
      return eval('document.body.textContent.includes("React Test Page")');
    });
    expect(pageText).toBe(true);
  });

  test('should capture snapshots after actions (integration test)', async ({ page }) => {
    // Take initial snapshot
    const initialSnapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    expect(initialSnapshot).toContain('Click me (0)');
    expect(initialSnapshot).toContain('Show Form');

    // Click the counter button
    const buttonMatch = initialSnapshot.match(/button.*"Click me.*\[ref=(e\d+)\]/);
    expect(buttonMatch).toBeTruthy();
    const buttonRef = buttonMatch![1];

    await page.evaluate((ref) => {
      window.A11yCap.clickRef(ref);
    }, buttonRef);

    // Take snapshot after button click
    const afterClickSnapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    expect(afterClickSnapshot).toContain('Click me (1)');
    expect(afterClickSnapshot).not.toBe(initialSnapshot);

    // Show form
    const formButtonMatch = initialSnapshot.match(/button.*"Show Form".*\[ref=(e\d+)\]/);
    expect(formButtonMatch).toBeTruthy();
    const formButtonRef = formButtonMatch![1];

    await page.evaluate((ref) => {
      window.A11yCap.clickRef(ref);
    }, formButtonRef);

    // Take snapshot after showing form
    const afterFormSnapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    expect(afterFormSnapshot).toContain('Hide Form');
    expect(afterFormSnapshot).toContain('Name:');
    expect(afterFormSnapshot).toContain('Email:');
    expect(afterFormSnapshot).not.toBe(afterClickSnapshot);

    console.log('Initial:', initialSnapshot.slice(0, 100));
    console.log('After click:', afterClickSnapshot.slice(0, 100));
    console.log('After form:', afterFormSnapshot.slice(0, 100));
  });

  test('should handle findElementByRef functionality', async ({ page }) => {
    // Take snapshot to get refs
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
    });

    // Extract various element refs
    const buttonMatch = snapshot.match(/button.*"Click me.*\[ref=(e\d+)\]/);
    const headingMatch = snapshot.match(/heading.*"React Test Page".*\[ref=(e\d+)\]/);
    
    expect(buttonMatch).toBeTruthy();
    expect(headingMatch).toBeTruthy();

    const buttonRef = buttonMatch![1];
    const headingRef = headingMatch![1];

    // Test finding elements by ref
    const elementsFound = await page.evaluate((refs) => {
      const button = window.A11yCap.findElementByRef(refs.button);
      const heading = window.A11yCap.findElementByRef(refs.heading);
      const nonExistent = window.A11yCap.findElementByRef('e999');

      return {
        buttonFound: button?.tagName?.toLowerCase(),
        headingFound: heading?.tagName?.toLowerCase(),
        nonExistentFound: nonExistent === null
      };
    }, { button: buttonRef, heading: headingRef });

    expect(elementsFound.buttonFound).toBe('button');
    expect(elementsFound.headingFound).toBe('h1');
    expect(elementsFound.nonExistentFound).toBe(true);
  });
});