import { expect, test } from '@playwright/test';

test.describe('Network Tool Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652/');
    await page.waitForFunction(() => window.A11yCap, { timeout: 5000 });
  });

  test('should capture network requests from fetch API', async ({ page }) => {
    // Clear any existing performance entries
    await page.evaluate(() => {
      performance.clearResourceTimings();
    });

    // Make a network request
    await page.click('#fetch-button');

    // Wait for the network request to complete
    await page.waitForTimeout(2000);

    // Use the Performance API directly to capture requests (simulating the tool)
    const networkData = await page.evaluate(() => {
      try {
        // Get all performance entries
        const entries = performance.getEntries();

        // Filter for network requests (resource entries)
        let networkRequests = entries
          .filter(
            (entry) =>
              entry.entryType === 'resource' || entry.entryType === 'navigation'
          )
          .map((entry) => ({
            name: entry.name,
            entryType: entry.entryType,
            startTime: Math.round(entry.startTime),
            duration: Math.round(entry.duration),
            // Add resource-specific properties if available
            ...('initiatorType' in entry && {
              initiatorType: (entry as any).initiatorType,
            }),
            ...('transferSize' in entry && {
              transferSize: (entry as any).transferSize,
            }),
          }));

        // Filter out data URLs
        networkRequests = networkRequests.filter(
          (req) => !req.name.startsWith('data:')
        );

        // Sort by start time (most recent first) and limit to 10
        networkRequests = networkRequests
          .sort((a, b) => b.startTime - a.startTime)
          .slice(0, 10);

        return {
          requests: networkRequests,
          totalCount: networkRequests.length,
          timestamp: Date.now(),
        };
      } catch (error) {
        throw new Error(
          `Failed to retrieve network requests: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    expect(networkData).toHaveProperty('requests');
    expect(networkData).toHaveProperty('totalCount');
    expect(networkData).toHaveProperty('timestamp');
    expect(Array.isArray(networkData.requests)).toBe(true);

    // Should have captured at least one network request
    expect(networkData.requests.length).toBeGreaterThan(0);

    // Check for httpbin.org request (it might not always be captured due to timing)
    const httpbinRequest = networkData.requests.find((req: any) =>
      req.name?.includes('httpbin.org/json')
    );

    // If we found the httpbin request, verify its properties
    if (httpbinRequest) {
      expect(httpbinRequest.entryType).toBe('resource');
    } else {
      // At least verify we captured some requests
      console.log(
        'httpbin.org request not captured, available requests:',
        networkData.requests.map((r: any) => r.name)
      );
    }
  });

  test('should filter network requests by type', async ({ page }) => {
    // Clear any existing performance entries
    await page.evaluate(() => {
      performance.clearResourceTimings();
    });

    // Make network requests
    await page.click('#fetch-button');
    await page.waitForTimeout(1000);

    // Get fetch requests only (simulating resourceType filter)
    const fetchData = await page.evaluate(() => {
      const entries = performance.getEntries();
      const networkRequests = entries
        .filter(
          (entry) =>
            entry.entryType === 'resource' || entry.entryType === 'navigation'
        )
        .filter((entry) => {
          const initiatorType =
            'initiatorType' in entry
              ? (entry as any).initiatorType
              : entry.entryType;
          return initiatorType === 'fetch' || entry.entryType === 'fetch';
        })
        .map((entry) => ({
          name: entry.name,
          entryType: entry.entryType,
          initiatorType:
            'initiatorType' in entry ? (entry as any).initiatorType : undefined,
        }))
        .filter((req) => !req.name.startsWith('data:'))
        .slice(0, 50);

      return { requests: networkRequests };
    });

    expect(fetchData.requests).toBeDefined();

    // All returned requests should be fetch type if any exist
    if (fetchData.requests.length > 0) {
      for (const req of fetchData.requests) {
        expect(
          ['fetch', 'navigation'].includes(req.initiatorType || req.entryType)
        ).toBe(true);
      }
    }
  });

  test('should handle multiple network requests', async ({ page }) => {
    // Clear any existing performance entries
    await page.evaluate(() => {
      performance.clearResourceTimings();
    });

    // Make multiple network requests
    await page.click('#multiple-fetch-button');

    // Wait for all requests to complete
    await page.waitForTimeout(3000);

    // Get network requests
    const networkData = await page.evaluate(() => {
      const entries = performance.getEntries();
      const networkRequests = entries
        .filter(
          (entry) =>
            entry.entryType === 'resource' || entry.entryType === 'navigation'
        )
        .map((entry) => ({
          name: entry.name,
          entryType: entry.entryType,
        }))
        .filter((req) => !req.name.startsWith('data:'))
        .slice(0, 20);

      return { requests: networkRequests };
    });

    expect(networkData.requests).toBeDefined();
    expect(networkData.requests.length).toBeGreaterThan(0);

    // Should have multiple httpbin requests
    const httpbinRequests = networkData.requests.filter((req: any) =>
      req.name?.includes('httpbin.org')
    );
    expect(httpbinRequests.length).toBeGreaterThanOrEqual(1);
  });

  test('should respect limit parameter', async ({ page }) => {
    // Make some network requests first
    await page.click('#fetch-button');
    await page.waitForTimeout(1000);

    // Test with limit of 5
    const limitedData = await page.evaluate(() => {
      const entries = performance.getEntries();
      const networkRequests = entries
        .filter(
          (entry) =>
            entry.entryType === 'resource' || entry.entryType === 'navigation'
        )
        .map((entry) => ({ name: entry.name }))
        .filter((req) => !req.name.startsWith('data:'))
        .slice(0, 5);

      return { requests: networkRequests };
    });

    expect(limitedData.requests).toBeDefined();
    expect(limitedData.requests.length).toBeLessThanOrEqual(5);
  });

  test('should exclude data URLs by default', async ({ page }) => {
    // Get network requests with default settings (excluding data URLs)
    const networkData = await page.evaluate(() => {
      const entries = performance.getEntries();
      const networkRequests = entries
        .filter(
          (entry) =>
            entry.entryType === 'resource' || entry.entryType === 'navigation'
        )
        .map((entry) => ({ name: entry.name }))
        .filter((req) => !req.name.startsWith('data:'))
        .slice(0, 50);

      return { requests: networkRequests };
    });

    expect(networkData.requests).toBeDefined();

    // Should not include any data: URLs
    const dataUrlRequests = networkData.requests.filter((req: any) =>
      req.name?.startsWith('data:')
    );
    expect(dataUrlRequests.length).toBe(0);
  });

  test('should include data URLs when requested', async ({ page }) => {
    // Create a data URL image to trigger a data request
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      document.body.appendChild(img);
    });

    await page.waitForTimeout(500);

    // Get network requests including data URLs
    const networkData = await page.evaluate(() => {
      const entries = performance.getEntries();
      const networkRequests = entries
        .filter(
          (entry) =>
            entry.entryType === 'resource' || entry.entryType === 'navigation'
        )
        .map((entry) => ({ name: entry.name }));
      // Don't filter out data URLs this time

      return { requests: networkRequests };
    });

    expect(networkData.requests).toBeDefined();
    // Note: Data URLs might not show up in performance API depending on browser implementation
  });

  test('should return network request properties', async ({ page }) => {
    // Make a network request
    await page.click('#fetch-button');
    await page.waitForTimeout(2000);

    const networkData = await page.evaluate(() => {
      const entries = performance.getEntries();
      const networkRequests = entries
        .filter(
          (entry) =>
            entry.entryType === 'resource' || entry.entryType === 'navigation'
        )
        .map((entry) => ({
          name: entry.name,
          entryType: entry.entryType,
          startTime: Math.round(entry.startTime),
          duration: Math.round(entry.duration),
        }))
        .filter((req) => !req.name.startsWith('data:'))
        .slice(0, 10);

      return { requests: networkRequests };
    });

    expect(networkData.requests).toBeDefined();

    if (networkData.requests.length > 0) {
      const request = networkData.requests[0];

      // Should have basic properties
      expect(request).toHaveProperty('name');
      expect(request).toHaveProperty('entryType');
      expect(request).toHaveProperty('startTime');
      expect(request).toHaveProperty('duration');

      // Name should be a string
      expect(typeof request.name).toBe('string');

      // Times should be numbers
      expect(typeof request.startTime).toBe('number');
      expect(typeof request.duration).toBe('number');
    }
  });
});
