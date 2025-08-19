# Testing Guide for a11ycap

This document provides comprehensive guidance for writing and running tests in the a11ycap repository.

## Table of Contents
- [Test Architecture](#test-architecture)
- [Essential Commands](#essential-commands)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Debugging Tests](#debugging-tests)
- [CI/CD Considerations](#cicd-considerations)

## Test Architecture

### Test Stack
- **Framework**: Playwright Test (@playwright/test) for integration tests
- **Browser**: Chromium only
- **Test Server**: testpagecra (Create React App) on port 14652
- **Test Location**: `/test` directory at workspace root (Playwright tests)
- **Unit Tests**: a11ycap-mcp package has additional unit tests
- **Timeout**: 5 seconds for actions and navigation
- **Parallelization**: Fully parallel (single worker in CI)

### Test Server
The test server (testpagecra) is a Create React App that:
- Runs on port 14652
- Loads the built a11ycap library
- Provides a React environment with components for testing
- Includes various interactive elements (buttons, forms, inputs)
- Has React DevTools integration for component testing

## Essential Commands

### Running Tests

```bash
# Run all tests (builds packages, runs Playwright tests, then a11ycap-mcp unit tests)
pnpm test

# Run specific test files (automatically builds a11ycap first)
pnpm test:specific test/click-ref.spec.ts

# Run tests matching a pattern
pnpm test:specific -g "should handle click"

# Debug a specific test with Playwright Inspector (only when debugging)
pnpm test:specific test/click-ref.spec.ts --debug

# Headed mode - DO NOT use unless explicitly requested
pnpm test:headed  # Run all tests with visible browser
pnpm test:specific test/click-ref.spec.ts --headed  # Specific test with visible browser
```

### Other Commands

```bash
# Build all packages (only if you need to build without testing)
pnpm build

# Clean all build outputs
pnpm clean
```

Note: The test server starts automatically when running tests - no manual setup needed.

## Writing Tests

### Test File Structure

```typescript
import { expect, test } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto('http://localhost:14652/');
    
    // Wait for library to load
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
    
    // Optional: Wait for React DevTools
    await page.waitForFunction(() => window.__REACT_DEVTOOLS_GLOBAL_HOOK__, {
      timeout: 5000,
    });
  });

  test('should do something specific', async ({ page }) => {
    // Test implementation
  });
});
```

### Using Test Fixtures

**Important**: Do not create inline HTML in tests. Instead, add test fixtures to the testpagecra app.

The testpagecra app serves as a fixture repository for all test scenarios. This approach:
- Ensures consistent test environments
- Makes tests more maintainable
- Provides a real React app context
- Allows testing of React-specific features

When you need a new test scenario:
1. Add the necessary components/elements to testpagecra's App.tsx or create new components
2. Use existing interactive elements where possible
3. Reference these fixtures in your tests via selectors or IDs

Example:
```typescript
// Bad: Creating inline HTML in test
await page.setContent('<button id="test">Click me</button>');

// Good: Using testpagecra fixtures
await page.goto('http://localhost:14652/');
await page.click('#show-form-button'); // Uses existing fixture
```

### Common Test Patterns

#### 1. Taking Snapshots and Getting Element Refs

```typescript
// Take a snapshot to get element refs
const snapshot = await page.evaluate(() => {
  return window.A11yCap.snapshotForAI(document.body, { enableReact: true });
});

// Extract element ref from snapshot
const buttonMatch = snapshot.match(/button.*\[ref=(e\d+)\]/);
expect(buttonMatch).toBeTruthy();
const buttonRef = buttonMatch![1];
```

#### 2. Clicking Elements by Ref

```typescript
const clickResult = await page.evaluate((ref) => {
  return window.A11yCap.clickRef(ref);
}, buttonRef);

expect(clickResult).toBe(true);
```

#### 3. Using MCP Tool Handlers

```typescript
const result = await page.evaluate(async () => {
  const toolHandler = window.A11yCap.toolHandlers['tool_name'];
  return await toolHandler.execute({
    id: 'test-id',
    type: 'tool_name',
    payload: {
      // Tool-specific parameters
    }
  });
});
```

#### 4. Removing CRA Dev Overlay

```typescript
// Remove CRA dev overlay that can interfere with clicks
await page.evaluate(() => {
  const overlay = document.getElementById('webpack-dev-server-client-overlay');
  if (overlay) overlay.remove();
});
```

#### 5. Testing React Integration

```typescript
// Find React fiber for an element
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

  const button = document.getElementById('test-button');
  const fiber = findFiberForDom(button);
  
  return {
    hasFiber: !!fiber,
    fiberType: fiber ? fiber.type : null,
  };
});
```

## Best Practices

### 1. Always Use pnpm Scripts for Testing
**Important**: Never run `playwright` directly. Always use the provided pnpm scripts which handle building automatically.
```bash
# Wrong: Running playwright directly
playwright test test/specific.spec.ts

# Correct: Use pnpm scripts
pnpm test:specific test/specific.spec.ts

# For all tests
pnpm test
```

### 2. Use Proper Waits
```typescript
// Wait for library to be available
await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });

// Wait for specific conditions
await page.waitForSelector('#test-form', { state: 'visible' });

// Wait for network idle
await page.waitForLoadState('networkidle');
```

### 3. Console Logging for Debugging
```typescript
// Log snapshots and results for debugging
console.log('Snapshot result:', snapshot);
console.log('Click result:', clickResult);
```

### 4. Robust Element Selection
```typescript
// Use multiple strategies to find elements
const buttonMatch = snapshot.match(/button.*"Click me.*\[ref=(e\d+)\]/);
if (!buttonMatch) {
  // Fallback or better error
  throw new Error('Button not found in snapshot');
}
```

### 5. Test Isolation
```typescript
test.beforeEach(async ({ page }) => {
  // Clear any existing state
  await page.evaluate(() => {
    window.A11yCap.clearEvents?.();
    performance.clearResourceTimings?.();
  });
});
```

### 6. Verify Tool Results Structure
```typescript
// Always verify the structure of tool results
expect(result).toBeDefined();
expect(result.summary).toBeDefined();
expect(Array.isArray(result.violations)).toBe(true);
```

### 7. Handle Timing Issues
```typescript
// Use proper timeouts for async operations
await page.waitForTimeout(100); // For iframe loading
await page.waitForTimeout(2000); // For network requests
```

## Common Patterns

### Testing Different Snapshot Modes
```typescript
// AI mode with refs
const aiSnapshot = await page.evaluate(() => {
  return window.A11yCap.snapshot(document.body, { mode: 'ai' });
});

// Expect mode without refs
const expectSnapshot = await page.evaluate(() => {
  return window.A11yCap.snapshot(document.body, { mode: 'expect' });
});

// Verify differences
expect(aiSnapshot).toContain('[ref=');
expect(expectSnapshot).not.toContain('[ref=');
```

### Testing Form Interactions
```typescript
// Show form
await page.click('#show-form-button');
await page.waitForSelector('#test-form', { state: 'visible' });

// Fill form fields
await page.fill('#name', 'John Doe');
await page.fill('#email', 'test@example.com');

// Or use refs
const inputRef = 'e5'; // from snapshot
await page.evaluate((data) => {
  const element = window.A11yCap.findElementByRef(data.ref);
  if (element instanceof HTMLInputElement) {
    element.value = data.text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, { ref: inputRef, text: 'Test Value' });
```

### Testing Accessibility Analysis
```typescript
const result = await page.evaluate(async () => {
  const toolHandler = window.A11yCap.toolHandlers['doctor'];
  return await toolHandler.execute({
    id: 'test-analysis',
    type: 'doctor',
    payload: {
      selector: 'button',
      includeElementInfo: true,
      maxViolations: 5
    }
  });
});

// Verify accessibility results
expect(result.summary.violations).toBeGreaterThanOrEqual(0);
expect(result.bestPractices.recommendations).toBeDefined();
```

### Testing Network Requests
```typescript
// Clear existing entries
await page.evaluate(() => {
  performance.clearResourceTimings();
});

// Trigger network request
await page.click('#fetch-button');
await page.waitForTimeout(2000);

// Get network data
const networkData = await page.evaluate(() => {
  const entries = performance.getEntries()
    .filter(entry => entry.entryType === 'resource')
    .map(entry => ({
      name: entry.name,
      duration: Math.round(entry.duration)
    }));
  return entries;
});
```

## Debugging Tests

### Using Playwright Inspector
```bash
# Debug specific test with Playwright Inspector
pnpm test:specific test/specific.spec.ts --debug
```

### Using Console Logs
```typescript
// Add console.log statements in tests
console.log('Snapshot:', snapshot);
console.log('Result:', JSON.stringify(result, null, 2));
```

### Inspecting Test Artifacts
```bash
# View trace files after test failures
npx playwright show-trace test-results/*/trace.zip
```

## CI/CD Considerations

### Configuration for CI
```typescript
// playwright.config.ts
export default defineConfig({
  forbidOnly: !!process.env.CI,  // Prevent .only in CI
  retries: process.env.CI ? 2 : 0,  // Retry failed tests in CI
  workers: process.env.CI ? 1 : undefined,  // Single worker in CI
  webServer: {
    reuseExistingServer: !process.env.CI,  // Always start fresh in CI
  },
});
```

### Test Command for CI
The `pnpm test` command automatically handles CI configuration and includes build steps, max-failures limit, and runs a11ycap-mcp tests.

## Troubleshooting

### Common Issues

1. **Tests fail with "window.A11yCap is undefined"**
   - Solution: Use `pnpm test` or `pnpm test:specific` which build automatically

2. **Clicks not working on elements**
   - Solution: Remove CRA dev overlay
   - Solution: Use `page.waitForSelector` before clicking

3. **Snapshot refs not matching**
   - Solution: Use more specific regex patterns
   - Solution: Log the snapshot to see actual format

4. **Timeouts in CI**
   - Solution: Increase timeout in playwright.config.ts
   - Solution: Use proper wait conditions

5. **React DevTools not available**
   - Solution: Wait for `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`
   - Solution: Check that React app is properly loaded

### Test Execution Order (handled automatically by pnpm scripts)
1. Build a11ycap library
2. Start test server (automatic via webServer config)
3. Run Playwright tests
4. Test server stops after tests complete

## Advanced Testing

### Testing with Multiple Elements
```typescript
// Get multiple refs from snapshot
const buttonMatches = [...snapshot.matchAll(/button[^[]*\[ref=([e\d]+)\]/g)];
const refs = buttonMatches.map(match => match[1]);

// Test each element
for (const ref of refs) {
  const result = await page.evaluate((r) => {
    return window.A11yCap.clickRef(r);
  }, ref);
  expect(result).toBe(true);
}
```

### Testing Size-Limited Snapshots
```typescript
const limitedSnapshot = await page.evaluate(async () => {
  return await window.A11yCap.snapshotForAI(document.body, {
    max_chars: 200,
  });
});

// Verify size limit
const contentBeforeWarning = limitedSnapshot.split('\n\n[WARNING:')[0];
expect(contentBeforeWarning.length).toBeLessThanOrEqual(200);
```

### Testing Error Handling
```typescript
// Test with non-existent ref
const result = await page.evaluate(() => {
  return window.A11yCap.clickRef('non-existent-ref');
});
expect(result).toBe(false);

// Test with invalid selector
await expect(page.evaluate(async () => {
  const toolHandler = window.A11yCap.toolHandlers['doctor'];
  return await toolHandler.execute({
    id: 'test',
    type: 'doctor',
    payload: { selector: 'invalid-selector-that-does-not-exist' }
  });
})).rejects.toThrow(/No elements found/);
```

## Summary

Key points to remember:
1. **Always use pnpm scripts** - They handle building automatically
2. Use proper wait conditions for async operations
3. Remove CRA dev overlay when testing clicks
4. Log intermediate results for debugging
5. Use the MCP tool handlers for testing tool functionality
6. Test both success and error cases
7. Verify result structures match expectations
8. Do NOT use headed mode unless explicitly requested - tests run faster headless