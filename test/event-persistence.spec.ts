import { expect, test } from '@playwright/test';

test.describe('Event Buffer Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:14652');
    // Wait for the page to be ready
    await page.waitForSelector('#root');
  });

  test('should save events to sessionStorage automatically', async ({
    page,
  }) => {
    // Clear any existing events and start recording
    await page.evaluate(() => {
      window.A11yCap.clearEvents();
      window.A11yCap.startRecording();
    });

    // Generate some interaction events
    await page.click('#test-button');
    await page.fill('#key-test-input', 'test persistence');

    // Check that events were saved to sessionStorage with new key format
    const { hasEvents, eventCount, sampleEvent } = await page.evaluate(() => {
      // Check buffer state
      const state = sessionStorage.getItem('a11ycap_buffer_state');
      if (!state) return { hasEvents: false, eventCount: 0, sampleEvent: null };

      const bufferState = JSON.parse(state);
      if (bufferState.size === 0)
        return { hasEvents: false, eventCount: 0, sampleEvent: null };

      // Get a sample event
      const firstEventKey = `a11ycap_event_${bufferState.oldestIndex}`;
      const sampleEventStr = sessionStorage.getItem(firstEventKey);
      let sampleEvent = null;
      if (sampleEventStr) {
        try {
          sampleEvent = JSON.parse(sampleEventStr);
        } catch {}
      }

      return {
        hasEvents: bufferState.size > 0,
        eventCount: bufferState.size,
        sampleEvent,
      };
    });

    expect(hasEvents).toBe(true);
    expect(eventCount).toBeGreaterThan(0);
    expect(sampleEvent).toBeTruthy();
    expect(typeof sampleEvent.timestamp).toBe('number');
    expect(sampleEvent.url).toContain('localhost:14652');
  });

  test('should restore events from sessionStorage on page reload', async ({
    page,
  }) => {
    // Clear events and generate some
    await page.evaluate(() => {
      window.A11yCap.clearEvents();
      window.A11yCap.startRecording();
    });

    await page.click('#test-button');
    await page.fill('#key-test-input', 'before reload');

    // Get events before reload
    const eventsBefore = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: { limit: 100 },
      });
    });

    console.log('Events before reload:', eventsBefore);

    // Reload the page
    await page.reload();
    await page.waitForSelector('#root');

    // Check if events were restored from sessionStorage
    const eventsAfter = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: { limit: 100 },
      });
    });

    console.log('Events after reload:', eventsAfter);

    // Should have events from before reload
    expect(eventsAfter).not.toBe('No user interactions recorded');
    expect(eventsAfter).toContain('Click on button#test-button');
    expect(eventsAfter).toContain('before reload');
  });

  test('should persist events across navigation', async ({ page }) => {
    // Clear events and generate some
    await page.evaluate(() => {
      window.A11yCap.clearEvents();
      window.A11yCap.startRecording();
    });

    await page.click('#test-button');
    await page.keyboard.press('Tab'); // Generate keyboard event

    // Navigate to a different URL and back
    await page.goto('http://localhost:14652/#test');
    await page.waitForLoadState('networkidle');

    await page.goto('http://localhost:14652');
    await page.waitForSelector('#root');

    // Check if events were preserved
    const events = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: { limit: 100 },
      });
    });

    console.log('Events after navigation:', events);

    // Should have events from before navigation
    expect(events).not.toBe('No user interactions recorded');
    expect(events).toContain('Click on button#test-button');
  });

  test('should handle sessionStorage corruption gracefully', async ({
    page,
  }) => {
    // Corrupt the sessionStorage data
    await page.evaluate(() => {
      sessionStorage.setItem('a11ycap_event_buffer', 'invalid json');
    });

    // Reload to trigger loading from corrupted storage
    await page.reload();
    await page.waitForSelector('#root');

    // Should not crash and should start with empty buffer
    const events = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: { limit: 100 },
      });
    });

    // Should handle gracefully - either return empty or navigation events
    expect(events).toBeDefined();
    // Should not contain the corrupted data
    expect(events).not.toContain('invalid json');
  });

  test('should clear sessionStorage when clearEvents is called', async ({
    page,
  }) => {
    // Start recording and generate some events first
    await page.evaluate(() => {
      window.A11yCap.startRecording();
    });
    await page.click('#test-button');

    // Verify storage has content
    const stateBefore = await page.evaluate(() => {
      const state = sessionStorage.getItem('a11ycap_buffer_state');
      return state ? JSON.parse(state) : null;
    });
    expect(stateBefore).toBeTruthy();
    expect(stateBefore.size).toBeGreaterThan(0);

    // Clear events
    await page.evaluate(() => {
      window.A11yCap.clearEvents();
    });

    // Verify storage was cleared
    const stateAfter = await page.evaluate(() => {
      const state = sessionStorage.getItem('a11ycap_buffer_state');
      return state ? JSON.parse(state) : null;
    });
    expect(stateAfter.size).toBe(0);

    // Verify events are empty
    const events = await page.evaluate(() => {
      return window.A11yCap.toolHandlers.get_user_interactions.execute({
        id: 'test',
        type: 'get_user_interactions',
        payload: { limit: 100 },
      });
    });
    expect(events).toBe('No user interactions recorded');
  });

  test('should limit events stored in sessionStorage', async ({ page }) => {
    // Clear events first
    await page.evaluate(() => {
      window.A11yCap.clearEvents();
    });

    // Generate many events (more than MAX_BUFFER_SIZE)
    await page.evaluate(async () => {
      // Simulate many events by adding them directly
      for (let i = 0; i < 600; i++) {
        window.A11yCap.addEvent({
          type: 'click',
          timestamp: Date.now() + i,
          url: 'http://localhost:14652',
          target: { tagName: 'button', id: `button-${i}` },
          coordinates: { x: i, y: i },
          button: 0,
          metaKeys: { ctrl: false, alt: false, shift: false, meta: false },
        });
      }
    });

    // Check storage size is limited
    const { bufferSize, clickEventCount, maxButtonId } = await page.evaluate(
      () => {
        const state = sessionStorage.getItem('a11ycap_buffer_state');
        if (!state)
          return { bufferSize: 0, clickEventCount: 0, maxButtonId: -1 };

        const bufferState = JSON.parse(state);
        let clickEventCount = 0;
        let maxButtonId = -1;

        // Iterate through events to check click events
        for (let i = 0; i < bufferState.size; i++) {
          const index = (bufferState.oldestIndex + i) % 500; // MAX_BUFFER_SIZE
          const eventKey = `a11ycap_event_${index}`;
          const eventStr = sessionStorage.getItem(eventKey);
          if (eventStr) {
            try {
              const event = JSON.parse(eventStr);
              if (event.type === 'click') {
                clickEventCount++;
                if (event.target?.id?.startsWith('button-')) {
                  const buttonNum = Number.parseInt(
                    event.target.id.split('-')[1]
                  );
                  if (!Number.isNaN(buttonNum)) {
                    maxButtonId = Math.max(maxButtonId, buttonNum);
                  }
                }
              }
            } catch {}
          }
        }

        return {
          bufferSize: bufferState.size,
          clickEventCount,
          maxButtonId,
        };
      }
    );

    expect(bufferSize).toBeLessThanOrEqual(500); // MAX_BUFFER_SIZE
    expect(clickEventCount).toBeGreaterThan(0);

    if (maxButtonId >= 0) {
      expect(maxButtonId).toBeGreaterThan(450); // Should have events from the later part of the sequence
    }
  });
});
