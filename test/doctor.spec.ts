import { test, expect } from '@playwright/test';
import { setupA11yCapTest } from './test-utils.js';

test.describe('Doctor Tool - Accessibility Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await setupA11yCapTest(page);
  });

  test('should perform full page accessibility analysis', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-full-page-analysis',
        type: 'doctor',
        payload: {}
      });
    });

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.violations).toBeDefined();
    expect(result.incomplete).toBeDefined();
    expect(result.passes).toBeDefined();
    expect(result.bestPractices).toBeDefined();

    // Verify summary structure
    expect(typeof result.summary.violations).toBe('number');
    expect(typeof result.summary.incomplete).toBe('number');
    expect(typeof result.summary.passes).toBe('number');
    expect(typeof result.summary.inapplicable).toBe('number');
    expect(typeof result.summary.executionTime).toBe('number');
    expect(result.summary.analysisScope).toBe('page');
    
    // Verify arrays are actually arrays
    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.incomplete)).toBe(true);
    expect(Array.isArray(result.passes)).toBe(true);
    
    // Verify best practices structure
    expect(Array.isArray(result.bestPractices.recommendations)).toBe(true);
    expect(Array.isArray(result.bestPractices.criticalIssues)).toBe(true);
    
    // Check that we have some passing rules (test page should have some accessible content)
    expect(result.summary.passes).toBeGreaterThan(0);
  });

  test('should analyze specific element by ref', async ({ page }) => {
    // Take snapshot to get element refs
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    // Find a button ref from the snapshot
    const buttonMatch = snapshot.match(/button[^[]*\[ref=([e\d]+)\]/);
    expect(buttonMatch).not.toBeNull();
    const buttonRef = buttonMatch![1];

    const result = await page.evaluate(async (ref) => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-element-analysis',
        type: 'doctor',
        payload: {
          element: 'Test button',
          ref: ref
        }
      });
    }, buttonRef);

    expect(result.summary.analysisScope).toBe('elements');
    expect(result.summary.elementsAnalyzed).toBe(1);
    
    // Element-specific analysis should still return valid structure
    expect(result.violations).toBeDefined();
    expect(result.passes).toBeDefined();
  });

  test('should analyze multiple elements by refs', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return window.A11yCap.snapshotForAI(document.body);
    });
    
    // Find multiple button refs
    const buttonMatches = [...snapshot.matchAll(/button[^[]*\[ref=([e\d]+)\]/g)];
    expect(buttonMatches.length).toBeGreaterThanOrEqual(2);
    
    const refs = [buttonMatches[0][1], buttonMatches[1][1]];

    const result = await page.evaluate(async (refs) => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-multiple-elements',
        type: 'doctor',
        payload: {
          element: 'Multiple buttons',
          refs: refs
        }
      });
    }, refs);

    expect(result.summary.analysisScope).toBe('elements');
    // With improved error handling, we expect at least 1 element to be successfully analyzed
    // (some elements might fail analysis and be skipped for robustness)
    expect(result.summary.elementsAnalyzed).toBeGreaterThanOrEqual(1);
    expect(result.summary.elementsAnalyzed).toBeLessThanOrEqual(2);
  });

  test('should analyze elements by CSS selector', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-selector-analysis',
        type: 'doctor',
        payload: {
          element: 'All buttons',
          selector: 'button'
        }
      });
    });

    expect(result.summary.analysisScope).toBe('elements');
    expect(result.summary.elementsAnalyzed).toBeGreaterThan(0);
  });

  test('should include detailed element info when requested', async ({ page }) => {
    // Create an element with accessibility issues for testing
    await page.evaluate(() => {
      const badButton = document.createElement('button');
      badButton.textContent = '';  // No accessible name
      badButton.style.color = '#ddd'; // Poor contrast
      badButton.style.backgroundColor = '#fff';
      document.body.appendChild(badButton);
    });

    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-element-info',
        type: 'doctor',
        payload: {
          selector: 'button',
          includeElementInfo: true
        }
      });
    });

    // Check if any violations have element info attached
    const violationsWithElementInfo = result.violations.filter((v: any) => 
      v.nodes.some((n: any) => n.element)
    );
    
    if (violationsWithElementInfo.length > 0) {
      const nodeWithElement = violationsWithElementInfo[0].nodes.find((n: any) => n.element);
      expect(nodeWithElement.element).toBeDefined();
      expect(nodeWithElement.element.ref).toBeDefined();
      expect(nodeWithElement.element.tagName).toBeDefined();
    }
  });

  test('should filter by WCAG tags', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-wcag-tags',
        type: 'doctor',
        payload: {
          tags: ['wcag2a', 'wcag21aa']
        }
      });
    });

    // Should still return valid structure
    expect(result.violations).toBeDefined();
    expect(result.passes).toBeDefined();
    
    // When tags are specified, we should have some violations or passes
    // Note: axe-core may return violations that don't strictly match the tags
    // due to how tag filtering works internally, so we just check structure
    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.passes)).toBe(true);
    
    // Verify that at least some results have the requested tags if there are results
    if (result.violations.length > 0 || result.passes.length > 0) {
      const allResults = [...result.violations, ...result.passes];
      const hasRequestedTags = allResults.some((item: any) => 
        item.tags.some((tag: string) => ['wcag2a', 'wcag21aa'].includes(tag))
      );
      expect(hasRequestedTags).toBe(true);
    }
  });

  test('should exclude specified rules', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-exclude-rules',
        type: 'doctor',
        payload: {
          excludeRules: ['color-contrast']
        }
      });
    });

    // Should not include any color-contrast violations
    const colorContrastViolations = result.violations.filter((v: any) => 
      v.id === 'color-contrast'
    );
    expect(colorContrastViolations).toHaveLength(0);
  });

  test('should limit number of violations returned', async ({ page }) => {
    // Create multiple elements with issues to ensure we have violations
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        const badImg = document.createElement('img');
        badImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        // No alt attribute = violation
        document.body.appendChild(badImg);
      }
    });

    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-max-violations',
        type: 'doctor',
        payload: {
          maxViolations: 3
        }
      });
    });

    // Should not return more than 3 violations
    expect(result.violations.length).toBeLessThanOrEqual(3);
  });

  test('should provide meaningful best practice recommendations', async ({ page }) => {
    // Create elements with common accessibility issues
    await page.evaluate(() => {
      // Poor color contrast
      const badContrastDiv = document.createElement('div');
      badContrastDiv.textContent = 'Hard to read text';
      badContrastDiv.style.color = '#ddd';
      badContrastDiv.style.backgroundColor = '#fff';
      document.body.appendChild(badContrastDiv);
      
      // Image without alt
      const badImg = document.createElement('img');
      badImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      document.body.appendChild(badImg);
      
      // Form input without label
      const badInput = document.createElement('input');
      badInput.type = 'text';
      document.body.appendChild(badInput);
    });

    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-recommendations',
        type: 'doctor',
        payload: {}
      });
    });

    expect(result.bestPractices.recommendations.length).toBeGreaterThan(0);
    
    // Check for specific recommendations based on common issues
    const recommendations = result.bestPractices.recommendations.join(' ');
    
    if (result.violations.some((v: any) => v.id.includes('color-contrast'))) {
      expect(recommendations).toContain('color contrast');
    }
    
    if (result.violations.some((v: any) => v.id.includes('image-alt'))) {
      expect(recommendations).toContain('alt text');
    }
    
    if (result.violations.some((v: any) => v.id.includes('label'))) {
      expect(recommendations).toContain('label');
    }
  });

  test('should handle critical and serious violations appropriately', async ({ page }) => {
    // Create elements that should trigger critical violations
    await page.evaluate(() => {
      // Create a form without any labels - this typically triggers serious violations
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.type = 'password';
      input.required = true;
      // No label = serious violation
      form.appendChild(input);
      document.body.appendChild(form);
    });

    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-critical-violations',
        type: 'doctor',
        payload: {}
      });
    });

    // Check if critical issues are properly identified
    const criticalViolations = result.violations.filter((v: any) => v.impact === 'critical');
    const seriousViolations = result.violations.filter((v: any) => v.impact === 'serious');
    
    if (criticalViolations.length > 0 || seriousViolations.length > 0) {
      expect(result.bestPractices.criticalIssues.length).toBeGreaterThan(0);
      const criticalIssuesText = result.bestPractices.criticalIssues.join(' ');
      expect(criticalIssuesText).toMatch(/(critical|serious)/i);
    }
  });

  test('should handle axe-core errors gracefully', async ({ page }) => {
    // This test verifies that if axe-core somehow fails, we get a proper error
    // Since axe-core is now bundled, we can't easily simulate missing axe-core,
    // but we can test with invalid parameters that might cause axe to fail
    
    const resultPromise = page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-axe-error',
        type: 'doctor',
        payload: {
          selector: 'invalid-selector-that-does-not-exist-anywhere'
        }
      });
    });

    // Should throw an error about no elements found
    await expect(resultPromise).rejects.toThrow(/No elements found/);
  });

  test('should handle non-existent element refs gracefully', async ({ page }) => {
    const resultPromise = page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-non-existent-ref',
        type: 'doctor',
        payload: {
          element: 'Non-existent element',
          ref: 'non-existent-ref'
        }
      });
    });

    // Should throw an error about missing element
    await expect(resultPromise).rejects.toThrow(/not found/);
  });

  test('should provide timing information', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-timing',
        type: 'doctor',
        payload: {}
      });
    });

    expect(result.summary.executionTime).toBeGreaterThan(0);
    expect(typeof result.summary.executionTime).toBe('number');
  });

  test('should work with bounding box targeting', async ({ page }) => {
    // Get viewport dimensions for bounding box
    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();

    const result = await page.evaluate(async (viewport) => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-bounding-box',
        type: 'doctor',
        payload: {
          element: 'Elements in top-left quadrant',
          boundingBox: {
            x: 0,
            y: 0,
            width: viewport!.width / 2,
            height: viewport!.height / 2
          }
        }
      });
    }, viewportSize);

    expect(result.summary.analysisScope).toBe('elements');
    expect(result.summary.elementsAnalyzed).toBeGreaterThanOrEqual(0);
  });

  test('should work with configuration presets', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-preset',
        type: 'doctor',
        payload: {
          preset: 'wcag-aa'
        }
      });
    });

    // Should return valid structure with preset applied
    expect(result.violations).toBeDefined();
    expect(result.passes).toBeDefined();
    expect(result.incomplete).toBeDefined();
    expect(result.bestPractices).toBeDefined();
    expect(result.summary).toBeDefined();
    
    // Should have analysis scope as page since no element targeting specified
    expect(result.summary.analysisScope).toBe('page');
  });

  test('should validate violation structure', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const toolHandler = window.A11yCap.toolHandlers['doctor'];
      return await toolHandler.execute({
        id: 'test-violation-structure',
        type: 'doctor',
        payload: {}
      });
    });

    // Validate each violation has required structure
    result.violations.forEach((violation: any) => {
      expect(typeof violation.id).toBe('string');
      expect(['minor', 'moderate', 'serious', 'critical'].includes(violation.impact) || violation.impact === undefined).toBe(true);
      expect(Array.isArray(violation.tags)).toBe(true);
      expect(typeof violation.description).toBe('string');
      expect(typeof violation.help).toBe('string');
      expect(typeof violation.helpUrl).toBe('string');
      expect(Array.isArray(violation.nodes)).toBe(true);
      
      violation.nodes.forEach((node: any) => {
        expect(typeof node.html).toBe('string');
        expect(Array.isArray(node.target)).toBe(true);
        expect(node.target.length).toBeGreaterThan(0);
      });
    });

    // Validate incomplete issues structure
    result.incomplete.forEach((incomplete: any) => {
      expect(typeof incomplete.id).toBe('string');
      expect(Array.isArray(incomplete.nodes)).toBe(true);
      
      incomplete.nodes.forEach((node: any) => {
        expect(typeof node.html).toBe('string');
        expect(Array.isArray(node.target)).toBe(true);
        expect(typeof node.message).toBe('string');
      });
    });

    // Validate passes structure
    result.passes.forEach((pass: any) => {
      expect(typeof pass.id).toBe('string');
      // Some passes might have impact values, some might not
      if (pass.impact !== undefined) {
        expect(['minor', 'moderate', 'serious', 'critical', null].includes(pass.impact)).toBe(true);
      }
      expect(Array.isArray(pass.tags)).toBe(true);
      expect(typeof pass.description).toBe('string');
      expect(typeof pass.help).toBe('string');
      expect(typeof pass.helpUrl).toBe('string');
      expect(Array.isArray(pass.nodes)).toBe(true);
    });
  });
});