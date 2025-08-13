import { expect, test } from '@playwright/test';

test.describe('Console logs buffering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652');
    await page.waitForLoadState('networkidle');
  });

  test('should buffer console messages locally', async ({ page }) => {
    // Generate some console messages
    await page.evaluate(() => {
      console.log('Test log message', { data: 'test' });
      console.warn('Test warning');
      console.error('Test error');
      console.info('Test info');
    });

    // Wait a bit for messages to be buffered
    await page.waitForTimeout(100);

    // Get console logs using the new tool
    const logs = await page.evaluate(() => {
      // @ts-ignore - A11yCap is injected globally
      return window.A11yCap.toolHandlers.get_console_logs.execute({
        id: 'test-1',
        type: 'get_console_logs',
        payload: {},
      });
    });

    expect(typeof logs).toBe('string');
    expect(logs).toContain('Console logs');

    // Check that we have our test messages in the formatted output
    expect(logs.includes('Test log message')).toBe(true);
    expect(logs.includes('Test warning')).toBe(true);
    expect(logs.includes('Test error')).toBe(true);
    expect(logs.includes('Test info')).toBe(true);
  });

  test('should filter console logs by level', async ({ page }) => {
    // Generate different levels of console messages
    await page.evaluate(() => {
      console.log('Log message');
      console.warn('Warning message');
      console.error('Error message');
    });

    await page.waitForTimeout(100);

    // Get only error logs
    const errorLogs = await page.evaluate(() => {
      // @ts-ignore
      return window.A11yCap.toolHandlers.get_console_logs.execute({
        id: 'test-2',
        type: 'get_console_logs',
        payload: { level: 'error' },
      });
    });

    expect(typeof errorLogs).toBe('string');
    expect(errorLogs).toContain('ERROR');
    expect(errorLogs).toContain('Error message');
    // Should not contain log or warn messages
    expect(errorLogs).not.toContain('Log message');
    expect(errorLogs).not.toContain('Warning message');

    // Get only warning logs
    const warnLogs = await page.evaluate(() => {
      // @ts-ignore
      return window.A11yCap.toolHandlers.get_console_logs.execute({
        id: 'test-3',
        type: 'get_console_logs',
        payload: { level: 'warn' },
      });
    });

    expect(typeof warnLogs).toBe('string');
    expect(warnLogs).toContain('WARN');
    expect(warnLogs).toContain('Warning message');
    // Should not contain log or error messages
    expect(warnLogs).not.toContain('Log message');
    expect(warnLogs).not.toContain('Error message');
  });

  test('should limit console logs when requested', async ({ page }) => {
    // Generate many console messages
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        console.log(`Message ${i}`);
      }
    });

    await page.waitForTimeout(100);

    // Get limited logs
    const limitedLogs = await page.evaluate(() => {
      // @ts-ignore
      return window.A11yCap.toolHandlers.get_console_logs.execute({
        id: 'test-4',
        type: 'get_console_logs',
        payload: { limit: 3 },
      });
    });

    expect(typeof limitedLogs).toBe('string');
    expect(limitedLogs).toContain('Console logs');
    // Count the number of log entries in the formatted output
    const logLines = limitedLogs
      .split('\n')
      .filter((line) => line.includes('LOG '));
    expect(logLines.length).toBeLessThanOrEqual(3);
  });

  test('should filter console logs by timestamp', async ({ page }) => {
    const startTime = Date.now();

    // Generate a message before timestamp
    await page.evaluate(() => {
      console.log('Before timestamp message');
    });

    await page.waitForTimeout(50);
    const filterTime = Date.now();
    await page.waitForTimeout(50);

    // Generate a message after timestamp
    await page.evaluate(() => {
      console.log('After timestamp message');
    });

    await page.waitForTimeout(100);

    // Get logs since the filter time
    const recentLogs = await page.evaluate((since) => {
      // @ts-ignore
      return window.A11yCap.toolHandlers.get_console_logs.execute({
        id: 'test-5',
        type: 'get_console_logs',
        payload: { since },
      });
    }, filterTime);

    expect(typeof recentLogs).toBe('string');
    expect(recentLogs).toContain('Console logs');

    // Should include the "after" message but not the "before" message
    expect(recentLogs).toContain('After timestamp message');
    expect(recentLogs).not.toContain('Before timestamp message');
  });

  test('should handle console messages with complex objects', async ({
    page,
  }) => {
    await page.evaluate(() => {
      const complexObj = {
        nested: { value: 42 },
        array: [1, 2, 3],
        func: () => 'test',
      };
      console.log('Complex object:', complexObj);
      console.error(new Error('Test error with stack'));
    });

    await page.waitForTimeout(100);

    const logs = await page.evaluate(() => {
      // @ts-ignore
      return window.A11yCap.toolHandlers.get_console_logs.execute({
        id: 'test-6',
        type: 'get_console_logs',
        payload: {},
      });
    });

    expect(typeof logs).toBe('string');
    expect(logs).toContain('Console logs');

    // Should have formatted the complex object and error
    expect(logs).toContain('Complex object:');
    expect(logs).toContain('Error: Test error with stack');
  });

  test('should not interfere with original console behavior', async ({
    page,
  }) => {
    // Check that console methods still work normally
    const consoleCalls: any[] = [];

    page.on('console', (msg) => {
      consoleCalls.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    await page.evaluate(() => {
      console.log('Original console test');
      console.warn('Original warning test');
    });

    await page.waitForTimeout(100);

    // Original console should still work
    expect(consoleCalls.length).toBeGreaterThanOrEqual(2);
    expect(
      consoleCalls.some((call) => call.text.includes('Original console test'))
    ).toBe(true);
    expect(
      consoleCalls.some((call) => call.text.includes('Original warning test'))
    ).toBe(true);

    // And buffered logs should also be available
    const bufferedLogs = await page.evaluate(() => {
      // @ts-ignore
      return window.A11yCap.toolHandlers.get_console_logs.execute({
        id: 'test-7',
        type: 'get_console_logs',
        payload: {},
      });
    });

    expect(typeof bufferedLogs).toBe('string');
    expect(bufferedLogs).toContain('Console logs');
    expect(bufferedLogs).toContain('Original console test');
    expect(bufferedLogs).toContain('Original warning test');
  });
});
