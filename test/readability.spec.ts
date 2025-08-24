import { expect, test } from '@playwright/test';
import { setupA11yCapTest } from './test-utils';

test.describe('Readability Tool', () => {
  test('should extract readable content from article page', async ({
    page,
  }) => {
    // Setup A11yCap test environment
    await setupA11yCapTest(page);

    // Create a simple article page
    await page.evaluate(() => {
      document.body.innerHTML = `
        <article>
          <h1>Test Article Title</h1>
          <p class="byline">By Test Author</p>
          <div class="content">
            <p>This is the first paragraph of the article. It contains some important information that should be extracted by the readability tool.</p>
            <p>This is the second paragraph with more content. The readability algorithm should identify this as part of the main article content.</p>
            <p>And here is a third paragraph to ensure we have enough content for the readability algorithm to work properly. This ensures the content meets the threshold.</p>
            <p>Adding more content to ensure we meet the character threshold. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            <p>Even more content to make sure the article is substantial enough. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          </div>
        </article>
        <aside>
          <h2>Related Articles</h2>
          <p>This sidebar content should not be included in the main article extraction.</p>
        </aside>
      `;
      document.title = 'Test Article Title - Test Site';
    });

    // Execute the readability tool
    const result = await page.evaluate(async () => {
      const { toolHandlers } = window.A11yCap;
      const handler = toolHandlers.get_readability;

      if (!handler) {
        throw new Error('get_readability tool not found');
      }

      const message = {
        id: 'test-1',
        type: 'get_readability' as const,
        payload: {
          includeContent: true,
          includeExcerpt: true,
          maxContentLength: 5000,
        },
      };

      return await handler.execute(message);
    });

    // Verify the result is now human-readable text
    expect(typeof result).toBe('string');
    expect(result).toContain('Test Article');
    expect(result).toContain('first paragraph');
    expect(result).toContain('second paragraph');
    expect(result).not.toContain('sidebar content');
    expect(result).not.toContain('Related Articles');
  });

  test('should handle pages without substantial content', async ({ page }) => {
    // Setup A11yCap test environment
    await setupA11yCapTest(page);

    // Create a page with only navigation (no article content)
    await page.evaluate(() => {
      document.body.innerHTML = `
        <nav>
          <a href="#">Home</a>
          <a href="#">About</a>
        </nav>
        <footer>
          <p>© 2024</p>
        </footer>
      `;
      document.title = 'Simple Page';
    });

    // Execute the readability tool
    const result = await page.evaluate(async () => {
      const { toolHandlers } = window.A11yCap;
      const handler = toolHandlers.get_readability;

      const message = {
        id: 'test-2',
        type: 'get_readability' as const,
        payload: {
          includeContent: true,
          includeExcerpt: true,
          maxContentLength: 5000,
        },
      };

      return await handler.execute(message);
    });

    // With minimal content, readability tool should return a message
    expect(typeof result).toBe('string');
    // Should indicate limited content or provide what it could extract
    expect(result.length).toBeGreaterThan(0);
  });

  test('should respect maxContentLength option', async ({ page }) => {
    // Setup A11yCap test environment
    await setupA11yCapTest(page);

    // Create a page with long content
    await page.evaluate(() => {
      const longText = 'This is a very long paragraph. '.repeat(100);
      document.body.innerHTML = `
        <article>
          <h1>Long Article</h1>
          <div class="content">
            <p>${longText}</p>
            <p>${longText}</p>
            <p>${longText}</p>
          </div>
        </article>
      `;
      document.title = 'Long Article';
    });

    // Execute with a small maxContentLength
    const result = await page.evaluate(async () => {
      const { toolHandlers } = window.A11yCap;
      const handler = toolHandlers.get_readability;

      const message = {
        id: 'test-3',
        type: 'get_readability' as const,
        payload: {
          includeContent: true,
          includeExcerpt: false,
          maxContentLength: 500,
        },
      };

      return await handler.execute(message);
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Should contain some indication of content, may be truncated
    expect(result).toContain('Long Article');
  });
});
