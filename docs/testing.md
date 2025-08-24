# Testing Guide for a11ycap

This document provides comprehensive guidance for writing and running tests in the a11ycap repository.

## Table of Contents
- [Test Architecture](#test-architecture)
- [Essential Commands](#essential-commands)
- [Test Helpers](#test-helpers)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Debugging Tests](#debugging-tests)
- [CI/CD Considerations](#cicd-considerations)

## Test Architecture

### Test Stack
- **Framework**: Playwright Test (@playwright/test) for integration tests
- **Unit Tests**: Vitest for a11ycap-mcp package unit tests
- **Browser**: Chromium only
- **Test Server**: testpagecra (Create React App) on port 14652
- **Test Location**: `/test` directory at workspace root (Playwright tests)
- **Unit Test Location**: `a11ycap-mcp/test/` directory (Vitest tests)
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

# Run only Playwright integration tests (automatically builds a11ycap first)
pnpm test:specific test/click-ref.spec.ts

# Run tests matching a pattern
pnpm test:specific -g "should handle click"

# Debug a specific test with Playwright Inspector (only when debugging)
pnpm test:specific test/click-ref.spec.ts --debug

# Headed mode - DO NOT use unless explicitly requested
pnpm test:headed  # Run all tests with visible browser
pnpm test:specific test/click-ref.spec.ts --headed  # Specific test with visible browser

# Run only a11ycap-mcp unit tests (Vitest)
pnpm --filter a11ycap-mcp test

# Run a11ycap-mcp unit tests in watch mode
pnpm --filter a11ycap-mcp test --watch
```

Note: All builds and test server setup are handled automatically by the test scripts - no manual setup needed.

## Test Helpers

The repository provides test helper utilities in `/test/test-utils.ts` to simplify test setup and common operations.

### setupA11yCapTest()

Main helper function that initializes the A11yCap test environment:

```typescript
import { setupA11yCapTest } from './test-utils';

test.beforeEach(async ({ page }) => {
  await setupA11yCapTest(page, {
    waitForReactDevTools: true, // Optional: wait for React DevTools (default: false)
    timeout: 5000 // Optional: custom timeout in milliseconds (default: 5000)
  });
});
```

This helper:
- Navigates to the test page (http://localhost:14652)
- Waits for network idle state
- Waits for A11yCap library to be available
- Optionally waits for React DevTools to be ready

### loadA11yCapScript()

For tests that need manual script loading:

```typescript
import { loadA11yCapScript } from './test-utils';

await loadA11yCapScript(page, 'a11ycap/dist/browser.js', 5000);
```

This helper loads the A11yCap library via script tag and waits for it to be available.

### Usage Example

```typescript
import { expect, test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Use helper instead of manual setup
    await setupA11yCapTest(page, { waitForReactDevTools: true });
  });

  test('should work correctly', async ({ page }) => {
    // A11yCap is now ready to use
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    expect(snapshot).toContain('React Test Page');
  });
});
```

## Writing Tests

### Test File Structure

```typescript
import { expect, test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Use the helper for consistent setup
    await setupA11yCapTest(page, { waitForReactDevTools: true });
  });

  test('should do something specific', async ({ page }) => {
    // Test implementation
  });
});
```

### Legacy Test File Structure (not recommended)

If you need manual setup for specific cases:

```typescript
import { expect, test } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto('http://localhost:14652/');
    await page.waitForLoadState('networkidle');
    
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

#### 4. Removing CRA Dev Overlay (if needed)

```typescript
// Usually not needed with setupA11yCapTest helper, but available if required
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

### 1. Always Use pnpm Scripts and Test Helpers
**Important**: Never run `playwright` directly. Always use the provided pnpm scripts. Use test helpers for consistent setup.
```bash
# Wrong: Running playwright directly
playwright test test/specific.spec.ts

# Correct: Use pnpm scripts
pnpm test:specific test/specific.spec.ts

# For all tests
pnpm test
```

**Test Helper Usage**:
```typescript
// Recommended: Use test helpers
import { setupA11yCapTest } from './test-utils';
await setupA11yCapTest(page);

// Not recommended: Manual setup
await page.goto('http://localhost:14652/');
await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
```

### 2. Use Proper Waits
```typescript
// Library availability is handled by setupA11yCapTest helper
await setupA11yCapTest(page);

// Wait for specific conditions
await page.waitForSelector('#test-form', { state: 'visible' });

// Wait for network idle (also handled by setupA11yCapTest)
await page.waitForLoadState('networkidle');

// Manual waits when needed
await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
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
  // setupA11yCapTest handles navigation and basic setup
  await setupA11yCapTest(page);
  
  // Clear any existing state if needed
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
// setupA11yCapTest handles most timing issues, but sometimes needed:
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

## Unit Tests (a11ycap-mcp)

The `a11ycap-mcp` package includes Vitest unit tests for MCP server functionality:

### Running Unit Tests
```bash
# Run a11ycap-mcp unit tests only
pnpm --filter a11ycap-mcp test

# Run unit tests in watch mode
pnpm --filter a11ycap-mcp test --watch

# Run unit tests with UI
pnpm --filter a11ycap-mcp test --ui
```

### Unit Test Files
- **Location**: `a11ycap-mcp/test/`
- **Pattern**: `*.test.ts`
- **Current Tests**:
  - `debug-startup.test.ts` - Debug information and startup behavior
  - `multi-instance-coordination.test.ts` - Multi-instance coordination logic

### Unit Test Examples
```typescript
// Example Vitest unit test
import { describe, it, expect } from 'vitest';
import { someFunction } from '../src/module';

describe('Module functionality', () => {
  it('should work correctly', () => {
    const result = someFunction();
    expect(result).toBeDefined();
  });
});
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
The `pnpm test` command automatically handles everything:
- All necessary builds
- CI configuration
- Test execution with proper failure handling

## Troubleshooting

### Common Issues

1. **Tests fail with "window.A11yCap is undefined"**
   - Solution: Use `setupA11yCapTest()` helper for consistent initialization
   - Solution: Test scripts handle builds automatically

2. **Clicks not working on elements**
   - Solution: Remove CRA dev overlay
   - Solution: Use `page.waitForSelector` before clicking

3. **Snapshot refs not matching**
   - Solution: Use more specific regex patterns
   - Solution: Log the snapshot to see actual format

4. **Timeouts in CI**
   - Solution: Increase timeout in playwright.config.ts
   - Solution: Use proper wait conditions
   - Solution: `setupA11yCapTest()` helper includes proper wait conditions

5. **React DevTools not available**
   - Solution: Use `setupA11yCapTest(page, { waitForReactDevTools: true })`
   - Solution: Check that React app is properly loaded

6. **Test setup inconsistencies**
   - Solution: Use `setupA11yCapTest()` helper instead of manual setup
   - Solution: Import helper: `import { setupA11yCapTest } from './test-utils';`

7. **Unit tests failing in a11ycap-mcp**
   - Solution: Run tests in isolation: `pnpm --filter a11ycap-mcp test`
   - Note: Builds are handled automatically by test scripts

### Test Execution Order (handled automatically by pnpm scripts)
When you run `pnpm test`, everything is handled automatically:
- Builds are managed by pnpm scripts
- Test server starts/stops automatically
- Tests run in the correct sequence

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
1. **Always use pnpm scripts and test helpers** - Everything is handled automatically
2. Use `setupA11yCapTest()` helper for consistent test initialization
3. Import test helpers: `import { setupA11yCapTest } from './test-utils';`
4. Log intermediate results for debugging
5. Use the MCP tool handlers for testing tool functionality
6. Test both success and error cases
7. Verify result structures match expectations
8. Do NOT use headed mode unless explicitly requested - tests run faster headless